import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import inspect

from app import models  # noqa: F401
from app.config import Settings
from app.db import init_db, make_engine
from app.main import app
from app.schemas import READINESS_DISCLAIMER, Competency, ReadinessOut, SkillGapOut, SkillOut, StudentIn

EXPECTED_TABLES = {
    "students", "skills", "evidence", "student_skills", "jobs", "job_skills", "analyses",
    "skill_gaps", "swot_items", "roadmap_items", "assessments", "import_jobs", "import_row_issues",
}


def test_init_db_creates_all_tables(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path/'t.db'}")
    init_db(engine)
    assert EXPECTED_TABLES <= set(inspect(engine).get_table_names())
    init_db(engine)  # idempotent


def test_health_endpoint_reports_ok_without_leaking_secret(monkeypatch):
    with TestClient(app) as client:
        r = client.get("/api/health")
    body = r.json()
    assert r.status_code == 200
    assert body["status"] == "ok" and body["database"] == "ok"
    assert isinstance(body["serpapi_configured"], bool)
    assert "key" not in str(body).lower().replace("serpapi_configured", "")


def test_settings_detect_serpapi_key_and_hide_value():
    assert Settings(_env_file=None, serpapi_api_key="secret123").serpapi_configured is True
    assert Settings(_env_file=None, serpapi_api_key="  ").serpapi_configured is False
    assert Settings(_env_file=None).serpapi_configured is False
    assert "secret123" not in repr(Settings(_env_file=None, serpapi_api_key="secret123"))


def test_unknown_level_is_not_zero():
    c = Competency(skill=SkillOut(id=1, canonical_name="Python"))
    assert c.level is None
    g = SkillGapOut(skill=SkillOut(id=1, canonical_name="Python"), priority="high", rationale="x")
    assert g.gap is None and g.current_level is None


def test_readiness_is_labelled_informational():
    r = ReadinessOut(alignment=0.5, evidence_coverage=0.4, confidence=0.6, formula_version="v0")
    assert r.disclaimer == READINESS_DISCLAIMER and "not a prediction" in r.disclaimer
    with pytest.raises(ValidationError):
        ReadinessOut(alignment=1.2, evidence_coverage=0, confidence=0, formula_version="v0")


def test_student_validation():
    with pytest.raises(ValidationError):
        StudentIn(student_id="1", name="A", email="not-an-email")
    with pytest.raises(ValidationError):
        StudentIn(student_id="1", name="A", email="a@b.co", cgpa=11)


def test_browser_login_preflight_allows_local_expo_origins():
    for origin in ("http://localhost:8081", "http://127.0.0.1:8081"):
        with TestClient(app) as client:
            response = client.options(
                "/api/auth/login",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
