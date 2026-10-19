import json
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import sessionmaker

from app import models, schemas as s, document_models as m
from app.auth import Principal, current_principal
from app.config import get_settings
from app.db import get_db, init_db, make_engine
from app.main import app
from app.services import ai_gateway, document_intelligence as service
from app.services.analysis import get_profile

SOURCE = 'Resume\nName: Alex Synthetic\nDepartment: Computing\nSKILLS\nPython and SQL\nPROJECTS\nProject: Built a Python data tool.'


def migrate(url):
    config = Config('alembic.ini'); config.attributes['database_url'] = url
    command.upgrade(config, 'head')


@pytest.fixture
def review(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'test'); monkeypatch.setenv('DOCUMENT_REVIEW_ENABLED', 'true')
    monkeypatch.setenv('DOCUMENT_HMAC_KEY', 'synthetic-key-for-review-tests-only-12345')
    monkeypatch.setenv('GEMINI_API_KEY', 'synthetic-test-key'); monkeypatch.setenv('SERPAPI_API_KEY', '')
    get_settings.cache_clear()
    url = f'sqlite:///{tmp_path / "review.db"}'
    engine = make_engine(url); init_db(engine); migrate(url)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        student = models.Student(student_id='synthetic-one', name='Alex Synthetic', email='synth@example.org', is_synthetic=True)
        other = models.Student(student_id='synthetic-two', name='Other', email='other@example.org', is_synthetic=True)
        db.add_all([student, other]); db.flush()
        account = models.Account(username='synthetic', role='student', student_pk=student.id)
        db.add(account); db.commit()
        ids = student.id, other.id, account.id
    def database():
        with factory() as db: yield db
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[0], ids[2])
    monkeypatch.setattr(ai_gateway, 'generate_structured', lambda *args, **kwargs: pytest.fail('Unmocked provider call'))
    with TestClient(app) as client: yield client, factory, ids
    app.dependency_overrides.clear(); get_settings.cache_clear(); engine.dispose()


def create(client, source=SOURCE):
    response = client.post('/api/documents', data={'storage_consent': 'true'}, files={'file': ('resume.txt', source.encode(), 'text/plain')})
    assert response.status_code == 201, response.text
    return response.json()


def body(proposal, item, **kwargs):
    return dict(proposal_version=proposal['version'], item_version=item['version'], decision='accept', idempotency_key=str(uuid4()), **kwargs)


def decide(client, proposal, item, payload=None):
    return client.patch(f'/api/profile-update-proposals/{proposal["id"]}/items/{item["id"]}', json=payload or body(proposal, item))


def test_preview_no_storage_and_storage_gate(review, monkeypatch):
    client, factory, _ = review
    monkeypatch.setenv('DOCUMENT_REVIEW_ENABLED', 'false'); get_settings.cache_clear()
    result = client.post('/api/documents/preview', files={'file': ('resume.txt', SOURCE.encode(), 'text/plain')})
    assert result.status_code == 200 and result.json()['facts']
    assert client.post('/api/documents', data={'storage_consent': 'true'}, files={'file': ('a.txt', SOURCE.encode(), 'text/plain')}).status_code == 503
    with factory() as db: assert not db.scalars(select(m.Document)).all()


def test_accept_preserves_levels_data_audit_and_idempotency(review):
    client, factory, ids = review
    with factory() as db:
        before = get_profile(db, db.get(models.Student, ids[0])).model_dump()
    document = create(client); proposal = document['proposal']
    with factory() as db: assert get_profile(db, db.get(models.Student, ids[0])).model_dump() == before
    item = next(i for i in proposal['items'] if i['proposed_value'] == {'name': 'Python'})
    payload = body(proposal, item)
    result = decide(client, proposal, item, payload)
    assert result.status_code == 200, result.text
    result = result.json(); assert result['proposal']['refresh_recommended']
    assert result['profile']['competencies'][0]['level'] is None
    replay = decide(client, proposal, item, payload).json(); assert replay['replayed']
    assert decide(client, proposal, item, {**payload, 'decision': 'reject'}).status_code == 409
    with factory() as db:
        assert len(db.scalars(select(models.Evidence)).all()) == 1
        event = db.scalar(select(m.Audit))
        assert len(event.evidence_commitment) == 64
        assert 'Python' not in json.dumps({c.name: str(getattr(event, c.name)) for c in m.Audit.__table__.columns})
        with pytest.raises(Exception):
            db.execute(text('UPDATE profile_update_audit SET action=\'reject\'')); db.commit()
        db.rollback()
    assert client.delete(f'/api/documents/{document["id"]}').status_code == 200
    with factory() as db:
        assert db.get(m.Document, document['id']).text is None
        assert db.get(m.ProposalItem, item['id']).evidence_json is None
        assert db.scalar(select(models.Evidence)).source_ref.startswith('dil:')
        assert db.scalar(select(m.Audit))


def test_conflict_edit_reject_and_rollback(review):
    client, factory, ids = review
    proposal = create(client)['proposal']
    item = next(i for i in proposal['items'] if i['field_path'] == 'department')
    invalid = body(proposal, item); invalid.update(decision='edit', edited_value={'value': 'Invented'})
    assert decide(client, proposal, item, invalid).status_code == 422
    with factory() as db: assert db.get(models.Student, ids[0]).department is None and not db.scalar(select(m.Audit))
    reject = body(proposal, item); reject['decision'] = 'reject'
    assert decide(client, proposal, item, reject).status_code == 200
    assert decide(client, proposal, item).status_code == 409
    # Current different name is explicitly a conflict.
    document = create(client, SOURCE.replace('Alex Synthetic', 'Pat Synthetic'))
    p = document['proposal']; i = next(i for i in p['items'] if i['field_path'] == 'name')
    assert i['comparison_status'] == 'conflict'
    request = body(p, i)
    assert decide(client, p, i, request).status_code == 409
    request['confirm_conflict'] = True
    assert decide(client, p, i, request).status_code == 200
    with factory() as db: assert db.get(models.Student, ids[0]).name == 'Pat Synthetic'


def test_stale_profile_refresh_and_duplicate_upload(review):
    client, factory, ids = review
    document = create(client); p = document['proposal']; i = p['items'][0]
    assert create(client)['id'] == document['id']
    with factory() as db:
        db.get(models.Student, ids[0]).program = 'Changed elsewhere'; db.commit()
    assert decide(client, p, i).status_code == 409
    refreshed = client.post(f'/api/profile-update-proposals/{p["id"]}/refresh').json()
    assert refreshed['proposal']['id'] != p['id']
    assert decide(client, p, i).status_code == 409


@pytest.mark.parametrize('role', ['admin', 'faculty', 'other'])
def test_owner_only_all_private_routes(review, role):
    client, _, ids = review
    doc = create(client); p = doc['proposal']; i = p['items'][0]
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1]) if role == 'other' else Principal(role)
    expected = 404 if role == 'other' else 403
    assert client.get(f'/api/documents/{doc["id"]}').status_code == expected
    assert client.get(f'/api/profile-update-proposals/{p["id"]}').status_code == expected
    assert decide(client, p, i).status_code == expected
    if role != 'other': assert client.get('/api/documents').status_code == 403


def test_expiry_type_correction_and_unknown(review):
    client, factory, _ = review
    unknown = create(client, 'Random notes without a supported document marker or named facts.')
    assert not unknown['proposal']['items']
    doc = create(client)
    response = client.patch(f'/api/documents/{doc["id"]}/type', json={'document_type': 'transcript', 'version': doc['proposal']['version']})
    assert response.status_code == 200, response.text
    assert not response.json()['proposal']['items']
    with factory() as db:
        document = db.get(m.Document, doc['id']); expiry = document.expires_at
        document.expires_at = service.now() - timedelta(seconds=1); db.commit()
        service.purge_expired(db)
        assert document.text is None and document.duplicate_fingerprint is None
        assert not any(e.result_json for e in db.scalars(select(m.Extraction).where(m.Extraction.document_id == doc['id'])))
    assert client.get(f'/api/documents/{doc["id"]}').json()['status'] == 'expired'


@pytest.mark.parametrize('kind,marker', [('resume','Resume'),('certificate','Certificate'),('transcript','Transcript'),
    ('project_report','Project report'),('internship_document','Internship')])
def test_classification_and_exclusions(kind, marker):
    source = marker + '\nSkills: Python\nCGPA: 9.9\nProficiency: expert\nHonors: excellent student'
    result = service.deterministic(source, service.classify(source))
    assert result.document_type == kind
    assert all(f.field not in {'cgpa', 'proficiency', 'honors'} for f in result.facts)
    if kind == 'transcript': assert not result.facts


def test_source_verification_rejects_ambiguous_unsupported_and_hallucination():
    fact = s.DocumentFact(id='fact-1', field='skills', value={'name':'Python'}, evidence=[{'excerpt':'Skills: Python'}])
    assert service.verified('Skills: Python', 'resume', fact)
    assert not service.verified('Skills: Python\nSkills: Python', 'resume', fact)
    assert not service.verified('Skills: SQL', 'resume', fact)
    fact.value.name = 'Docker'; assert not service.verified('Skills: Python', 'resume', fact)
    for value in [{'name':'Python','level':5}, {'value':'Python', 'achievement':'invented'}]:
        with pytest.raises(ValueError): s.DocumentFact(id='fact-1', field='skills', value=value, evidence=[{'excerpt':'Python'}])


@pytest.mark.parametrize('mode,status', [('valid','available'),('malformed','invalid_output'),('blocked','blocked'),('timeout','timeout'),('quota','quota_limit')])
def test_mocked_extraction_failures_preserve_profile(review, monkeypatch, mode, status):
    client, factory, ids = review
    doc = create(client); p = doc['proposal']
    response = service.deterministic(SOURCE, 'resume').model_dump(mode='json')
    def generate(*args, **kwargs):
        if mode == 'timeout': raise TimeoutError('private document')
        if mode == 'quota':
            error = RuntimeError('secret'); error.code = 429; raise error
        return SimpleNamespace(text=None if mode == 'blocked' else ('{}' if mode == 'malformed' else json.dumps(response)))
    monkeypatch.setattr(ai_gateway, 'generate_structured', generate)
    assert client.post(f'/api/documents/{doc["id"]}/extract', json={'ai_consent': False,'version': p['version']}).status_code == 422
    result = client.post(f'/api/documents/{doc["id"]}/extract', json={'ai_consent': True,'version': p['version']})
    assert result.status_code == 200, result.text
    assert result.json()['extraction_status'] == status
    assert result.json()['proposal']['items']
    with factory() as db:
        assert not db.scalar(select(models.Evidence))
        assert db.get(models.Student, ids[0]).department is None


def test_populated_sqlite_additive_migration_preserves_every_existing_table(tmp_path):
    import sqlite3
    from app.services.demo_seed import seed_demo
    from sqlalchemy import inspect
    from sqlalchemy.orm import Session
    path = tmp_path / 'synthetic-original.db'; url = f'sqlite:///{path}'
    engine = make_engine(url); init_db(engine)
    with Session(engine) as db: seed_demo(db)
    tables = inspect(engine).get_table_names()
    with engine.connect() as conn:
        before = {t: conn.execute(text(f'SELECT * FROM "{t}"')).fetchall() for t in tables}
    engine.dispose()
    copy = tmp_path / 'synthetic-copy.db'
    with sqlite3.connect(path) as original, sqlite3.connect(copy) as target: original.backup(target)
    migrate(f'sqlite:///{copy}'); migrate(f'sqlite:///{copy}')
    migrated = make_engine(f'sqlite:///{copy}')
    with migrated.connect() as conn:
        assert conn.execute(text('PRAGMA integrity_check')).scalar() == 'ok'
        assert conn.execute(text('PRAGMA foreign_key_check')).fetchall() == []
        for t in tables: assert conn.execute(text(f'SELECT * FROM "{t}"')).fetchall() == before[t]
        assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar() == '20261019_01'
    migrated.dispose()


def test_transaction_failure_rolls_back_profile_evidence_and_decision(review, monkeypatch):
    from sqlalchemy import event
    client, factory, ids = review
    p = create(client)['proposal']; i = next(x for x in p['items'] if x['field_path'] == 'department')
    def fail_audit(*args): raise RuntimeError('synthetic failed persistence')
    event.listen(m.Audit, 'before_insert', fail_audit)
    try:
        with pytest.raises(RuntimeError): decide(client, p, i)
    finally: event.remove(m.Audit, 'before_insert', fail_audit)
    with factory() as db:
        assert db.get(models.Student, ids[0]).department is None
        assert not db.scalar(select(models.Evidence))
        assert db.get(m.ProposalItem, i['id']).decision == 'pending'


def test_concurrent_approval_applies_once(review):
    from concurrent.futures import ThreadPoolExecutor
    client, factory, ids = review
    p = create(client)['proposal']; i = next(x for x in p['items'] if x['field_path'] == 'department')
    request = s.DocumentDecisionIn.model_validate(body(p, i))
    def apply():
        with factory() as db: return service.decide(db, ids[0], ids[2], p['id'], i['id'], request)['replayed']
    with ThreadPoolExecutor(max_workers=2) as pool: results = list(pool.map(lambda _: apply(), range(2)))
    assert sorted(results) == [False, True]
    with factory() as db: assert len(db.scalars(select(models.Evidence)).all()) == 1
