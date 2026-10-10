"""Synthetic upstream fixtures exercise production routes without paid calls."""
import asyncio
from datetime import timedelta
import logging

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import models
from app.config import Settings, get_settings
from app.db import get_db, init_db, make_engine
from app.main import app
from app.schemas import JobSearchIn
from app.services import job_discovery as jobs
from app.services.serpapi import SearchFailure


def payload():
    # Fixture provenance is explicit in test data; no fixture fallback exists in live code.
    first = {'job_id': 'fixture-one', 'title': 'Data engineer (test fixture)', 'company_name': 'Synthetic Employer',
             'location': 'Chennai', 'description': 'Requirements:\nPython (4/5) and SQL (3/5) required.\nPreferred:\nDocker',
             'apply_options': [{'link': 'javascript:bad'}, {'link': 'https://example.org/jobs/one'}],
             'detected_extensions': {'schedule_type': 'Full-time'}}
    return {'provenance': 'demo_fixture', 'jobs_results': [first, dict(first),
            {'job_id': 'fixture-two', 'title': 'Analyst (test fixture)', 'description': 'Qualifications:\nPython and SQL required.',
             'share_link': 'https://example.org/jobs/two'}], 'serpapi_pagination': {'next_page_token': 'fixture-next'}}


@pytest.fixture
def database(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'test')
    monkeypatch.setenv('SERPAPI_API_KEY', '')
    get_settings.cache_clear()
    engine = make_engine(f'sqlite:///{tmp_path / "jobs.db"}')
    init_db(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    def override():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with factory() as db:
        yield db, factory
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    engine.dispose()


def run(db, data=None, request=None, settings=None, handler=None):
    def default_handler(req):
        return httpx.Response(200, json=data if data is not None else payload())
    return asyncio.run(jobs.search_jobs(db, request or JobSearchIn(role='Data engineer'),
          settings or Settings(_env_file=None, serpapi_api_key='server-secret'),
          httpx.MockTransport(handler or default_handler)))


def test_normalization_deduplication_missing_fields_and_persistence(database, caplog):
    caplog.set_level(logging.INFO, logger='httpx')
    db, _ = database
    result = run(db)
    assert len(result.jobs) == 2
    assert result.jobs[0].source_domain == 'example.org'
    assert result.jobs[0].active_status == 'not_verified'
    assert result.jobs[1].company is None
    assert 'employment_type' in result.jobs[1].missing_fields
    assert result.jobs[0].employment_type == 'Full-time'
    assert result.jobs[0].experience_level is None
    assert 'server-secret' not in result.model_dump_json()
    assert 'server-secret' not in caplog.text
    assert len(db.scalars(select(models.Job)).all()) == 2
    assert jobs.get_listing(db, result.jobs[0].id).title == result.jobs[0].title


def test_actual_parameter_construction_and_bounded_pages(database):
    db, _ = database
    seen = []
    def handler(req):
        seen.append(dict(req.url.params))
        return httpx.Response(200, json=payload())
    req = JobSearchIn(role='Data engineer', location='Chennai', keywords='Python', level='entry_level')
    first = run(db, request=req, handler=handler)
    assert seen[0]['engine'] == 'google_jobs'
    assert seen[0]['q'] == 'Data engineer Python entry level'
    assert seen[0]['location'] == 'Chennai'
    assert 'start' not in seen[0]
    run(db, request=req.model_copy(update={'page': 2, 'next_page_token': first.next_page_token}), handler=handler)
    assert seen[1]['next_page_token'] == 'fixture-next'
    with pytest.raises(SearchFailure, match='Use the next-page token'):
        run(db, request=req.model_copy(update={'page': 3, 'next_page_token': 'made-up'}))
    with pytest.raises(SearchFailure):
        run(db, request=req.model_copy(update={'next_page_token': 'unexpected'}))


def test_cache_fresh_stale_expired_and_content_versions(database, monkeypatch):
    db, _ = database
    first = run(db)
    def fail(req):
        raise httpx.ReadTimeout('must not expose upstream key', request=req)
    assert run(db, handler=fail).cache_status == 'fresh_cache'
    initial = jobs.now()
    monkeypatch.setattr(jobs, 'now', lambda: initial + timedelta(hours=1))
    stale = run(db, handler=fail)
    assert stale.cache_status == 'stale_cache'
    assert stale.retrieved_at == first.retrieved_at
    assert 'older' in stale.warnings[-1]
    changed = payload()
    changed['jobs_results'][0]['description'] = 'Requirements:\nDocker (3/5) required'
    fresh = run(db, data=changed)
    assert fresh.jobs[0].id != first.jobs[0].id
    assert jobs.get_listing(db, first.jobs[0].id).description == first.jobs[0].description
    monkeypatch.setattr(jobs, 'now', lambda: initial + timedelta(days=3))
    with pytest.raises(SearchFailure) as error:
        run(db, handler=fail)
    assert error.value.code == 'SERPAPI_TIMEOUT'


@pytest.mark.parametrize('status,code', [(401, 'SERPAPI_AUTH_FAILED'), (429, 'SERPAPI_RATE_LIMITED'), (503, 'SERPAPI_UNAVAILABLE')])
def test_upstream_failures_are_structured(database, status, code):
    db, _ = database
    with pytest.raises(SearchFailure) as failure:
        run(db, handler=lambda _: httpx.Response(status, json={'error': 'server-secret'}))
    assert failure.value.code == code
    assert 'server-secret' not in failure.value.message


@pytest.mark.parametrize('data', [{'jobs_results': {}}, {'unexpected': []}, {'jobs_results': [None]}, {'error': 'server-secret'}])
def test_malformed_provider_payloads(database, data):
    with pytest.raises(SearchFailure):
        run(database[0], data=data)


def test_missing_key_empty_query_empty_results_and_limits(database):
    db, _ = database
    with pytest.raises(SearchFailure) as exc:
        run(db, settings=Settings(_env_file=None))
    assert exc.value.code == 'SERPAPI_NOT_CONFIGURED'
    with pytest.raises(SearchFailure):
        run(db, request=JobSearchIn(role='   '))
    assert run(db, data={'jobs_results': []}).jobs == []
    assert run(db, request=JobSearchIn(role='another'), settings=Settings(_env_file=None, serpapi_api_key='server-secret', serpapi_max_results=1)).jobs.__len__() == 1


def test_skill_qualifiers_levels_negation_and_aliases():
    observed = jobs.extract_requirements('Requirements:\nPostgres and Python (3/5) required\nPreferred:\nDocker\nResponsibilities:\nUse pandas. SQL not required.')
    by_name = {s.name: s for s in observed}
    assert by_name['PostgreSQL'].requirement_type == 'required'
    assert by_name['Python'].expected_level == 3
    assert by_name['Docker'].requirement_type == 'preferred'
    assert by_name['Pandas'].requirement_type == 'mentioned'
    assert by_name['SQL'].requirement_type == 'mentioned'
    assert by_name['SQL'].expected_level is None
    assert jobs.extract_requirements('A pythonic approach and gitignore rules.') == []


def test_api_match_market_resume_roadmap_and_progress_history(database, monkeypatch):
    db, _ = database
    sample = run(db)
    with TestClient(app) as api:
        ids = api.post('/api/demo/seed').json()
        match = api.post(f'/api/jobs/{sample.jobs[0].id}/match', json={'student_id': ids['student_id']})
        assert match.status_code == 200, match.text
        out = match.json()
        assert out['analysis']['readiness']['formula_version'] == 'role-alignment-v1'
        assert out['analysis']['readiness']['measurable'] is True
        assert 'Python' in out['evidenced_skills']
        unknown = next(g for g in out['analysis']['gaps'] if g['skill']['canonical_name'] == 'Docker')
        assert unknown['current_level'] is None and unknown['gap'] is None
        second = api.post(f'/api/jobs/{sample.jobs[1].id}/match', json={'student_id': ids['student_id']}).json()
        assert second['analysis']['readiness']['measurable'] is False
        assert all(g['required_level'] is None for g in second['analysis']['gaps'])
        insights = api.get('/api/market/skills', params={'search_id': sample.search_id}).json()
        assert insights['sample_size'] == 2
        python = next(s for s in insights['skills'] if s['name'] == 'Python')
        assert python['count'] == 2 and python['share'] == 1 and python['required_count'] == 2
        advice = api.post(f'/api/jobs/{sample.jobs[0].id}/resume-advice', json={
            'student_id': ids['student_id'], 'text': 'Education: engineering. Projects: built a data application.'})
        assert advice.status_code == 200
        assert 'Python' in advice.json()['supported_keywords']
        assert 'Docker' in advice.json()['unsubstantiated_keywords']
        assert 'not stored' in advice.json()['limitations'][1]
        aid = out['analysis']['id']
        url = f'/api/roadmap/{ids["student_id"]}/analysis/{aid}'
        tasks = api.get(url).json()
        assert tasks
        item = tasks[0]
        assert api.patch(f'/api/roadmap/items/{item["id"]}', json={'status': 'done'}).status_code == 422
        completed = api.patch(f'/api/roadmap/items/{item["id"]}', json={'status': 'done', 'completion_evidence': 'Completed an exercise with documented results.'})
        assert completed.status_code == 200
        assert api.patch(f'/api/roadmap/items/{item["id"]}', json={'status': 'done', 'completion_evidence': '   '}).status_code == 422
        assert api.get(url).json()[0]['status'] == 'done'
        rematch = api.post(f'/api/jobs/{sample.jobs[0].id}/match', json={'student_id': ids['student_id']}).json()
        new_tasks = api.get(f'/api/roadmap/{ids["student_id"]}/analysis/{rematch["analysis"]["id"]}').json()
        carried = next(t for t in new_tasks if t['skill_id'] == item['skill_id'])
        assert carried['status'] == 'done' and carried['completion_evidence']
        assert api.get(url).json()[0]['id'] == item['id']


def test_api_validation_authentication_ownership_and_insufficient_evidence(database, monkeypatch):
    db, _ = database
    sample = run(db, data={'jobs_results': [{'title': 'Unclear fixture', 'description': 'We use Python for fun.'}]})
    with TestClient(app) as api:
        assert api.get('/api/jobs/search', params={'role': 'Python', 'page': 4}).status_code == 422
        assert api.get('/api/jobs/search', params={'role': ''}).status_code == 422
        ids = api.post('/api/demo/seed').json()
        assert api.post(f'/api/jobs/{sample.jobs[0].id}/match', json={'student_id': ids['student_id']}).status_code == 422
        assert api.get('/api/jobs/999999').status_code == 404
        monkeypatch.setenv('APP_ENV', 'development')
        monkeypatch.setenv('AUTH_SIGNING_KEY', 's' * 48)
        monkeypatch.setenv('DEMO_PASSWORD', 'fixture-password')
        get_settings.cache_clear()
        assert api.get('/api/jobs/search', params={'role': 'Python'}).status_code == 401
        assert api.get('/api/jobs/1').status_code == 401
        auth = api.post('/api/auth/login', json={'username': 'demo', 'password': 'fixture-password'}).json()
        headers = {'Authorization': f'Bearer {auth["access_token"]}'}
        assert api.post(f'/api/jobs/{sample.jobs[0].id}/match', json={'student_id': ids['student_id'] + 1}, headers=headers).status_code == 403
        assert api.post(f'/api/jobs/{sample.jobs[0].id}/resume-advice', json={'student_id': ids['student_id'] + 1, 'text': 'A resume containing private evidence text.'}, headers=headers).status_code == 403
