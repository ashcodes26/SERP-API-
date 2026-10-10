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
    get_settings.cache_clear()
    engine = make_engine(f'sqlite:///{tmp_path / "secure.db"}')
    init_db(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    def override():
        with maker() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
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
    client, _ = secure_client
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
    assert client.get(f'/api/profile/{own}', headers=admin_headers).status_code == 200
    tampered = student['access_token'][:-1] + ('a' if student['access_token'][-1] != 'a' else 'b')
    assert client.get(f'/api/profile/{own}', headers={'Authorization': 'Bearer ' + tampered}).status_code == 401

def test_production_disables_demo_and_import(secure_client, monkeypatch):
    client, _ = secure_client
    token = login(client, 'admin', 'admintest-password').json()['access_token']
    monkeypatch.setenv('APP_ENV', 'production')
    get_settings.cache_clear()
    headers = {'Authorization': 'Bearer ' + token}
    assert client.post('/api/demo/seed', headers=headers).status_code == 403
    assert client.get('/api/import/1', headers=headers).status_code == 403
    assert login(client, 'demo', 'demotest-password').status_code == 401

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
