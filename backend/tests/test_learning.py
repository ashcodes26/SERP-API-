import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from app.db import get_db, init_db, make_engine
from app.main import app
from app import models
from app.services.learning import get_questions
from app.auth import Principal, current_principal

@pytest.fixture
def client(tmp_path):
    engine = make_engine(f'sqlite:///{tmp_path / "phase4.sqlite"}')
    init_db(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    def dependency():
        with factory() as session:
            yield session
    app.dependency_overrides[get_db] = dependency
    app.dependency_overrides[current_principal] = lambda: Principal('admin', assigned_ids=(1, 99999, 999999))
    with TestClient(app) as api:
        yield api, factory
    app.dependency_overrides.clear()
    engine.dispose()


def workflow(api):
    ids = api.post('/api/demo/seed').json()
    result = api.post('/api/skill-gap/analyze', json=ids)
    assert result.status_code == 200, result.text
    return ids, result.json()


def test_roadmap_curated_fallback_and_idempotency(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setenv('SERPAPI_API_KEY', '')
    get_settings.cache_clear()
    api, factory = client
    ids, analysis = workflow(api)
    first = api.get(f'/api/roadmap/{ids["student_id"]}')
    assert first.status_code == 200, first.text
    items = first.json()
    assert items and all(i['resource_provenance'] == 'curated_fallback' for i in items)
    assert all(i['resource_url'].startswith('https://') for i in items)
    assert api.get(f'/api/roadmap/{ids["student_id"]}').json() == items
    with factory() as db:
        assert db.query(models.RoadmapItem).count() == len(items)
    get_settings.cache_clear()


def test_assessment_updates_evidence_and_live_readiness(client):
    api, factory = client
    ids, result = workflow(api)
    before = api.get(f'/api/dashboard/{ids["student_id"]}').json()
    assert before['data_mode'] == 'demo'
    sql = next(s['skill']['id'] for s in result['gaps'] if s['skill']['canonical_name'] == 'SQL')
    quiz = api.get(f'/api/assessment/questions/{sql}')
    assert quiz.status_code == 200
    assert 'answer' not in quiz.text.lower()
    body = {'student_id': ids['student_id'], 'skill_id': sql,
            'question_set_version': quiz.json()['question_set_version'],
            'answers': {'q1': 'WHERE', 'q2': 'INNER JOIN', 'q3': 'DISTINCT'}}
    submitted = api.post('/api/assessment/submit', json=body)
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()['score'] == 1
    assert submitted.json()['updated_level'] == 5
    after = api.get(f'/api/dashboard/{ids["student_id"]}').json()
    assert after['readiness']['alignment'] > before['readiness']['alignment']
    assert after['readiness'] == submitted.json()['readiness']
    profile = api.get(f'/api/profile/{ids["student_id"]}').json()
    sql_skill = next(c for c in profile['competencies'] if c['skill']['id'] == sql)
    assert sql_skill['level'] == 5 and len(sql_skill['evidence_ids']) >= 2
    with factory() as db:
        assert db.query(models.Assessment).count() == 1


def test_rejects_invalid_quiz_and_missing_analysis(client):
    api, factory = client
    ids = api.post('/api/demo/seed').json()
    assert api.get(f'/api/roadmap/{ids["student_id"]}').status_code == 409
    with factory() as db:
        sql = db.query(models.Skill).filter_by(canonical_name='SQL').one()
        skill_id = sql.id
    req = {'student_id': ids['student_id'], 'skill_id': skill_id,
           'question_set_version': 'sql-basics-v1', 'answers': {'q1': 'WHERE'}}
    assert api.post('/api/assessment/submit', json=req).status_code == 422
    req['question_set_version'] = 'tampered'
    assert api.post('/api/assessment/submit', json=req).status_code == 422
    assert api.get('/api/dashboard/999999').status_code == 404
    with factory() as db:
        assert db.query(models.Assessment).count() == 0


def test_live_serpapi_result_and_failure_fallback(client, monkeypatch):
    import app.services.learning as learning
    from app.config import get_settings
    from app.schemas import ResourceLink, ResourceSearchOut
    from app.enums import ResourceProvenance
    from app.services.serpapi import SearchFailure
    monkeypatch.setenv('SERPAPI_API_KEY', 'test-key')
    get_settings.cache_clear()
    calls = []
    async def fake_search(request, settings):
        calls.append(request.skill)
        if request.skill == 'SQL':
            return ResourceSearchOut(query='SQL', provenance=ResourceProvenance.serpapi_live,
                results=[ResourceLink(title='Example learning resource', url='https://example.org/sql', provenance='serpapi_live')])
        raise SearchFailure('SERPAPI_TIMEOUT', 'timed out', 504, True)
    monkeypatch.setattr(learning, 'search_resources', fake_search)
    monkeypatch.setattr(learning, 'search_resources', fake_search)
    api, _ = client
    ids, _ = workflow(api)
    items = api.get(f'/api/roadmap/{ids["student_id"]}').json()
    assert 'SQL' in calls
    assert any(i['resource_provenance'] == 'serpapi_live' for i in items)
    assert any(i['resource_provenance'] == 'curated_fallback' for i in items)
    get_settings.cache_clear()
