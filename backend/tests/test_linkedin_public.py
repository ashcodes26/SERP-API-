"""Explicitly synthetic search fixtures; verify exact identity matching and reviewed adoption."""
import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from app.auth import Principal, current_principal
from app.config import Settings
from app.main import app
from app.schemas import LinkedInPublicSearchOut, LinkedInPublicSourceOut
from app.services import linkedin_public
from app.services.resume_enhancer import claims
from app.services.serpapi import SearchFailure
from test_workspace import workspace, create, analyzed  # noqa: F401


URL = 'https://www.linkedin.com/in/demo-fixture/'


def test_exact_profile_links_only_deduplicated_bounded_and_skill_mentions():
    rows = [{'title': 'Demo Fixture Student | Python SQL', 'link': 'https://in.linkedin.com/in/demo-fixture/?tracking=1', 'snippet': 'Built a Python and SQL dashboard.'},
            {'title': 'Other person Docker', 'link': 'https://www.linkedin.com/in/demo-fixture-other/', 'snippet': 'Docker expert'},
            {'title': 'Wrong host AWS', 'link': 'https://linkedin.com.evil.org/in/demo-fixture/', 'snippet': 'AWS expert'},
            {'title': 'Not a profile Git', 'link': 'https://www.linkedin.com/posts/demo-fixture/', 'snippet': 'Git expert'},
            {'title': 'Credential URL Java', 'link': 'https://user:pass@linkedin.com/in/demo-fixture/', 'snippet': 'Java'},
            {'title': 'Demo Fixture Student | Python SQL', 'link': URL, 'snippet': 'Built a Python and SQL dashboard.'},
            {'title': 'Skills', 'link': URL + 'details/skills/', 'snippet': 'Docker and JavaScript.'}]
    calls = []
    def provider(request):
        calls.append(request.url.params['q'])
        assert request.url.params['engine'] == 'google'
        assert request.url.params['api_key'] == 'demo_fixture_key'
        return httpx.Response(200, json={'organic_results': rows, 'provenance': 'demo_fixture'})
    result = asyncio.run(linkedin_public.lookup(URL, Settings(_env_file=None, serpapi_api_key='demo_fixture_key'), httpx.MockTransport(provider)))
    assert len(calls) == 2 and all('site:linkedin.com/in/demo-fixture' in q for q in calls)
    assert len(result.sources) == 2
    assert result.detected_skills == ['Docker', 'JavaScript', 'Python', 'SQL']
    assert 'AWS' not in result.profile_text and 'demo_fixture_key' not in result.model_dump_json()
    assert result.sources[0].url == URL
    assert result.status == 'found' and len(result.profile_text) <= 20000
    extracted = claims('Public search snapshot\nPython project\nSource: https://www.linkedin.com/in/aws-git/\nProfile URL: https://www.linkedin.com/in/docker/', 'linkedin_public_search_reviewed')
    assert list(extracted) == ['Python']


@pytest.mark.parametrize('payload', [{}, {'organic_results': []}, {'organic_results': [{'link': URL, 'title': 'No snippet'}]},
    {'error': "Google hasn't returned any results for this query.", 'search_information': {'organic_results_state': 'Fully empty'}}])
def test_empty_results_are_unavailable_not_missing_skills(payload):
    result = asyncio.run(linkedin_public.lookup(URL, Settings(_env_file=None, serpapi_api_key='demo_fixture_key'),
        httpx.MockTransport(lambda _: httpx.Response(200, json={**payload, 'provenance': 'demo_fixture'}))))
    assert result.status == 'not_found' and result.detected_skills == [] and result.profile_text == ''
    assert any('unavailable' in warning for warning in result.warnings)


@pytest.mark.parametrize('kind,code', [('malformed','UPSTREAM_MALFORMED'), ('quota','SERPAPI_RATE_LIMITED'), ('timeout','SERPAPI_TIMEOUT')])
def test_provider_failures_are_safe(kind, code):
    def provider(request):
        if kind == 'timeout': raise httpx.ReadTimeout('demo_fixture_key', request=request)
        return httpx.Response(429, text='demo_fixture_key') if kind == 'quota' else httpx.Response(200, json={'organic_results': {}, 'provenance': 'demo_fixture'})
    with pytest.raises(SearchFailure) as failure:
        asyncio.run(linkedin_public.lookup(URL, Settings(_env_file=None, serpapi_api_key='demo_fixture_key'), httpx.MockTransport(provider)))
    assert failure.value.code == code and 'demo_fixture_key' not in failure.value.message


def fixture_result(url):
    return LinkedInPublicSearchOut(id='demo_fixture_lookup', profile_url=url, status='found', retrieved_at=datetime.now(timezone.utc),
        provenance='demo_fixture', sources=[LinkedInPublicSourceOut(title='Demo Fixture Student', url=url, snippet='Python and SQL college projects.')],
        detected_skills=['Docker', 'Python', 'SQL'], profile_text='Public search snapshot\nDemo Fixture Student\nPython, SQL and Docker college projects.\nSource: '+url,
        warnings=['Synthetic search fixture; never a live result.'])


def test_lookup_preview_review_cache_isolation_and_analysis(workspace, monkeypatch):
    client, _, ids = workspace
    calls = []
    async def lookup(url, settings):
        calls.append(url); return fixture_result(url)
    monkeypatch.setattr(linkedin_public, 'lookup', lookup)
    resume = analyzed(client, create(client))
    profile_body = {'consent': True, 'confirmed': True, 'profile_url': URL, 'profile_text': 'SKILLS\nPython\nPROJECTS\nCreated a small Python project.'}
    saved = client.put('/api/profile/linkedin', json=profile_body).json()
    before = client.get(f'/api/resumes/{resume["id"]}').json()
    assert client.post('/api/profile/linkedin/public-search', json={'consent': False,'profile_url':URL}).status_code == 422
    assert client.post('/api/profile/linkedin/public-search', json={'consent':True,'profile_url':'https://linkedin.com.evil.org/in/demo-fixture'}).status_code == 422
    result = client.post('/api/profile/linkedin/public-search', json={'consent':True,'profile_url':URL})
    assert result.status_code == 200 and result.headers['cache-control'] == 'no-store'
    preview = result.json()
    assert client.get('/api/profile/linkedin').json() == saved
    assert client.get(f'/api/resumes/{resume["id"]}').json() == before
    assert client.post('/api/profile/linkedin/public-search', json={'consent':True,'profile_url':URL}).json()['cache_status'] == 'cached'
    assert len(calls) == 1
    assert client.get('/api/profile/linkedin/public-search').json() == preview
    body = {**profile_body,'profile_text':preview['profile_text'],'lookup_id':preview['id'],'confirmed':False}
    assert client.put('/api/profile/linkedin', json=body).status_code == 422
    assert client.put('/api/profile/linkedin', json={**body,'confirmed':True,'profile_url':'https://www.linkedin.com/in/different/'}).status_code == 422
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1])
    assert client.get('/api/profile/linkedin/public-search').json() is None
    assert client.put('/api/profile/linkedin', json={**body,'confirmed':True}).status_code == 404
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[0])
    updated = client.put('/api/profile/linkedin', json={**body,'confirmed':True})
    assert updated.status_code == 200 and updated.json()['import_method'] == 'public_search_reviewed'
    analysis = analyzed(client, client.get(f'/api/resumes/{resume["id"]}').json())['analysis']
    assert analysis['engine'] == 'gemini'
    profile = client.get(f'/api/resumes/{resume["id"]}/candidate-profile').json()
    sql = next(skill for skill in profile['skills'] if skill['name'] == 'SQL')
    assert any(source['source'] == 'linkedin_public_search_reviewed' for source in sql['sources'])
    assert sql['level'] is None
    assert client.delete('/api/profile/linkedin').status_code == 200
    assert client.get('/api/profile/linkedin/public-search').json() is None


def test_no_key_and_empty_lookup_preserve_work(workspace, monkeypatch):
    client, _, _ = workspace
    result = client.post('/api/profile/linkedin/public-search', json={'consent':True,'profile_url':URL})
    assert result.status_code == 503 and result.json()['detail']['code']=='SERPAPI_NOT_CONFIGURED'
    async def empty(url, settings):
        result = fixture_result(url)
        return result.model_copy(update={'status':'not_found','sources':[],'profile_text':'','detected_skills':[]})
    monkeypatch.setattr(linkedin_public, 'lookup', empty)
    before = client.get('/api/profile/linkedin').json()
    result = client.post('/api/profile/linkedin/public-search', json={'consent':True,'profile_url':URL}).json()
    assert result['status'] == 'not_found'
    assert client.get('/api/profile/linkedin').json() == before
    assert client.put('/api/profile/linkedin', json={'consent':True,'confirmed':True,'profile_url':URL,'profile_text':'Factual text that has sufficient characters.','lookup_id':result['id']}).status_code == 422
