import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from app.config import get_settings
from app.db import get_db, init_db, make_engine
from app.main import app
from app import models
from app.services.retention import purge_expired_imports
from datetime import datetime, timedelta, UTC

@pytest.fixture
def secure_client(monkeypatch, tmp_path):
    monkeypatch.setenv('APP_ENV', 'development')
    monkeypatch.setenv('AUTH_SIGNING_KEY', 's' * 48)
    monkeypatch.setenv('ADMIN_PASSWORD', 'admintest-password')
    monkeypatch.setenv('DEMO_PASSWORD', 'demotest-password')
    monkeypatch.setenv('DEMO_LOGIN_BYPASS', 'false')
    get_settings.cache_clear()
    engine = make_engine(f'sqlite:///{tmp_path / "secure.db"}')
    init_db(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    from app.auth import hash_password
    with maker() as db:
        db.add(models.Account(username='admin', role='admin', password_hash=hash_password('admintest-password')))
        db.commit()
    def override():
        with maker() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app, client=('127.0.0.1', 50000)) as client:
        yield client, maker
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    engine.dispose()

def login(client, username, password):
    return client.post('/api/auth/login', json={'username': username, 'password': password})

def test_unauthenticated_and_invalid_credentials(secure_client):
    client, _ = secure_client
    assert client.post('/api/demo/seed').status_code == 401
    assert client.get('/api/profile/1').status_code == 401
    assert client.get('/api/import/1').status_code == 401
    assert login(client, 'admin', 'wrong').status_code == 401
    assert client.get('/api/dashboard/1', headers={'Authorization': 'Bearer x.y'}).status_code == 401

def test_role_boundaries_and_tampered_token(secure_client):
    client, maker = secure_client
    student = login(client, 'demo', 'demotest-password').json()
    admin = login(client, 'admin', 'admintest-password').json()
    student_headers = {'Authorization': 'Bearer ' + student['access_token']}
    admin_headers = {'Authorization': 'Bearer ' + admin['access_token']}
    own = student['student_id']
    assert student['role'] == 'student'
    assert client.get(f'/api/profile/{own}', headers=student_headers).status_code == 200
    assert client.get(f'/api/profile/{own+100}', headers=student_headers).status_code == 403
    assert client.post('/api/skill-gap/analyze', json={'student_id': own+100, 'job_id': 1}, headers=student_headers).status_code == 403
    assert client.get('/api/import/1', headers=student_headers).status_code == 403
    assert client.get(f'/api/profile/{own}', headers=admin_headers).status_code == 403
    with maker() as db:
        admin_account = db.query(models.Account).filter_by(username='admin').one()
        db.add(models.FacultyScope(admin_id=admin_account.id, student_pk=own)); db.commit()
    assert client.get(f'/api/profile/{own}', headers=admin_headers).status_code == 200
    tampered = student['access_token'][:-1] + ('a' if student['access_token'][-1] != 'a' else 'b')
    assert client.get(f'/api/profile/{own}', headers={'Authorization': 'Bearer ' + tampered}).status_code == 401

def test_production_disables_demo_but_scopes_imports(secure_client, monkeypatch):
    client, _ = secure_client
    token = login(client, 'admin', 'admintest-password').json()['access_token']
    monkeypatch.setenv('APP_ENV', 'production')
    get_settings.cache_clear()
    headers = {'Authorization': 'Bearer ' + token}
    assert client.post('/api/demo/seed', headers=headers).status_code == 403
    assert client.get('/api/import/1', headers=headers).status_code == 404
    assert login(client, 'demo', 'demotest-password').status_code == 401


def test_auto_demo_is_opt_in_and_preserves_existing_workspace(secure_client, monkeypatch):
    client, maker = secure_client
    assert client.post('/api/auth/demo-session').status_code == 404
    monkeypatch.setenv('DEMO_LOGIN_BYPASS', 'true')
    get_settings.cache_clear()
    first = client.post('/api/auth/demo-session')
    assert first.status_code == 200
    assert first.headers['cache-control'] == 'no-store'
    result = first.json()
    assert result['role'] == 'student'
    assert result['token_type'] == 'bearer'
    student_id = result['student_id']
    with maker() as db:
        student = db.get(models.Student, student_id)
        assert student.is_synthetic
        student.name = 'Updated demo profile'
        db.commit()
    assert client.post('/api/auth/demo-session').json()['student_id'] == student_id
    headers = {'Authorization': 'Bearer ' + result['access_token']}
    assert client.get(f'/api/profile/{student_id}', headers=headers).status_code == 200
    assert client.get('/api/resumes', headers=headers).status_code == 200
    assert client.get(f'/api/profile/{student_id+100}', headers=headers).status_code == 403
    assert client.get('/api/import/1', headers=headers).status_code == 403
    with maker() as db:
        assert db.get(models.Student, student_id).name == 'Updated demo profile'
        assert db.query(models.Student).count() == 1


def test_auto_demo_never_enabled_in_production(secure_client, monkeypatch):
    client, _ = secure_client
    monkeypatch.setenv('DEMO_LOGIN_BYPASS', 'true')
    monkeypatch.setenv('APP_ENV', 'production')
    get_settings.cache_clear()
    assert client.post('/api/auth/demo-session').status_code == 404
    assert client.get('/api/resumes').status_code == 401


def test_auto_demo_rejects_remote_client_even_with_forwarded_header(secure_client, monkeypatch):
    monkeypatch.setenv('DEMO_LOGIN_BYPASS', 'true')
    get_settings.cache_clear()
    with TestClient(app, client=('192.0.2.10', 50000)) as remote:
        result = remote.post('/api/auth/demo-session', headers={'X-Forwarded-For': '127.0.0.1'})
        assert result.status_code == 403
        assert result.json()['detail']['code'] == 'LOCAL_DEMO_ONLY'


def test_auto_demo_reports_missing_signing_key(secure_client, monkeypatch):
    client, maker = secure_client
    monkeypatch.setenv('DEMO_LOGIN_BYPASS', 'true')
    monkeypatch.setenv('AUTH_SIGNING_KEY', '')
    get_settings.cache_clear()
    result = client.post('/api/auth/demo-session')
    assert result.status_code == 503
    assert result.json()['detail']['code'] == 'AUTH_NOT_CONFIGURED'
    with maker() as db:
        assert db.query(models.Student).count() == 0

def test_purge_only_expired_import_staging(secure_client):
    _, maker = secure_client
    with maker() as db:
        old = models.ImportJob(filename='old.csv', source_type='csv', created_at=datetime.now(UTC)-timedelta(days=2))
        fresh = models.ImportJob(filename='new.csv', source_type='csv')
        db.add_all([old, fresh]); db.flush()
        db.add(models.ImportStagedRow(import_job_id=old.id, row_number=2, values={'email': 'demo@example.org'}))
        db.add(models.ImportRowIssue(import_job_id=old.id, row_number=2, field='email', issue_code='BAD', message='bad'))
        db.commit()
        assert purge_expired_imports(db, 24) == 1
        assert db.get(models.ImportJob, old.id) is None
        assert db.get(models.ImportJob, fresh.id) is not None
        assert db.query(models.ImportStagedRow).count() == 0
