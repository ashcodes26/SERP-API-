import json
from types import SimpleNamespace

import pytest

from app.auth import Principal, current_principal
from app.config import Settings
from app.main import app
from app.services import gemini_roadmap
from test_workspace import workspace  # noqa: F401


def cfg(key='synthetic-test-key'):
    return Settings(_env_file=None, gemini_api_key=key, gemini_model='gemini-test')


def report():
    gap = SimpleNamespace(skill=SimpleNamespace(canonical_name='SQL'), priority=SimpleNamespace(value='high'),
                          current_level=None, required_level=3, rationale='SQL is required by the analyzed role.')
    return SimpleNamespace(job=SimpleNamespace(title='Data Analyst'), gaps=[gap])


def response():
    return SimpleNamespace(text=json.dumps({'summary': 'Build evidence for the highest-priority gaps before interview practice.',
        'phases': [{'title': 'Foundation', 'actions': ['Complete a small SQL project with documented queries.']}]}))


def test_roadmap_requires_consent_and_configuration_without_provider_calls(monkeypatch):
    monkeypatch.setattr(gemini_roadmap, 'request_structured', lambda *args: pytest.fail('Provider must not be called'))
    assert gemini_roadmap.generate(report(), 'A detailed three-month plan for an entry role.', False, cfg()).status == 'not_requested'
    assert gemini_roadmap.generate(report(), 'A detailed three-month plan for an entry role.', True, cfg('')).status == 'unavailable'


def test_roadmap_valid_timeout_quota_and_malformed_results_are_safe(monkeypatch):
    monkeypatch.setattr(gemini_roadmap, 'request_structured', lambda *args: response())
    valid = gemini_roadmap.generate(report(), 'A detailed three-month plan for an entry role.', True, cfg())
    assert valid.status == 'available' and valid.phases[0].title == 'Foundation'

    monkeypatch.setattr(gemini_roadmap, 'request_structured', lambda *args: (_ for _ in ()).throw(TimeoutError('private details')))
    assert gemini_roadmap.generate(report(), 'A detailed three-month plan for an entry role.', True, cfg()).status == 'timeout'

    monkeypatch.setattr(gemini_roadmap, 'request_structured', lambda *args: (_ for _ in ()).throw(Exception('429 private details')))
    quota = gemini_roadmap.generate(report(), 'A detailed three-month plan for an entry role.', True, cfg())
    assert quota.status == 'quota_limit' and 'private details' not in quota.message

    monkeypatch.setattr(gemini_roadmap, 'request_structured', lambda *args: SimpleNamespace(text='not json'))
    assert gemini_roadmap.generate(report(), 'A detailed three-month plan for an entry role.', True, cfg()).status == 'invalid_output'


def test_roadmap_route_enforces_analysis_ownership(workspace, monkeypatch):
    client, factory, ids = workspace
    with factory() as db:
        analysis = db.query(__import__('app.models', fromlist=['Analysis']).Analysis).filter_by(student_pk=ids[0]).first()
        analysis_id = analysis.id
    monkeypatch.setattr('app.routes.jobs.generate_ai_roadmap', lambda *args: gemini_roadmap.RoadmapAiOut(status='available', message='Ready', model='test', summary='Plan', phases=[]))
    body = {'description': 'A detailed three-month plan for an entry role.', 'consent': True}
    ok = client.post(f'/api/roadmap/{ids[0]}/analysis/{analysis_id}/ai', json=body)
    assert ok.status_code == 200 and ok.json()['status'] == 'available'
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1])
    denied = client.post(f'/api/roadmap/{ids[0]}/analysis/{analysis_id}/ai', json=body)
    assert denied.status_code == 403
