"""Synthetic-only integration tests using actual accounts and signed sessions."""
from datetime import date, timedelta
import csv
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from app import models as m
from app.auth import hash_password
from app.config import get_settings
from app.db import get_db, init_db, make_engine
from app.main import create_app


@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'test')
    monkeypatch.setenv('AUTH_SIGNING_KEY', 'synthetic-signing-key-' * 3)
    monkeypatch.setenv('DEMO_LOGIN_BYPASS', 'false')
    monkeypatch.setenv('SERPAPI_API_KEY', '')
    monkeypatch.setenv('GEMINI_API_KEY', '')
    get_settings.cache_clear()
    engine = make_engine(f'sqlite:///{tmp_path / "placement.db"}')
    init_db(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as db:
        first = m.Student(student_id='SYN-A', name='=Synthetic Alice', email='alice@example.org', department='CSE', program='BTech', semester=5, cgpa=8, graduation_year=2028, is_synthetic=True)
        second = m.Student(student_id='SYN-B', name='Synthetic Bob', email='bob@example.org', department='ECE', is_synthetic=True)
        third = m.Student(student_id='SYN-C', name='Synthetic Chris', email='chris@example.org', department='CSE', is_synthetic=True)
        db.add_all([first, second, third]); db.flush()
        password = hash_password('synthetic-password')
        admin = m.Account(username='faculty-a', role='admin', password_hash=password)
        other = m.Account(username='faculty-b', role='admin', password_hash=password)
        a = m.Account(username='alice', role='student', student_pk=first.id, password_hash=password)
        b = m.Account(username='bob', role='student', student_pk=second.id, password_hash=password)
        db.add_all([admin, other, a, b]); db.flush()
        cohort = m.Cohort(admin_id=admin.id, name='CSE 2028 A', department='CSE', batch='2028', section='A')
        foreign = m.Cohort(admin_id=other.id, name='ECE B', department='ECE', batch='2028', section='B')
        db.add_all([cohort, foreign]); db.flush()
        db.add_all([m.FacultyScope(admin_id=admin.id, student_pk=first.id), m.FacultyScope(admin_id=admin.id, student_pk=third.id),
            m.FacultyScope(admin_id=other.id, student_pk=second.id), m.CohortMember(cohort_id=cohort.id, student_pk=first.id),
            m.CohortMember(cohort_id=cohort.id, student_pk=third.id), m.CohortMember(cohort_id=foreign.id, student_pk=second.id),
            m.StudentPlacementMeta(student_pk=first.id, batch='2028', section='A')])
        sql = m.Skill(canonical_name='SQL'); db.add(sql); db.flush()
        role = m.Job(title='Synthetic SQL role', is_seeded=True); db.add(role); db.flush()
        db.add(m.JobSkill(job_id=role.id, skill_id=sql.id, requirement_type='required', expected_level=4, importance=1))
        db.add(m.StudentSkill(student_pk=first.id, skill_id=sql.id, level=2, confidence=.7, evidence_ids=[]))
        db.commit()
        ids = dict(student=first.id, other_student=second.id, third=third.id, admin=admin.id, other_admin=other.id, cohort=cohort.id, foreign_cohort=foreign.id, role=role.id, skill=sql.id)
    app = create_app()
    def database():
        with maker() as db: yield db
    app.dependency_overrides[get_db] = database
    # Startup points at the isolated test engine as well.
    monkeypatch.setattr('app.main.init_db', lambda: init_db(engine))
    with TestClient(app) as client:
        auth = {}
        for name in ['faculty-a', 'faculty-b', 'alice', 'bob']:
            result = client.post('/api/auth/login', json={'username': name, 'password': 'synthetic-password'})
            assert result.status_code == 200, result.text
            auth[name] = {'Authorization': 'Bearer ' + result.json()['access_token']}
        yield client, maker, ids, auth
    engine.dispose(); get_settings.cache_clear()


def test_accounts_server_roles_and_session_revocation(setup):
    api, maker, ids, auth = setup
    assert api.get('/api/admin/dashboard').status_code == 401  # test env has no bypass
    assert api.get('/api/admin/dashboard', headers=auth['alice']).status_code == 403
    assert api.get('/api/auth/me', headers=auth['faculty-a']).json()['role'] == 'admin'
    assert api.get('/api/auth/me', headers=auth['alice']).json()['student_id'] == ids['student']
    body = dict(username='new-student', password='synthetic-password', student_id='SYN-NEW', name='Synthetic New', email='new@example.org', department='CSE')
    assert api.post('/api/auth/signup', json={**body, 'role': 'admin'}).status_code == 422
    signed = api.post('/api/auth/signup', json=body)
    assert signed.status_code == 201 and signed.json()['role'] == 'student'
    token = {'Authorization': 'Bearer ' + signed.json()['access_token']}
    assert api.get('/api/placement/journey', headers=token).status_code == 200
    assert api.get('/api/admin/dashboard', headers=token).status_code == 403
    assert api.post('/api/auth/logout', headers=token).status_code == 200
    assert api.get('/api/auth/me', headers=token).status_code == 401
    assert api.post('/api/auth/login', json={**{'username': 'alice', 'password': 'synthetic-password'}, 'role': 'admin'}).status_code == 422
    with maker() as db:
        account = db.get(m.Account, ids['admin']); account.role = 'student'; db.commit()
    assert api.get('/api/admin/dashboard', headers=auth['faculty-a']).status_code == 401


def test_demo_fixtures_populate_stats_idempotently_and_stay_owner_scoped(setup):
    api, maker, ids, auth = setup
    headers = auth['faculty-a']
    assert api.post('/api/admin/demo').status_code == 401
    assert api.post('/api/admin/demo', headers=auth['alice']).status_code == 403
    demo = api.post('/api/admin/demo', headers=headers)
    assert demo.status_code == 200, demo.text
    body = demo.json()
    assert body['provenance'] == 'demo_fixture'
    scope = f'?cohort_id={body["cohort_id"]}'
    stats = api.get('/api/admin/dashboard' + scope, headers=headers).json()['metrics']
    assert stats['assigned_students'] == 6
    assert stats['profile_complete'] == 5
    assert stats['students_assessed'] == 4 and stats['assessment_attempts'] == 4
    assert stats['training_total'] == 6 and stats['training_completed'] == 2
    assert stats['applications'] == 6 and stats['offers'] == 1
    assert stats['resumes_submitted'] == 2 and stats['resumes_approved'] == 2
    assert stats['resumes_changes_requested'] == 1
    gap = api.get(f'/api/admin/skill-gaps{scope}&job_id={body["job_id"]}', headers=headers).json()
    sql = next(x for x in gap['skills'] if x['skill']['canonical_name'] == 'SQL')
    assert sql['known_count'] == 4 and sql['unknown_count'] == 2
    assert sql['missing_assessment_count'] == 2
    detail = api.get(f'/api/admin/students/{body["student_id"]}', headers=headers).json()
    assert detail['profile']['student']['is_synthetic']
    assert detail['reviews'] and detail['training'] and detail['applications'] and detail['assessments']
    assert detail['roadmap'][0]['resource_provenance'] == 'demo_fixture'
    models = (m.Student, m.Account, m.Evidence, m.Assessment, m.TrainingAssignment,
              m.PlacementApplication, m.PlacementDrive, m.FacultyResumeReview, m.ResumeRevision)
    with maker() as db:
        counts = [len(list(db.scalars(select(model)))) for model in models]
    again = api.post('/api/admin/demo', headers=headers)
    assert again.status_code == 200 and again.json() == body
    with maker() as db:
        assert [len(list(db.scalars(select(model)))) for model in models] == counts
        assert db.get(m.Student, ids['student']).name == '=Synthetic Alice'
    assert api.get('/api/admin/dashboard' + scope, headers=headers).json()['metrics'] == stats
    other = api.post('/api/admin/demo', headers=auth['faculty-b']).json()
    assert other['cohort_id'] != body['cohort_id'] and other['student_id'] != body['student_id']
    assert api.get('/api/admin/dashboard' + scope, headers=auth['faculty-b']).status_code == 404
    assert api.get(f'/api/admin/students/{body["student_id"]}', headers=auth['faculty-b']).status_code == 403
    report = api.get('/api/admin/report' + scope, headers=headers)
    assert report.status_code == 200
    rows = list(csv.reader(io.StringIO(report.text)))
    assert len(rows) == 7 and all('DEMO-FACULTY-' in row[0] for row in rows[1:])


def test_demo_fixtures_disabled_in_production(setup, monkeypatch):
    api, _, _, auth = setup
    monkeypatch.setenv('APP_ENV', 'production')
    get_settings.cache_clear()
    try:
        assert api.post('/api/admin/demo', headers=auth['faculty-a']).status_code == 404
    finally:
        monkeypatch.setenv('APP_ENV', 'test')
        get_settings.cache_clear()


def test_demo_identity_conflict_preserves_existing_records(setup):
    api, maker, ids, auth = setup
    with maker() as db:
        student = db.get(m.Student, ids['student'])
        student.student_id = f'DEMO-FACULTY-{ids["admin"]}-01'
        student.is_synthetic = False
        db.commit()
    result = api.post('/api/admin/demo', headers=auth['faculty-a'])
    assert result.status_code == 409
    with maker() as db:
        assert db.get(m.Student, ids['student']).name == '=Synthetic Alice'
        assert not db.get(m.Student, ids['student']).is_synthetic
        assert not db.scalar(select(m.Cohort.id).where(m.Cohort.name == 'Demo fixtures - placement workspace'))
        assert not db.scalar(select(m.PlacementDrive.id))


def test_scope_search_pagination_and_dashboard(setup):
    api, _, ids, auth = setup
    headers = auth['faculty-a']
    result = api.get('/api/admin/students?page_size=1', headers=headers)
    assert result.status_code == 200 and result.json()['total'] == 2 and len(result.json()['items']) == 1
    assert api.get('/api/admin/students?page_size=101', headers=headers).status_code == 422
    assert api.get('/api/admin/students?q=Bob', headers=headers).json()['total'] == 0
    assert api.get('/api/admin/students?batch=2028&section=A', headers=headers).json()['total'] == 1
    assert api.get(f'/api/admin/students/{ids["other_student"]}', headers=headers).status_code == 403
    assert api.get(f'/api/profile/{ids["other_student"]}', headers=auth['alice']).status_code == 403
    assert api.get(f'/api/admin/dashboard?cohort_id={ids["foreign_cohort"]}', headers=headers).status_code == 404
    dash = api.get('/api/admin/dashboard', headers=headers).json()
    assert dash['metrics']['assigned_students'] == 2 and dash['metrics']['offers'] == 0
    assert dash['metrics']['profile_complete'] == 1 and dash['metrics']['students_assessed'] == 0


def test_batch_gaps_unknown_and_assessment_drill_down(setup):
    api, _, ids, auth = setup
    path = f'/api/admin/skill-gaps?cohort_id={ids["cohort"]}&job_id={ids["role"]}'
    result = api.get(path, headers=auth['faculty-a'])
    assert result.status_code == 200, result.text
    sql = result.json()['skills'][0]
    assert sql['mean_proficiency'] == 2 and sql['common_gap_count'] == 1 and sql['unknown_count'] == 1
    assert sql['gap_student_ids'] == [ids['student']] and sql['unknown_student_ids'] == [ids['third']]
    assert sql['mean_assessed_proficiency'] is None and sql['missing_assessment_count'] == 2
    assert api.get(path, headers=auth['faculty-b']).status_code == 404


def make_resume(api, headers):
    result = api.post('/api/resumes', headers=headers, json={'text': 'Synthetic Alice\nSKILLS\nSQL\nPROJECTS\nBuilt a SQL practice project.', 'storage_consent': True})
    assert result.status_code == 201, result.text
    return result.json()


def test_explicit_revision_sharing_history_and_permissions(setup):
    api, maker, ids, auth = setup
    resume = make_resume(api, auth['alice'])
    assert not api.get(f'/api/admin/students/{ids["student"]}', headers=auth['faculty-a']).json()['reviews']
    body = dict(workspace_id=resume['id'], version=resume['version'], admin_id=ids['admin'], consent=True)
    assert api.post('/api/placement/resume-reviews', headers=auth['alice'], json={**body, 'consent': False}).status_code == 422
    assert api.post('/api/placement/resume-reviews', headers=auth['bob'], json=body).status_code == 404
    assert api.post('/api/placement/resume-reviews', headers=auth['alice'], json={**body, 'admin_id': ids['other_admin']}).status_code == 403
    shared = api.post('/api/placement/resume-reviews', headers=auth['alice'], json=body)
    assert shared.status_code == 201, shared.text
    review = shared.json()
    assert review['suggestions'] is None
    assert api.post('/api/placement/resume-reviews', headers=auth['alice'], json=body).status_code == 409
    revised = api.put(f'/api/resumes/{resume["id"]}/revision', headers=auth['alice'], json={'version': resume['version'], 'text': resume['revised_text'] + '\nEDUCATION\nSynthetic degree', 'factual_confirmation': True})
    assert revised.status_code == 200
    view = api.get(f'/api/admin/students/{ids["student"]}', headers=auth['faculty-a']).json()['reviews'][0]
    assert view['text'] == resume['revised_text'] and view['version'] == resume['version']
    decision = {'status': 'changes_requested', 'feedback': 'Add clearer project context.'}
    assert api.post(f'/api/admin/resume-reviews/{review["id"]}', headers=auth['faculty-b'], json=decision).status_code == 404
    assert api.post(f'/api/admin/resume-reviews/{review["id"]}', headers=auth['alice'], json=decision).status_code == 403
    decided = api.post(f'/api/admin/resume-reviews/{review["id"]}', headers=auth['faculty-a'], json=decision)
    assert decided.status_code == 200 and decided.json()['feedback'][0]['feedback'] == decision['feedback']
    assert api.post(f'/api/admin/resume-reviews/{review["id"]}', headers=auth['faculty-a'], json=decision).status_code == 409
    again = api.post('/api/placement/resume-reviews', headers=auth['alice'], json={**body, 'version': revised.json()['version']}).json()
    approved = api.post(f'/api/admin/resume-reviews/{again["id"]}', headers=auth['faculty-a'], json={'status': 'approved', 'feedback': 'Reviewed the saved revision.'})
    assert approved.status_code == 200
    revisions = api.get(f'/api/placement/resume-revisions/{resume["id"]}', headers=auth['alice']).json()
    assert len(revisions) == 2
    assert api.get(f'/api/resumes/{resume["id"]}', headers=auth['faculty-a']).status_code == 403
    assert api.delete(f'/api/placement/resume-reviews/{again["id"]}', headers=auth['alice']).status_code == 200
    views = api.get(f'/api/admin/students/{ids["student"]}', headers=auth['faculty-a']).json()['reviews']
    assert len(views) == 1 and views[0]['status'] == 'changes_requested'
    with maker() as db:
        assert db.get(m.ResumeWorkspace, resume['id']).revised_text == revised.json()['revised_text']
        assert db.query(m.AdminAudit).filter_by(action='resume_approved').count() == 1


def test_training_assignment_scope_evidence_assessment_and_progress(setup):
    api, _, ids, auth = setup
    body = dict(student_ids=[], cohort_id=ids['cohort'], title='Synthetic SQL assessment', kind='assessment', skill_id=ids['skill'], deadline=str(date.today()-timedelta(days=1)))
    result = api.post('/api/admin/training', headers=auth['faculty-a'], json=body)
    assert result.status_code == 201 and len(result.json()) == 2, result.text
    item = next(x for x in result.json() if x['student_pk'] == ids['student'])
    assert api.post('/api/admin/training', headers=auth['faculty-b'], json=body).status_code == 404
    assert api.post('/api/admin/training', headers=auth['faculty-a'], json={**body, 'student_ids': [ids['other_student']]}).status_code == 403
    update = dict(version=item['version'], status='completed', evidence='Synthetic quiz completion')
    assert api.patch(f'/api/placement/training/{item["id"]}', headers=auth['bob'], json=update).status_code == 404
    assert api.patch(f'/api/placement/training/{item["id"]}', headers=auth['alice'], json=update).status_code == 422
    quiz = api.post('/api/assessment/submit', headers=auth['alice'], json={'student_id': ids['student'], 'skill_id': ids['skill'], 'question_set_version': 'sql-basics-v1', 'answers': {'q1': 'WHERE', 'q2': 'INNER JOIN', 'q3': 'DISTINCT'}})
    assert quiz.status_code == 200
    assert api.patch(f'/api/placement/training/{item["id"]}', headers=auth['alice'], json={**update, 'evidence': ''}).status_code == 422
    assert api.patch(f'/api/placement/training/{item["id"]}', headers=auth['alice'], json=update).status_code == 200
    assert api.patch(f'/api/placement/training/{item["id"]}', headers=auth['alice'], json=update).status_code == 409
    dash = api.get('/api/admin/dashboard', headers=auth['faculty-a']).json()['metrics']
    assert dash['training_completed'] == 1 and dash['overdue_training'] == 1 and dash['students_assessed'] == 1


def create_drive(api, ids, auth):
    body = dict(cohort_id=ids['cohort'], company='Synthetic Company', role='SQL trainee', description='Synthetic placement drive for tests',
        deadline=str(date.today()+timedelta(days=7)), application_link='https://example.org/apply', eligibility={'min_cgpa': 8.5})
    result = api.post('/api/admin/drives', headers=auth['faculty-a'], json=body)
    assert result.status_code == 201, result.text
    return result.json(), body


def test_jobs_eligibility_application_history_and_outcomes(setup):
    api, _, ids, auth = setup
    drive, body = create_drive(api, ids, auth)
    assert api.get('/api/placement/drives', headers=auth['bob']).json() == []
    available = api.get('/api/placement/drives', headers=auth['alice']).json()[0]
    assert available['decision']['status'] == 'not_eligible' and '8.0' in available['decision']['reasons'][0]
    assert api.put(f'/api/admin/drives/{drive["id"]}', headers=auth['faculty-b'], json={**body, 'version': drive['version']}).status_code == 404
    assert api.put(f'/api/admin/drives/{drive["id"]}', headers=auth['faculty-a'], json={**body, 'version': 99}).status_code == 409
    result = api.post(f'/api/placement/drives/{drive["id"]}/apply', headers=auth['alice'])
    assert result.status_code == 201, result.text
    item = result.json()
    assert api.post(f'/api/placement/drives/{drive["id"]}/apply', headers=auth['bob']).status_code == 404
    assert api.post(f'/api/placement/drives/{drive["id"]}/apply', headers=auth['alice']).status_code == 409
    payload = dict(version=1, stage='offered', note='Synthetic offer explicitly confirmed')
    assert api.patch(f'/api/admin/applications/{item["id"]}', headers=auth['alice'], json=payload).status_code == 403
    assert api.patch(f'/api/placement/applications/{item["id"]}', headers=auth['bob'], json=payload).status_code == 403
    assert api.patch(f'/api/admin/applications/{item["id"]}', headers=auth['faculty-b'], json=payload).status_code == 404
    assert api.patch(f'/api/admin/applications/{item["id"]}', headers=auth['faculty-a'], json={**payload, 'eligibility_override': True}).status_code == 422
    outcome = api.patch(f'/api/admin/applications/{item["id"]}', headers=auth['faculty-a'], json={**payload, 'eligibility_override': True, 'review_reason': 'Synthetic exception approved'})
    assert outcome.status_code == 200 and len(outcome.json()['history']) == 2
    assert api.get('/api/admin/dashboard', headers=auth['faculty-a']).json()['metrics']['students_offered'] == 1
    assert api.get('/api/placement/applications', headers=auth['bob']).json() == []


def test_import_scope_validation_duplicates_and_export_formula_safety(setup):
    api, maker, ids, auth = setup
    data = b'student_id,name,email,department,batch,section\nSYN-D,Synthetic Dana,dana@example.org,CSE,2028,A\nSYN-B,Outside,bob@example.org,ECE,2028,B\nSYN-E,Invalid,bad-email,CSE,2028,A\nSYN-A,=Synthetic Updated,alice@example.org,CSE,2028,A\n'
    uploaded = api.post(f'/api/import/upload?cohort_id={ids["cohort"]}', headers=auth['faculty-a'], files={'file': ('synthetic.csv', data, 'text/csv')})
    assert uploaded.status_code == 200, uploaded.text
    info = uploaded.json(); job = info['job_id']
    assert api.get(f'/api/import/{job}', headers=auth['faculty-b']).status_code == 404
    assert api.post('/api/import/confirm', headers=auth['faculty-a'], json={'job_id': job}).status_code == 409
    preview = api.post('/api/import/preview', headers=auth['faculty-a'], json={'job_id': job, 'mapping': info['suggested_mapping']})
    assert preview.status_code == 200
    assert preview.json()['job']['error_rows'] == 2
    assert any(x['row_number'] == 3 and x['issue_code'] == 'SCOPE_MISMATCH' for x in preview.json()['issues'])
    confirmed = api.post('/api/import/confirm', headers=auth['faculty-a'], json={'job_id': job, 'update_duplicates': True})
    assert confirmed.status_code == 200 and confirmed.json()['job']['imported_rows'] == 2, confirmed.text
    with maker() as db:
        assert db.get(m.Student, ids['other_student']).name == 'Synthetic Bob'
        dana = db.scalar(select(m.Student).where(m.Student.student_id == 'SYN-D'))
        assert db.get(m.FacultyScope, (ids['admin'], dana.id))
        assert db.scalar(select(m.Account).where(m.Account.student_pk == dana.id)).role == 'student'
        assert db.query(m.AdminAudit).filter_by(action='import_confirmed').count() == 1
    exported = api.get(f'/api/admin/report?cohort_id={ids["cohort"]}&job_id={ids["role"]}', headers=auth['faculty-a'])
    assert exported.status_code == 200 and exported.headers['cache-control'] == 'no-store'
    rows = list(csv.DictReader(io.StringIO(exported.text)))
    alice = next(x for x in rows if x['student_id'] == 'SYN-A')
    assert alice['name'].startswith("'=") and 'SQL:2' in alice['known_skill_gaps']
    assert 'bob@example.org' not in exported.text and 'Synthetic Bob' not in exported.text
    assert api.get(f'/api/admin/report?cohort_id={ids["foreign_cohort"]}', headers=auth['faculty-a']).status_code == 404


def test_additive_upgrade_preserves_students_and_disables_backfilled_login(tmp_path):
    engine = make_engine(f'sqlite:///{tmp_path / "upgrade.db"}')
    m.Student.__table__.create(engine)
    from sqlalchemy.orm import Session
    with Session(engine) as db:
        db.add(m.Student(student_id='LEGACY-SYN', name='Synthetic Legacy', email='legacy@example.org')); db.commit()
    init_db(engine); init_db(engine)
    with Session(engine) as db:
        assert db.query(m.Student).one().name == 'Synthetic Legacy'
        account = db.query(m.Account).one()
        assert account.role == 'student' and account.password_hash is None
    engine.dispose()


def test_login_throttle_and_validation_never_echo_passwords(setup):
    api, maker, _, _ = setup
    secret = 'synthetic-only-sensitive-password'
    invalid = api.post('/api/auth/login', json={'username': 'alice', 'password': secret, 'role': 'admin'})
    assert invalid.status_code == 422 and secret not in invalid.text
    with maker() as db:
        item = db.query(m.AuthRateLimit).one(); item.attempts = 30; db.commit()
    result = api.post('/api/auth/login', json={'username': 'alice', 'password': secret})
    assert result.status_code == 429 and result.headers['retry-after'] == '900' and secret not in result.text


def test_local_account_command_prompts_and_grants_explicitly(setup, monkeypatch):
    _, maker, ids, _ = setup
    from scripts import manage_accounts
    monkeypatch.setattr(manage_accounts, 'SessionLocal', maker)
    monkeypatch.setattr(manage_accounts, 'init_db', lambda: None)
    monkeypatch.setattr(manage_accounts, 'getpass', lambda _: 'synthetic-new-password')
    monkeypatch.setattr('sys.argv', ['manage_accounts', 'create-admin', '--username', 'new-faculty'])
    manage_accounts.main()
    with maker() as db:
        account = db.scalar(select(m.Account).where(m.Account.username == 'new-faculty'))
        assert account.role == 'admin' and 'synthetic-new-password' not in account.password_hash
        assert not list(db.scalars(select(m.FacultyScope).where(m.FacultyScope.admin_id == account.id)))
        account_id = account.id
    monkeypatch.setattr('sys.argv', ['manage_accounts', 'grant', '--username', 'new-faculty', '--student-id', 'SYN-A', '--cohort', 'CSE 2028 A', '--department', 'CSE', '--batch', '2028', '--section', 'A'])
    manage_accounts.main()
    with maker() as db:
        assert db.get(m.FacultyScope, (account_id, ids['student']))
        assert db.query(m.FacultyScope).filter_by(admin_id=account_id).count() == 1
    monkeypatch.setattr('sys.argv', ['manage_accounts', 'create-admin', '--username', 'alice'])
    with pytest.raises(SystemExit): manage_accounts.main()
    with maker() as db:
        assert db.query(m.Account).filter_by(username='alice').one().role == 'student'


@pytest.mark.parametrize('value', ['=1+2', ' +SUM(A1)', '-2', '@cmd', '\tformula', '\rformula', '\nformula'])
def test_csv_formula_prefixes(value):
    from app.routes.placement import csv_safe
    assert csv_safe(value).startswith("'")
