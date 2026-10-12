import json
from types import SimpleNamespace

import httpx
import pytest

from app.config import Settings, get_settings
from app.schemas import GeminiFeedbackOut
from app.services import gemini_resume as ai
from app.services.resume_enhancer import approved_revision
from app.services.serpapi import SearchFailure
from test_workspace import workspace, create, analyzed, TEXT, JD  # noqa: F401

ORIGINAL = 'Worked on a Python tool to clean 100 records.'
PROPOSED = 'Contributed to a Python tool to clean 100 records.'


def payload():
    return dict(summary='Relevant Python project; more target evidence is needed.',
        scores={key: dict(value=65, reason='Supplied project evidence supports this editorial rating.', excerpts=[ORIGINAL]) for key in ['overall', 'relevance', 'evidence', 'clarity', 'structure']}, strengths=[dict(strength='Relevant Python project evidence', excerpt=ORIGINAL)],
        gaps=['SQL is not evidenced in the supplied resume.'],
        improvements=['Use consistent project bullets and make the existing contribution clearer.'],
        rewrites=[dict(original=ORIGINAL, proposed=PROPOSED, reason='Clarify the supplied contribution without adding facts.')],
        questions=['Have you used SQL in a project? Describe your actual work before adding it.'])


def response(data=None, finish='STOP'):
    return SimpleNamespace(text=json.dumps(payload() if data is None else data),
        candidates=[SimpleNamespace(finish_reason=finish)], prompt_feedback=None)


def cfg(key='synthetic-test-key'):
    return Settings(_env_file=None, gemini_api_key=key, gemini_model='gemini-3.5-flash-lite')


def test_valid_output_and_privacy(monkeypatch, caplog):
    calls = []
    def generate(resume, jd, settings):
        calls.append((resume, jd))
        return response()
    monkeypatch.setattr(ai, 'generate', generate)
    resume = TEXT + '\nEmail: alex@example.org\nPhone: +91 9876543210\nAddress: 12 Main Street\nhttps://example.org/alex'
    result, edits = ai.review(resume, JD, True, cfg())
    assert result.status == 'available' and len(edits) == 1
    assert edits[0].source == 'gemini' and edits[0].original == ORIGINAL
    assert len(calls) == 1
    assert all(x not in calls[0][0] for x in ['alex@example.org', '9876543210', '12 Main Street', 'Alex Student', 'example.org'])
    assert caplog.text == ''


@pytest.mark.parametrize('data', [{}, {**payload(), 'unexpected': 'x'},
    {**payload(), 'questions': ['']}])
def test_invalid_output_rejected(monkeypatch, data):
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'invalid_output' and result.feedback is None and not edits


@pytest.mark.parametrize('original,proposed', [('Not in resume', 'Built AWS systems'),
    (ORIGINAL, PROPOSED.replace('100', '1000')), (ORIGINAL, PROPOSED + ' using SQL'),
    (ORIGINAL, 'Led a Python tool to clean 100 records.'),
    (ORIGINAL, 'Contributed to a Python tool to clean records.'),
    (ORIGINAL, PROPOSED.replace('100', '-100'))])
def test_unsafe_suggestions_discarded(monkeypatch, original, proposed):
    data = payload(); data['rewrites'] = [dict(original=original, proposed=proposed, reason='Test')]
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    monkeypatch.setattr(ai, 'verify_rewrites', lambda *args: set())
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'available' and result.rejected_rewrites == 1
    assert result.feedback.rewrites == [] and edits == []


def test_missing_key_and_no_consent_make_no_requests(monkeypatch):
    monkeypatch.setattr(ai, 'generate', lambda *args: pytest.fail('Provider should not be called'))
    assert ai.review(TEXT, JD, True, cfg(''))[0].status == 'unavailable'
    assert ai.review(TEXT, JD, False, cfg())[0].status == 'not_requested'


def test_existing_route_missing_configuration_and_busy(workspace, monkeypatch):
    from app.routes.workspace import _RESUME_ANALYSIS_LOCK
    client, _, _ = workspace
    monkeypatch.setenv('GEMINI_API_KEY', ''); get_settings.cache_clear()
    monkeypatch.setattr(ai, 'generate', lambda *args: pytest.fail('Provider must not be called'))
    item = create(client)
    path = f'/api/resumes/{item["id"]}/analyze'
    body = dict(version=item['version'], title='Data', description=JD, ai_consent=True)
    _RESUME_ANALYSIS_LOCK.acquire()
    try:
        assert client.post(path, json=body).status_code == 429
    finally:
        _RESUME_ANALYSIS_LOCK.release()
    result = client.post(path, json=body)
    assert result.status_code == 200 and result.headers['cache-control'] == 'no-store'
    data = result.json()
    assert data['analysis']['ai_review']['status'] == 'unavailable'
    assert data['original_text'] == data['revised_text'] == TEXT


@pytest.mark.parametrize('code,status', [(400, 'unavailable'), (429, 'quota_limit'), (403, 'unavailable'), (404, 'unavailable'), (504, 'timeout'), (500, 'error')])
def test_provider_errors_are_sanitized_and_not_retried(monkeypatch, code, status, caplog):
    calls = []
    class ProviderError(Exception):
        pass
    def fail(*args):
        calls.append(1)
        exc = ProviderError('secret-key and personal resume must not escape')
        exc.code = code
        raise exc
    monkeypatch.setattr(ai, 'generate', fail)
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert result.status == status and not edits and calls == [1]
    assert 'secret-key' not in result.message and not caplog.text


def test_timeout_blocked_malformed_and_incomplete(monkeypatch):
    def timeout(*args):
        raise httpx.ReadTimeout('private payload')
    monkeypatch.setattr(ai, 'generate', timeout)
    assert ai.review(TEXT, JD, True, cfg())[0].status == 'timeout'
    monkeypatch.setattr(ai, 'generate', lambda *args: response(finish='SAFETY'))
    assert ai.review(TEXT, JD, True, cfg())[0].status == 'blocked'
    monkeypatch.setattr(ai, 'generate', lambda *args: response(finish='MAX_TOKENS'))
    assert ai.review(TEXT, JD, True, cfg())[0].status == 'invalid_output'
    malformed = response(); malformed.text = 'not JSON'
    monkeypatch.setattr(ai, 'generate', lambda *args: malformed)
    assert ai.review(TEXT, JD, True, cfg())[0].status == 'invalid_output'
    malformed.candidates = []; malformed.text = None
    assert ai.review(TEXT, JD, True, cfg())[0].status == 'blocked'


def test_existing_analysis_approval_export_and_duplicate_flow(workspace, monkeypatch):
    client, _, _ = workspace
    monkeypatch.setenv('GEMINI_API_KEY', 'synthetic-test-key'); get_settings.cache_clear()
    calls = []
    def generate(*args):
        calls.append(1)
        return response()
    monkeypatch.setattr(ai, 'generate', generate)
    item = create(client)
    body = dict(version=item['version'], title='Data analyst', description=JD, ai_consent=True)
    path = f'/api/resumes/{item["id"]}'
    result = client.post(path + '/analyze', json=body)
    assert result.status_code == 200, result.text
    item = result.json()
    assert item['analysis']['ai_review']['status'] == 'available'
    assert item['analysis']['ai_review']['feedback']['scores']['overall']['value'] == 65
    assert 'score' not in item['analysis']
    assert client.post(path + '/analyze', json=body).status_code == 409 and calls == [1]
    suggestion = next(x for x in item['analysis']['suggestions'] if x['source'] == 'gemini')
    for state in ['pending', 'rejected', 'accepted']:
        item = client.patch(path + '/suggestions/' + suggestion['id'], json=dict(version=item['version'], decision=state)).json()
        item = client.post(path + '/apply', json=dict(version=item['version'])).json()
        assert (PROPOSED in item['revised_text']) == (state == 'accepted')
        assert item['original_text'] == TEXT
    assert client.post(path + '/export', json=dict(version=item['version'], final_review_confirmed=False)).status_code == 422
    exported = client.post(path + '/export', json=dict(version=item['version'], final_review_confirmed=True, format='txt'))
    assert PROPOSED in exported.text
    restored = client.post(path + '/restore', json=dict(version=item['version'])).json()
    assert restored['revised_text'] == TEXT


def test_quota_returns_no_scores_or_fallback(workspace, monkeypatch):
    client, _, _ = workspace
    monkeypatch.setenv('GEMINI_API_KEY', 'synthetic-test-key'); get_settings.cache_clear()
    from google.genai.errors import ClientError
    monkeypatch.setattr(ai, 'generate', lambda *args: (_ for _ in ()).throw(ClientError(429, {'error': {'message': 'Quota'}})))
    item = create(client)
    result = client.post(f'/api/resumes/{item["id"]}/analyze', json=dict(version=item['version'], title='Data', description=JD, ai_consent=True))
    assert result.status_code == 200
    assert result.json()['analysis']['ai_review']['status'] == 'quota_limit'
    assert result.json()['analysis']['suggestions'] == []
    assert result.json()['analysis']['ai_review']['feedback'] is None


def test_sdk_configuration_without_network(monkeypatch):
    from google import genai
    calls = []
    class Client:
        def __init__(self, **kwargs):
            calls.append(kwargs)
            self.models = self
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            return response()
    monkeypatch.setattr(genai, 'Client', Client)
    ai.generate('Synthetic resume', JD, cfg())
    assert calls[0]['http_options'].timeout == 30000
    assert calls[0]['http_options'].retry_options.attempts == 1
    assert calls[1]['config'].response_json_schema == ai.provider_schema()
    assert calls[1]['config'].system_instruction == ai.SYSTEM
    assert json.loads(calls[1]['contents'])['resume_data'] == 'Synthetic resume'


def test_apply_revalidates_and_rejects_overlap():
    bad = dict(id='bad', source='gemini', kind='replace', original=ORIGINAL, proposed=PROPOSED + ' AWS')
    item = SimpleNamespace(original_text=TEXT, analysis={'engine': 'gemini', 'suggestions': [bad]}, decisions={'bad': {'decision': 'accepted'}})
    with pytest.raises(SearchFailure):
        approved_revision(item)
    first = {**bad, 'source': 'rule_based', 'proposed': PROPOSED}
    second = {**first, 'id': 'overlap', 'original': 'tool', 'proposed': 'application'}
    item.analysis = {'engine': 'gemini', 'suggestions': [first, second]}; item.decisions['overlap'] = {'decision': 'accepted'}
    with pytest.raises(SearchFailure):
        approved_revision(item)


@pytest.mark.parametrize('code, expected', [(200, 'available'), (429, 'quota_limit')])
def test_real_sdk_with_mock_http_transport(monkeypatch, code, expected):
    from google import genai
    real_client = genai.Client
    requests = []
    def transport(request):
        requests.append(request)
        if code == 429:
            return httpx.Response(429, json={'error': {'code': 429, 'status': 'RESOURCE_EXHAUSTED', 'message': 'Test quota'}})
        return httpx.Response(200, json={'candidates': [{'content': {'role': 'model', 'parts': [{'text': json.dumps(payload())}]}, 'finishReason': 'STOP'}]})
    def client(**kwargs):
        kwargs['http_options'].client_args = {'transport': httpx.MockTransport(transport)}
        return real_client(**kwargs)
    monkeypatch.setattr(genai, 'Client', client)
    result, edits = ai.review(TEXT + '\nEmail: alex@example.org', JD, True, cfg())
    assert result.status == expected, result.message
    assert len(requests) == 1
    body = json.loads(requests[0].content)
    assert 'alex@example.org' not in json.dumps(body)
    assert 'responseJsonSchema' in body['generationConfig']
    assert body['generationConfig']['responseMimeType'] == 'application/json'
    assert 'synthetic-test-key' not in str(requests[0].url)
    assert bool(edits) == (code == 200)


def test_provider_schema_keeps_structure_and_local_validation_stays_strict():
    schema = ai.provider_schema()
    assert schema['required'] == ['summary', 'scores', 'strengths', 'gaps', 'improvements', 'rewrites', 'questions']
    assert schema['$defs']['GeminiRewriteOut']['required'] == ['original', 'proposed', 'reason']
    encoded = json.dumps(schema)
    assert all(key not in encoded for key in ['maxItems', 'minLength', 'maxLength', 'additionalProperties'])
    from pydantic import ValidationError
    data = payload(); data['rewrites'][0]['proposed'] = 'x' * 2001
    with pytest.raises(ValidationError):
        GeminiFeedbackOut.model_validate(data)


def test_network_permission_error_has_actionable_safe_message(monkeypatch):
    def fail(*args):
        raise httpx.ConnectError('secret key and personal resume') from PermissionError(13, 'socket blocked')
    monkeypatch.setattr(ai, 'generate', fail)
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'unavailable' and not edits
    assert 'network permissions' in result.message
    assert 'secret key' not in result.message and 'personal resume' not in result.message


@pytest.mark.parametrize('change', ['out_of_range', 'bool_rating'])
def test_invalid_ai_ratings_are_not_displayed(monkeypatch, change):
    data = payload()
    rating = data['scores']['overall']
    if change == 'out_of_range': rating['value'] = 101
    if change == 'bool_rating': rating['value'] = True
    if change == 'invented_excerpt': rating['excerpts'] = ['Invented professional experience']
    if change == 'no_evidence': rating['excerpts'] = []
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'invalid_output' and result.feedback is None and not edits


@pytest.mark.parametrize('invalid_excerpt', ['Invented professional experience', ''])
def test_unlocated_rating_is_withheld_without_losing_valid_edits(monkeypatch, invalid_excerpt):
    data = payload(); data['scores']['overall']['excerpts'] = [invalid_excerpt]
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'available' and result.feedback.scores.overall.value is None
    assert result.feedback.scores.relevance.value == 65 and len(edits) == 1
    assert result.validation_warnings


def test_unsupported_strength_and_gap_are_discarded_individually(monkeypatch):
    data = payload()
    data['strengths'].append(dict(strength='Unsupported', excerpt='Invented AWS certification'))
    data['gaps'].append('Candidate lacks SQL.')
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'available' and len(edits) == 1
    assert len(result.feedback.strengths) == 1 and len(result.feedback.gaps) == 1
    assert len(result.validation_warnings) == 2


def test_whitespace_quotes_resolve_to_actual_source_text(monkeypatch):
    resume = TEXT.replace('Python tool to clean', 'Python tool\n    to clean')
    monkeypatch.setattr(ai, 'generate', lambda *args: response())
    result, edits = ai.review(resume, JD, True, cfg())
    assert result.status == 'available' and len(edits) == 1
    assert edits[0].original in resume and '\n' in edits[0].original
    assert result.feedback.strengths[0].excerpt in resume
    assert result.feedback.scores.overall.excerpts[0] in resume


def test_integral_score_serialization_is_supported_but_fraction_is_rejected(monkeypatch):
    data = payload(); data['scores']['overall']['value'] = 65.0
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, _ = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'available' and result.feedback.scores.overall.value == 65
    data['scores']['overall']['value'] = 65.3
    result, _ = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'invalid_output' and 'scores' in result.message


def test_validation_diagnostics_do_not_echo_response_fields_or_values(monkeypatch):
    data = payload(); data['scores'] = 'Private resume and secret-key'
    data['Private arbitrary field'] = 'private payload'
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, _ = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'invalid_output' and 'scores' in result.message
    assert 'Private' not in result.message and 'secret-key' not in result.message


def test_insufficient_information_rating_stays_null(monkeypatch):
    data = payload()
    data['scores']['overall'] = dict(value=None, reason='Insufficient supplied information.', excerpts=[])
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, _ = ai.review(TEXT, JD, True, cfg())
    assert result.status == 'available' and result.feedback.scores.overall.value is None


def test_fuller_rewrite_verified_once_and_apply_rechecks_boundaries(monkeypatch):
    original = 'I used Python to build a tool that cleans 100 records.'
    proposed = 'Built a tool that cleans 100 records using Python.'
    resume = TEXT + '\n' + original
    data = payload(); data['rewrites'] = [dict(original=original, proposed=proposed, reason='Lead with the action and remove filler.')]
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    calls = []
    def verify(edits, settings):
        calls.append(edits)
        return {edits[0]['id']}
    monkeypatch.setattr(ai, 'verify_rewrites', verify)
    result, edits = ai.review(resume, JD, True, cfg())
    assert result.status == 'available' and result.rewrite_validation_status == 'available'
    assert len(calls) == 1 and len(edits) == 1
    assert edits[0].factual_validation == 'gemini_verified'
    item = SimpleNamespace(original_text=resume, analysis={'engine': 'gemini', 'suggestions': [edits[0].model_dump()]}, decisions={edits[0].id: {'decision': 'accepted'}})
    assert proposed in approved_revision(item) and original not in approved_revision(item)
    item.analysis['suggestions'][0]['proposed'] = proposed.replace('100', '1000')
    with pytest.raises(SearchFailure): approved_revision(item)


@pytest.mark.parametrize('failure', ['quota', 'timeout', 'malformed', 'unsafe'])
def test_rewrite_verification_fails_closed_but_retains_feedback(monkeypatch, failure):
    data = payload(); data['rewrites'][0]['proposed'] = 'Used a Python tool to clean 100 records.'
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    calls = []
    def verify(*args):
        calls.append(1)
        if failure == 'unsafe': return set()
        if failure == 'quota':
            from google.genai.errors import ClientError
            raise ClientError(429, {'error': {'message': 'Private payload'}})
        if failure == 'timeout': raise httpx.ReadTimeout('Private payload')
        raise ValueError('Private payload')
    monkeypatch.setattr(ai, 'verify_rewrites', verify)
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert calls == [1] and result.status == 'available' and result.feedback is not None
    assert not edits and result.rejected_rewrites == 1
    if failure != 'unsafe':
        assert result.rewrite_validation_status == 'unavailable'
        assert 'Private payload' not in result.rewrite_message


@pytest.mark.parametrize('verdicts', [[], [{'id': 'unknown', 'facts_preserved': True}], [{'id': 'edit', 'facts_preserved': 'true'}], [{'id': 'edit', 'facts_preserved': True}, {'id': 'edit', 'facts_preserved': True}]])
def test_verification_schema_ids_are_validated(monkeypatch, verdicts):
    monkeypatch.setattr(ai, 'request_structured', lambda *args: response({'verdicts': verdicts}))
    with pytest.raises(ValueError):
        ai.verify_rewrites([dict(id='edit', original=ORIGINAL, proposed=PROPOSED)], cfg())


def test_verification_uses_one_bounded_batch_and_preserves_privacy(monkeypatch):
    calls = []
    def request(data, settings, schema, system, timeout, tokens):
        calls.append((data, system, timeout))
        return response({'verdicts': [{'id': 'edit', 'facts_preserved': True}]})
    monkeypatch.setattr(ai, 'request_structured', request)
    assert ai.verify_rewrites([dict(id='edit', original=ORIGINAL, proposed=PROPOSED)], cfg()) == {'edit'}
    assert len(calls) == 1 and calls[0][2] == 12 and calls[0][1] == ai.VERIFY_SYSTEM
    assert 'resume_data' not in calls[0][0] and 'job_description_data' not in calls[0][0]


def test_numeric_sentence_punctuation_does_not_change_facts():
    original = 'Finished coursework in 2024.'
    proposed = 'In 2024, finished coursework.'
    assert ai.rewrite_guard(original, proposed, original, original)
    assert not ai.rewrite_guard(original, proposed.replace('2024', '2025'), original, original)
    assert not ai.rewrite_guard(original, proposed.replace('2024', '-2024'), original, original)


def test_rejection_reasons_are_specific_and_do_not_expose_resume_text(monkeypatch):
    data = payload(); data['rewrites'][0]['proposed'] = PROPOSED.replace('100', '1000')
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    result, edits = ai.review(TEXT, JD, True, cfg())
    assert not edits and result.rejected_rewrites == 1
    assert '1 edit(s) withheld: numbers or dates changed.' in result.validation_warnings
    assert ORIGINAL not in ' '.join(result.validation_warnings)


def test_modest_summary_rewrite_preserves_aspiring_and_learning_claims(monkeypatch):
    original = 'I am an aspiring data analyst learning SQL.'
    proposed = 'Aspiring data analyst learning SQL.'
    data = payload(); data['rewrites'] = [dict(original=original, proposed=proposed, reason='Remove filler without adding experience.')]
    monkeypatch.setattr(ai, 'generate', lambda *args: response(data))
    monkeypatch.setattr(ai, 'verify_rewrites', lambda edits, settings: {edit['id'] for edit in edits})
    result, edits = ai.review(TEXT + '\n' + original, JD, True, cfg())
    assert result.status == 'available' and len(edits) == 1
    assert edits[0].proposed == proposed and edits[0].factual_validation == 'gemini_verified'
    assert not ai.rewrite_guard(original, 'Experienced SQL analyst.', original, original)
