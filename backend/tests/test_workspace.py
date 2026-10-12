from datetime import date, datetime, timezone, timedelta
import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app import models
from app.auth import Principal, current_principal
from app.config import get_settings
from app.db import get_db, make_engine, init_db
from app.main import app
from app.services.demo_seed import seed_demo
from app.services.analysis import analyze
from app.services.learning import create_roadmap
from app.services.resume_files import parse_resume, DOCX_MIME
from app.services.resume_enhancer import export_document

TEXT = 'Alex Student\nSKILLS\nPython\nPROJECTS\nWorked on a Python tool to clean 100 records.\nEDUCATION\nBSc Computer Science'
JD = 'Requirements:\nPython and SQL required.\nPreferred:\nDocker.'


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'test'); monkeypatch.setenv('SERPAPI_API_KEY', '')
    monkeypatch.setenv('LINKEDIN_CLIENT_ID', '')
    monkeypatch.setenv('LINKEDIN_CLIENT_SECRET', '')
    monkeypatch.setenv('LINKEDIN_REDIRECT_URI', '')
    monkeypatch.setenv('GEMINI_API_KEY', 'synthetic-test-key')
    from app.services import gemini_resume
    from test_gemini_resume import response
    monkeypatch.setattr(gemini_resume, 'generate', lambda *args: response())
    get_settings.cache_clear()
    engine = make_engine(f'sqlite:///{tmp_path / "workspace.db"}')
    init_db(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    def database():
        with factory() as db:
            yield db
    with factory() as db:
        student, job = seed_demo(db)
        other = models.Student(student_id='other-fixture', name='Other synthetic student', email='other@example.org', is_synthetic=True)
        db.add(other); db.commit()
        result = analyze(db, student, job)
        milestones = asyncio.run(create_roadmap(db, student, db.get(models.Analysis, result.id), get_settings()))
        ids = (student.id, other.id, milestones[0].id)
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[0])
    with TestClient(app) as client:
        yield client, factory, ids
    app.dependency_overrides.clear(); get_settings.cache_clear(); engine.dispose()


def create(client):
    response = client.post('/api/resumes', json={'text': TEXT, 'storage_consent': True})
    assert response.status_code == 201, response.text
    return response.json()


def test_pdf_profile_import_unified_corrections_duplicate_and_ownership(workspace):
    from test_candidate_analysis import pdf_bytes
    client, _, ids = workspace
    payload = {'storage_consent': True}
    document = pdf_bytes()
    first = client.post('/api/resumes/upload', data=payload, files={'file': ('resume.pdf', document, 'application/pdf')})
    assert first.status_code == 201, first.text
    item = first.json()
    duplicate = client.post('/api/resumes/upload', data=payload, files={'file': ('again.pdf', document, 'application/pdf')}).json()
    assert duplicate['id'] == item['id'] and len(client.get('/api/resumes').json()) == 1
    imported = client.post('/api/profile/linkedin/upload', data={'consent': True, 'profile_url': 'https://in.linkedin.com/in/alex'}, files={'file': ('profile.pdf', document, 'application/pdf')})
    assert imported.status_code == 200, imported.text
    assert imported.json()['profile_url'] == 'https://www.linkedin.com/in/alex/'
    unified = client.get(f'/api/resumes/{item["id"]}/candidate-profile')
    assert unified.status_code == 200 and unified.headers['cache-control'] == 'no-store'
    assert any(len(skill['sources']) == 2 for skill in unified.json()['skills'])
    item = client.get(f'/api/resumes/{item["id"]}').json()
    correction = 'Name: Alex Corrected\nProjects: Built a TypeScript application for a college project.'
    item = client.put(f'/api/resumes/{item["id"]}/revision', json={'version': item['version'], 'text': correction, 'factual_confirmation': True}).json()
    assert item['extracted_profile']['fields']['full_name'][0]['value'] == 'Alex Corrected'
    item = analyzed(client, item, 'Requirements: TypeScript and Python required. SQL preferred.')
    assert item['analysis']['engine'] == 'gemini'
    assert item['revised_text'] == correction
    result = client.post(f'/api/resumes/{item["id"]}/semantic-review', json={'description': JD})
    assert result.status_code == 404
    for prefix in ['get', 'post']:
        app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1])
        if prefix == 'get':
            assert client.get(f'/api/resumes/{item["id"]}/candidate-profile').status_code == 404
        else:
            assert client.post(f'/api/resumes/{item["id"]}/semantic-review', json={'description': JD}).status_code == 404
    assert client.get('/api/profile/linkedin').json()['profile_text'] == ''
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[0])
    assert client.delete('/api/profile/linkedin').status_code == 200
    assert all(c['source'] == 'resume_saved_revision' for skill in client.get(f'/api/resumes/{item["id"]}/candidate-profile').json()['skills'] for c in skill['sources'])


def analyzed(client, item, jd=JD):
    response = client.post(f'/api/resumes/{item["id"]}/analyze', json={'version': item['version'], 'title': 'Data analyst', 'description': jd, 'ai_consent': True})
    assert response.status_code == 200, response.text
    return response.json()


def test_resume_analysis_decisions_revision_restore_and_export(workspace):
    client, factory, ids = workspace
    item = analyzed(client, create(client))
    result = item['analysis']
    assert result['engine'] == 'gemini'
    assert result['ai_review']['feedback']['scores']['overall']['value'] == 65
    assert 'score' not in result
    assert result['target_source'] == 'user_provided'
    suggestion = next(x for x in result['suggestions'] if x['kind'] == 'replace' and 'Worked on' in x['original'])
    for state in ['rejected', 'accepted']:
        item = client.patch(f'/api/resumes/{item["id"]}/suggestions/{suggestion["id"]}', json={'version': item['version'], 'decision': state}).json()
        item = client.post(f'/api/resumes/{item["id"]}/apply', json={'version': item['version']}).json()
        assert ('Contributed to' in item['revised_text']) == (state == 'accepted')
        assert item['original_text'] == TEXT
    revision = item['revised_text'] + '\nContact: student@example.org & portfolio'
    old_version = item['version']
    item = client.put(f'/api/resumes/{item["id"]}/revision', json={'version': old_version, 'text': revision, 'factual_confirmation': True}).json()
    assert client.put(f'/api/resumes/{item["id"]}/revision', json={'version': old_version, 'text': TEXT, 'factual_confirmation': True}).status_code == 409
    assert client.post(f'/api/resumes/{item["id"]}/export', json={'version': item['version'], 'final_review_confirmed': False}).status_code == 422
    for fmt, mime in [('docx', DOCX_MIME), ('txt', 'text/plain')]:
        response = client.post(f'/api/resumes/{item["id"]}/export', json={'version': item['version'], 'format': fmt, 'final_review_confirmed': True})
        assert response.status_code == 200
        assert response.headers['cache-control'] == 'no-store'
        assert parse_resume(response.content, 'approved.' + fmt, mime) == revision
    assert client.get(f'/api/resumes/{item["id"]}').json()['revised_text'] == revision
    item = client.post(f'/api/resumes/{item["id"]}/restore', json={'version': item['version']}).json()
    assert item['revised_text'] == TEXT and item['decisions'] == {}
    assert client.delete(f'/api/resumes/{item["id"]}?version={item["version"]}').status_code == 200
    assert client.get('/api/resumes').json() == []


def test_upload_limits_consent_invalid_target_and_insufficient_score(workspace):
    client, _, _ = workspace
    assert client.post('/api/resumes', json={'text': TEXT, 'storage_consent': False}).status_code == 422
    assert client.post('/api/resumes/upload', data={'storage_consent': True}, files={'file': ('resume.pdf', b'fake', 'application/pdf')}).status_code == 422
    assert client.post('/api/resumes/upload', data={'storage_consent': True}, files={'file': ('r.txt', b'x' * 1048577, 'text/plain')}).status_code == 413
    assert client.post('/api/resumes/upload', data={'storage_consent': True}, files={'file': ('r.docx', b'fake', DOCX_MIME)}).status_code == 422
    item = client.post('/api/resumes/upload', data={'storage_consent': True}, files={'file': ('../r.docx', export_document(TEXT, 'docx'), DOCX_MIME)}).json()
    assert item['filename'] == 'r.docx' and item['original_text'] == TEXT
    assert client.post(f'/api/resumes/{item["id"]}/analyze', json={'version': item['version'], 'title': 'Role', 'description': 'short'}).status_code == 422
    item = analyzed(client, item, 'Join our organization and help our team work together effectively.')
    assert 'score' not in item['analysis']
    assert item['original_text'] == TEXT
    assert client.post('/api/resumes', json={'text': TEXT + '\ufffe', 'storage_consent': True}).status_code == 422
    assert client.post('/api/resumes', content=json.dumps({'text': TEXT + '\ud800', 'storage_consent': True}), headers={'Content-Type': 'application/json'}).status_code == 422


def test_linkedin_manual_consent_conflicts_corrections_deletion(workspace):
    client, _, _ = workspace
    item = create(client)
    text = 'SKILLS\nPython (5/5)\nSQL\nPROJECTS\nBuilt a SQL dashboard for a college project.\nEDUCATION\nBSc'
    payload = {'profile_url': 'https://www.linkedin.com/in/alex/?tracking=yes', 'profile_text': text, 'consent': False, 'confirmed': True}
    assert client.put('/api/profile/linkedin', json=payload).status_code == 422
    payload['consent'] = True
    for bad in ['http://linkedin.com/in/alex', 'https://linkedin.com.evil.org/in/alex', 'https://user:pass@linkedin.com/in/alex', 'https://linkedin.com/company/alex', 'https://linkedin.com/in/a%2Fb']:
        assert client.put('/api/profile/linkedin', json={**payload, 'profile_url': bad}).status_code == 422
    response = client.put('/api/profile/linkedin', json=payload)
    assert response.status_code == 200, response.text
    assert response.json()['profile_url'] == 'https://www.linkedin.com/in/alex/'
    assert not response.json()['automatic_import_available']
    assert client.post('/api/profile/linkedin/automatic', json=payload).status_code == 503
    item = analyzed(client, client.get(f'/api/resumes/{item["id"]}').json())
    assert all(x['source'] == 'gemini' and x['kind'] == 'replace' for x in item['analysis']['suggestions'])
    assert 'SQL dashboard' not in item['revised_text']
    assert client.delete('/api/profile/linkedin').status_code == 200
    saved = client.get(f'/api/resumes/{item["id"]}').json()
    assert saved['analysis'] is None and saved['decisions'] == {}
    assert saved['original_text'] == TEXT and saved['revised_text'] == item['revised_text']
    assert client.get('/api/profile/linkedin').json()['profile_text'] == ''


def test_task_crud_filters_counts_links_and_independent_milestones(workspace):
    client, factory, ids = workspace
    today = datetime.now(timezone.utc).date()
    body = {'title': ' Practice SQL ', 'priority': 'high', 'roadmap_milestone_id': ids[2], 'due_date': str(today)}
    response = client.post('/api/roadmap/tasks', json=body)
    assert response.status_code == 201, response.text
    item = response.json(); assert item['title'] == 'Practice SQL' and item['skill_id'] is not None
    future = client.post('/api/roadmap/tasks', json={'title': 'Future project', 'due_date': str(today + timedelta(days=2)), 'priority': 'low'}).json()
    assert client.get('/api/roadmap/tasks?view=today').json()['tasks'][0]['id'] == item['id']
    assert client.get('/api/roadmap/tasks?view=upcoming').json()['tasks'][0]['id'] == future['id']
    assert client.post('/api/roadmap/tasks', json={'title': '   '}).status_code == 422
    assert client.post('/api/roadmap/tasks', json={'title': 'Invalid date', 'due_date': '2026-02-30'}).status_code == 422
    assert client.patch(f'/api/roadmap/tasks/{item["id"]}', json={'version': item['version'], 'title': None}).status_code == 422
    with factory() as db:
        before = db.get(models.RoadmapItem, ids[2]).status
    item = client.patch(f'/api/roadmap/tasks/{item["id"]}', json={'version': item['version'], 'status': 'done', 'description': 'Executed the exercise'}).json()
    assert item['completed_at'] is not None
    stats = client.get('/api/roadmap/tasks?view=completed').json()
    assert stats['total'] == 2 and stats['completed'] == 1 and stats['remaining'] == 1 and stats['completion_percentage'] == 50
    assert stats['milestone_counts'][str(ids[2])] == {'total': 1, 'completed': 1}
    with factory() as db:
        assert db.get(models.RoadmapItem, ids[2]).status == before
    assert client.patch(f'/api/roadmap/tasks/{item["id"]}', json={'version': 1, 'status': 'not_started'}).status_code == 409
    item = client.patch(f'/api/roadmap/tasks/{item["id"]}', json={'version': item['version'], 'status': 'not_started', 'due_date': None, 'roadmap_milestone_id': None}).json()
    assert item['completed_at'] is None and item['due_date'] is None and item['roadmap_milestone_id'] is None
    assert client.delete(f'/api/roadmap/tasks/{item["id"]}?version={item["version"]}').status_code == 200
    assert client.get('/api/roadmap/tasks').json()['total'] == 1
    assert client.get(f'/api/roadmap/milestones/{ids[2]}').status_code == 200


def test_ownership_and_unauthenticated_access(workspace):
    client, factory, ids = workspace
    item = create(client)
    task = client.post('/api/roadmap/tasks', json={'title': 'Private task'}).json()
    client.put('/api/profile/linkedin', json={'profile_text': TEXT, 'consent': True})
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1])
    assert client.get('/api/resumes').json() == []
    assert client.get(f'/api/resumes/{item["id"]}').status_code == 404
    assert client.post(f'/api/resumes/{item["id"]}/export', json={'version': 1, 'final_review_confirmed': True}).status_code == 404
    assert client.delete(f'/api/resumes/{item["id"]}?version=1').status_code == 404
    assert client.get('/api/profile/linkedin').json()['profile_text'] == ''
    assert client.get('/api/roadmap/tasks').json()['total'] == 0
    assert client.patch(f'/api/roadmap/tasks/{task["id"]}', json={'version': 1, 'status': 'done'}).status_code == 404
    assert client.delete(f'/api/roadmap/tasks/{task["id"]}?version=1').status_code == 404
    assert client.post('/api/roadmap/tasks', json={'title': 'Foreign milestone', 'roadmap_milestone_id': ids[2]}).status_code == 404
    assert client.get(f'/api/roadmap/milestones/{ids[2]}').status_code == 404
    app.dependency_overrides[current_principal] = lambda: Principal('admin')
    assert client.get('/api/resumes').status_code == 403
    app.dependency_overrides.pop(current_principal)
    from app.config import Settings
    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None, app_env='development')
    # current_principal reads settings directly; change environment for the final auth check.
    import os
    os.environ['APP_ENV'] = 'development'; get_settings.cache_clear()
    assert client.get('/api/resumes').status_code == 401
