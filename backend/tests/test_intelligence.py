import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import init_db, make_engine, get_db
from app.main import app
from app.schemas import Competency, JobOut, JobSkillOut, SkillOut
from app.services.intelligence import normalize_skill, score_role, FORMULA_VERSION


def _role():
    sql = SkillOut(id=1, canonical_name='SQL')
    docker = SkillOut(id=2, canonical_name='Docker')
    return JobOut(id=1, title='Synthetic engineer', skills=[
        JobSkillOut(skill=sql, requirement_type='required', importance=1, expected_level=4),
        JobSkillOut(skill=docker, requirement_type='preferred', importance=0.5, expected_level=3),
    ])


def test_skill_aliases_and_unknown_skill():
    assert normalize_skill('  Java   Script ') == ('JavaScript', 'Programming')
    assert normalize_skill('ML')[0] == 'Machine Learning'
    assert normalize_skill('Imaginary Toolkit') == ('Imaginary Toolkit', None)
    with pytest.raises(ValueError):
        normalize_skill('  ')


def test_unknown_not_zero_and_coverage_requires_evidence():
    result = score_role(_role(), [Competency(skill=SkillOut(id=1, canonical_name='SQL'), level=2,
                                               confidence=0.8, evidence_ids=[9])])
    assert result.gaps[0].skill.canonical_name == 'SQL'
    unknown = next(g for g in result.gaps if g.skill.canonical_name == 'Docker')
    assert unknown.current_level is None and unknown.gap is None
    assert any('Docker' in w for w in result.warnings)
    assert result.readiness.alignment == 0.4  # .5 of required skill, weighted with preferred
    assert result.readiness.evidence_coverage == 0.8
    assert result.readiness.confidence == 0.64
    assert result.readiness.formula_version == FORMULA_VERSION
    assert 'not a prediction' in result.readiness.disclaimer


def test_repeatability_and_zero_is_known():
    role = _role()
    competency = Competency(skill=SkillOut(id=1, canonical_name='SQL'), level=0, confidence=1, evidence_ids=[1])
    a = score_role(role, [competency]); b = score_role(role, [competency])
    assert a.readiness == b.readiness
    assert a.gaps[0].gap == 4
    assert a.readiness.alignment == 0


def test_requires_meaningful_requirements():
    with pytest.raises(ValueError):
        score_role(JobOut(id=1, title='Empty'), [])
    with pytest.raises(ValueError):
        score_role(JobOut(id=1, title='Zero', skills=[JobSkillOut(skill=SkillOut(id=1, canonical_name='SQL'), requirement_type='required', importance=0, expected_level=4)]), [])


def test_demo_seed_and_endpoints_use_real_database(tmp_path):
    engine = make_engine(f'sqlite:///{tmp_path / "demo.db"}')
    init_db(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    def override():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = override
    from app.auth import Principal, current_principal
    app.dependency_overrides[current_principal] = lambda: Principal('admin', assigned_ids=(1, 99999))
    try:
        with TestClient(app) as client:
            seed1 = client.post('/api/demo/seed')
            seed2 = client.post('/api/demo/seed')
            assert seed1.status_code == seed2.status_code == 200
            assert seed1.json() == seed2.json()
            ids = seed1.json()
            assert ids['synthetic'] is True
            profile = client.get(f'/api/profile/{ids["student_id"]}')
            assert profile.status_code == 200
            assert profile.json()['student']['is_synthetic'] is True
            assert profile.json()['evidence']
            job = client.post('/api/job/analyze', json={'seeded_job_id': ids['job_id']})
            assert job.status_code == 200 and len(job.json()['skills']) == 5
            custom = client.post('/api/job/analyze', json={
                'title': 'Data Engineer',
                'description': 'Required skills: Python, SQL and Docker. Preferred: AWS.',
            })
            assert custom.status_code == 200
            assert custom.json()['title'] == 'Data Engineer'
            assert {item['skill']['canonical_name'] for item in custom.json()['skills']} >= {'Python', 'SQL', 'Docker'}
            payload = {'student_id': ids['student_id'], 'job_id': ids['job_id']}
            result1 = client.post('/api/skill-gap/analyze', json=payload)
            result2 = client.post('/api/skill-gap/analyze', json=payload)
            assert result1.status_code == result2.status_code == 200
            a, b = result1.json(), result2.json()
            assert a['id'] != b['id']
            assert a['readiness'] == b['readiness']
            assert a['gaps'] == b['gaps']
            assert any(g['gap'] is None for g in a['gaps'])
            assert client.get('/api/profile/99999').status_code == 404
            assert client.post('/api/job/analyze', json={'description': 'hello'}).status_code == 422
            assert client.post('/api/job/analyze', json={'title': 'Data Engineer'}).status_code == 422
            assert client.post('/api/skill-gap/analyze', json={'student_id': 99999, 'job_id': ids['job_id']}).status_code == 404
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
