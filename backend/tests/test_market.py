"""Analytics and upload acceptance against synthetic, explicitly labelled fixtures."""
import asyncio
from datetime import timedelta
from io import BytesIO
import zipfile

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import models
from app.auth import Principal, current_principal
from app.config import Settings, get_settings
from app.db import get_db, init_db, make_engine
from app.main import app
from app.schemas import JobSearchIn, MarketFilter
from app.services import job_discovery, market
from app.services.demo_seed import seed_demo
from app.services.analysis import analyze
from app.services.learning import create_roadmap
from app.services.resume_files import parse_resume, DOCX_MIME, MAX_RESUME_BYTES
from app.services.serpapi import SearchFailure


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'test'); monkeypatch.setenv('SERPAPI_API_KEY', '')
    get_settings.cache_clear()
    engine = make_engine(f'sqlite:///{tmp_path / "market.db"}')
    init_db(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    def override():
        with factory() as session:
            yield session
    app.dependency_overrides[get_db] = override
    with factory() as session:
        yield session
    app.dependency_overrides.clear(); get_settings.cache_clear(); engine.dispose()


def collect(db, role='Data Engineer', location='Chennai', records=None):
    records = records if records is not None else [
        {'job_id': 'fixture-a', 'title': 'Data Engineer fixture', 'company_name': 'Synthetic', 'location': 'Chennai',
         'description': 'Requirements:\nPython (5/5), Postgres, PostgreSQL, and SQL required.\nPreferred:\nDocker',
         'share_link': 'https://example.org/a?utm_source=fixture'},
        {'job_id': 'fixture-b', 'title': 'Engineer fixture', 'description': 'Qualifications:\nPython and SQL required.',
         'share_link': 'https://example.org/b'}]
    return asyncio.run(job_discovery.search_jobs(db, JobSearchIn(role=role, location=location),
        Settings(_env_file=None, serpapi_api_key='fixture-secret'), httpx.MockTransport(lambda _: httpx.Response(200,
            json={'provenance': 'demo_fixture', 'jobs_results': records}))))


def docx(text):
    content = BytesIO()
    with zipfile.ZipFile(content, 'w') as archive:
        archive.writestr('word/document.xml', f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>')
    return content.getvalue()


def test_distinct_counts_aliases_versions_and_cross_scope_duplicates(db):
    first = collect(db)
    collect(db, role='Python Developer', records=[
        {'job_id': 'fixture-a', 'title': 'Data Engineer fixture', 'description': 'Requirements:\nPython (5/5) and SQL required. Docker preferred.', 'share_link': 'https://example.org/a?utm_source=other'},
        {'job_id': 'different-provider-id', 'title': 'Duplicate on another scope', 'description': 'Requirements:\nPython and SQL required.', 'share_link': 'https://example.org/b#application'}])
    out = market.demand(db, MarketFilter())
    assert out.sample_size == 2 and out.collection_count == 2
    assert next(s for s in out.skills if s.name == 'Python').demand_percentage == 100
    assert all(s.distinct_job_count <= out.sample_size for s in out.skills)
    original = market.demand(db, MarketFilter(role=' DATA ENGINEER ', location='chennai'))
    assert original.sample_size == 2
    postgres = next(s for s in original.skills if s.name == 'PostgreSQL')
    assert postgres.distinct_job_count == 1 and postgres.demand_percentage == 50
    assert postgres.required_count == 1
    assert len(postgres.job_ids) == 1 and postgres.job_ids[0] == first.jobs[0].id


def test_filters_dates_empty_unknown_and_role_comparison(db):
    first = collect(db)
    collect(db, role='SQL Analyst', location='Delhi', records=[{'job_id':'fixture-c','title':'Analyst fixture','description':'Requirements:\nSQL required.'}])
    assert market.demand(db, MarketFilter(role='SQL Analyst', location='Chennai')).sample_size == 0
    assert market.demand(db, MarketFilter(location='Delhi')).sample_size == 1
    assert market.demand(db, MarketFilter(collected_after=first.retrieved_at + timedelta(days=1))).sample_size == 0
    assert market.demand(db, MarketFilter(collected_before=first.retrieved_at - timedelta(days=1))).last_collected_at is None
    with pytest.raises(SearchFailure):
        market.demand(db, MarketFilter(collected_after=first.retrieved_at, collected_before=first.retrieved_at - timedelta(days=1)))
    compared = market.compare(db, ['Data Engineer', 'SQL Analyst', 'Uncollected'], MarketFilter())
    python = next(r for r in compared.rows if r.name == 'Python')
    assert python.percentages == {'data engineer':100, 'sql analyst':0, 'uncollected':None}
    assert market.demand(db, MarketFilter(role='Data Engineer')).data_status == 'insufficient'
    with pytest.raises(SearchFailure):
        market.compare(db, ['Data Engineer', 'data engineer'], MarketFilter())
    assert len(market.scopes(db).roles) == 2


def test_empty_listings_and_no_skills_are_not_zero_market_demand(db):
    collect(db, records=[])
    out = market.demand(db, MarketFilter())
    assert out.sample_size == 0 and out.skills == [] and out.data_status == 'empty'
    collect(db, role='Other', records=[{'job_id':'fixture-other', 'title':'Other fixture', 'description':'An opportunity to make an impact.'}])
    out = market.demand(db, MarketFilter(role='Other'))
    assert out.sample_size == 1 and not out.skills and out.data_status == 'insufficient'


def test_personal_statuses_priorities_and_existing_progress(db):
    listing = collect(db).jobs[0]
    student, _ = seed_demo(db)
    sql = db.scalar(select(models.StudentSkill).join(models.Skill).where(models.Skill.canonical_name == 'SQL'))
    sql.level = 0
    db.commit()
    out = market.personal(db, student, MarketFilter(role='Data Engineer'))
    skills = {s.name: s for s in out.skills}
    assert skills['Python'].status == 'present' and skills['Python'].competency_percentage == 80
    assert skills['Python'].action == 'learn' and skills['Python'].expected_level == 5
    assert skills['SQL'].status == 'missing' and skills['SQL'].competency_percentage == 0
    assert skills['Docker'].status == 'unverified' and skills['Docker'].competency_percentage is None
    assert skills['PostgreSQL'].current_level is None and skills['PostgreSQL'].action == 'assess'
    assert out.coverage_percentage == 25 and out.evidenced_skill_count == 1
    assert out.skills[0].priority_score >= out.skills[-1].priority_score
    assert all(s.resources[0].provenance.value == 'curated_fallback' for s in out.skills)
    analysis = analyze(db, student, db.get(models.Job, listing.id))
    tasks = asyncio.run(create_roadmap(db, student, db.get(models.Analysis, analysis.id), Settings(_env_file=None, serpapi_api_key='')))
    assert all('distinct collected jobs' in t.objective for t in tasks)
    task = db.get(models.RoadmapItem, tasks[0].id)
    task.status = 'done'; task.completion_evidence = 'Synthetic documented exercise'; db.commit()
    refreshed = market.personal(db, student, MarketFilter(role='Data Engineer'))
    assert any(t.status.value == 'done' for s in refreshed.skills for t in s.roadmap_items)
    assert db.get(models.RoadmapItem, task.id).completion_evidence == 'Synthetic documented exercise'
    empty = market.personal(db, student, MarketFilter(role='Uncollected'))
    assert empty.coverage_percentage is None


def test_api_filters_me_ownership_and_no_provider_chart_calls(db, monkeypatch):
    collect(db); student, _ = seed_demo(db)
    app.dependency_overrides[current_principal] = lambda: Principal('student', student.id)
    async def forbidden(*args, **kwargs):
        raise AssertionError('Charts must not call the provider')
    monkeypatch.setattr(job_discovery, 'request_search', forbidden)
    with TestClient(app) as api:
        assert api.get('/api/market/skills', params={'role':'Data Engineer','location':'Chennai'}).json()['sample_size'] == 2
        assert api.get('/api/market/skills', params={'role':'Data Engineer','location':'Delhi'}).json()['sample_size'] == 0
        assert api.get('/api/market/skills/me', params={'student_id': student.id + 1}).json()['student_id'] == student.id
        assert api.get('/api/market/skills/compare', params={'roles':'Data Engineer,Missing'}).status_code == 200
        assert api.get('/api/market/skills/compare', params={'roles':'Data Engineer'}).status_code == 422
        assert api.get('/api/market/skills', params={'collected_after':'not-a-date'}).status_code == 422
        assert api.get('/api/market/scopes').status_code == 200
        app.dependency_overrides[current_principal] = lambda: Principal('admin')
        assert api.get('/api/market/skills/me').status_code == 403
        app.dependency_overrides.pop(current_principal)
        monkeypatch.setenv('APP_ENV','development'); get_settings.cache_clear()
        assert api.get('/api/market/skills').status_code == 401
        assert api.get('/api/market/skills/me').status_code == 401


@pytest.mark.parametrize('filename,mime,data,code', [
    ('resume.pdf','application/pdf',b'%PDF-test','RESUME_PARSE_FAILED'),
    ('resume.txt','image/png',b'A long enough text resume for tests','RESUME_FORMAT_UNSUPPORTED'),
    ('resume.txt','text/plain',b'\xff\x00','RESUME_PARSE_FAILED'),
    ('resume.docx',DOCX_MIME,b'not a ZIP','RESUME_PARSE_FAILED'),
    ('resume.txt','text/plain',b'short','RESUME_TEXT_LENGTH'),
    ('resume.txt','text/plain',b'x'*(MAX_RESUME_BYTES+1),'RESUME_TOO_LARGE')],
    ids=['unsupported-pdf', 'wrong-mime', 'invalid-utf8', 'corrupt-docx', 'short-text', 'oversized-text'])
def test_resume_parser_errors(filename,mime,data,code):
    with pytest.raises(SearchFailure) as exc:
        parse_resume(data,filename,mime)
    assert exc.value.code == code


def test_resume_docx_plain_text_and_unsafe_xml():
    text = 'Education: Synthetic engineering. Projects: Python and SQL exercises.'
    assert parse_resume(docx(text),'resume.docx',DOCX_MIME) == text
    assert parse_resume(text.encode(),'resume.txt','text/plain') == text
    content = BytesIO()
    with zipfile.ZipFile(content,'w') as archive:
        archive.writestr('word/document.xml','<!DOCTYPE test [<!ENTITY secret "x">]><test>&secret;</test>')
    with pytest.raises(SearchFailure):
        parse_resume(content.getvalue(),'resume.docx',DOCX_MIME)
    content = BytesIO()
    with zipfile.ZipFile(content,'w') as archive:
        archive.writestr('word/document.xml','x'*2_000_001)
    with pytest.raises(SearchFailure):
        parse_resume(content.getvalue(),'resume.docx',DOCX_MIME)


def test_old_resume_advice_endpoints_are_retired(db):
    listing = collect(db).jobs[0]; student, _ = seed_demo(db)
    app.dependency_overrides[current_principal] = lambda: Principal('student', student.id)
    with TestClient(app) as api:
        for endpoint in ['resume-upload', 'resume-advice']:
            assert api.post(f'/api/jobs/{listing.id}/{endpoint}').status_code == 404
