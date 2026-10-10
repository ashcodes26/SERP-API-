from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.config import get_settings
from app.db import SessionLocal, init_db, get_db
from app.schemas import (HealthOut, ResourceSearchIn, ResourceSearchOut, ErrorBody, ProfileOut,
                         JobOut, JobAnalyzeIn, SkillGapAnalyzeIn, AnalysisOut, RoadmapItemOut,
                         AssessmentSubmitIn, AssessmentOut, DashboardOut)
from app import models
from app.auth import Principal, current_principal, require_admin, allow_student, issue_token
import hmac
from app.services.analysis import analyze, get_job, get_profile
from app.services import imports as import_service
from app.services.retention import purge_expired_imports
from app.services.demo_seed import seed_demo
from app.services.serpapi import SearchFailure, search_resources
from app.services.learning import create_roadmap, get_questions, submit_assessment, dashboard, latest_analysis
from app.routes.jobs import router as jobs_router
from app.routes.workspace import router as workspace_router
from app.services.linkedin import PrivateLinkedInCallback


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Skillup API", version=__version__, lifespan=lifespan)
    app.add_middleware(PrivateLinkedInCallback)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(jobs_router)
    app.include_router(workspace_router)

    @app.exception_handler(RequestValidationError)
    async def workspace_validation(request: Request, exc: RequestValidationError):
        if request.url.path.startswith(('/api/resumes', '/api/profile/linkedin', '/api/roadmap/tasks')):
            first = exc.errors()[0]
            field = '.'.join(str(part) for part in first['loc'] if part not in {'body', 'query'})
            # Never echo uploaded resume/profile input (including invalid Unicode).
            return JSONResponse(status_code=422, content={'detail': {'code': 'INVALID_INPUT',
                'message': f"{field}: {first['msg']}", 'retryable': False}})
        return await request_validation_exception_handler(request, exc)

    @app.middleware('http')
    async def private_workspace_cache(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(('/api/resumes', '/api/profile/linkedin', '/api/roadmap/tasks')):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get("/api/health", response_model=HealthOut, tags=["system"])
    def health() -> HealthOut:
        try:
            with SessionLocal() as db:
                db.execute(text("SELECT 1"))
            db_status = "ok"
        except Exception:
            db_status = "error"
        return HealthOut(
            status="ok" if db_status == "ok" else "degraded",
            version=__version__,
            database=db_status,
            serpapi_configured=settings.serpapi_configured,
        )

    @app.post("/api/resources/search", response_model=ResourceSearchOut, responses={
        422: {"model": ErrorBody}, 502: {"model": ErrorBody},
        503: {"model": ErrorBody}, 504: {"model": ErrorBody},
    }, tags=["resources"])
    async def resource_search(request: ResourceSearchIn, principal: Principal = Depends(current_principal)):
        try:
            return await search_resources(request, settings)
        except SearchFailure as exc:
            return JSONResponse(status_code=exc.status, content={
                "code": exc.code, "message": exc.message, "retryable": exc.retryable,
            })

    @app.post("/api/auth/login", tags=["auth"])
    def login(payload: dict, db: Session = Depends(get_db)):
        username, password = payload.get("username"), payload.get("password")
        if not isinstance(username, str) or not isinstance(password, str):
            raise HTTPException(422, detail="Username and password required")
        cfg = get_settings()
        if username == "admin" and cfg.admin_password and hmac.compare_digest(password, cfg.admin_password.get_secret_value()):
            principal = Principal("admin")
        elif username == "demo" and cfg.app_env in {"development", "test"} and cfg.demo_password and hmac.compare_digest(password, cfg.demo_password.get_secret_value()):
            student, _ = seed_demo(db)
            principal = Principal("student", student.id)
        else:
            raise HTTPException(401, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid credentials"})
        return {"access_token": issue_token(principal), "token_type": "bearer", "expires_in": 3600,
                "role": principal.role, "student_id": principal.student_id}

    @app.post("/api/demo/seed", tags=["demo"])
    def demo_seed(db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        if get_settings().app_env not in {"development", "test"}:
            raise HTTPException(403, detail="Demo seeding disabled")
        student, role = seed_demo(db)
        allow_student(principal, student.id)
        return {"student_id": student.id, "job_id": role.id, "synthetic": True}

    @app.get("/api/profile/{student_id}", response_model=ProfileOut, tags=["career"])
    def profile(student_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        allow_student(principal, student_id)
        student = db.get(models.Student, student_id)
        if student is None:
            raise HTTPException(status_code=404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student not found"})
        return get_profile(db, student)

    @app.post("/api/job/analyze", response_model=JobOut, tags=["career"])
    def job_analyze(request: JobAnalyzeIn, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        if request.seeded_job_id is None:
            raise HTTPException(status_code=422, detail={"code": "SEEDED_ROLE_REQUIRED", "message": "Free-text job extraction is not implemented in Phase 3"})
        role = db.get(models.Job, request.seeded_job_id)
        if role is None or not role.is_seeded:
            raise HTTPException(status_code=404, detail={"code": "JOB_NOT_FOUND", "message": "Seeded role not found"})
        return get_job(db, role)

    @app.post("/api/skill-gap/analyze", response_model=AnalysisOut, tags=["career"])
    def skill_gap(request: SkillGapAnalyzeIn, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        allow_student(principal, request.student_id)
        student = db.get(models.Student, request.student_id)
        role = db.get(models.Job, request.job_id)
        if student is None or role is None:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Student or role not found"})
        try:
            return analyze(db, student, role)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail={"code": "INVALID_ROLE", "message": str(exc)}) from exc

    @app.get("/api/roadmap/{student_id}", response_model=list[RoadmapItemOut], tags=["learning"])
    async def roadmap(student_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        allow_student(principal, student_id)
        student = db.get(models.Student, student_id)
        if student is None:
            raise HTTPException(404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student not found"})
        analysis = latest_analysis(db, student_id)
        if analysis is None:
            raise HTTPException(409, detail={"code": "ANALYSIS_REQUIRED", "message": "Analyze a target role first"})
        return await create_roadmap(db, student, analysis, get_settings())

    @app.get("/api/assessment/questions/{skill_id}", tags=["learning"])
    def assessment_questions(skill_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        skill = db.get(models.Skill, skill_id)
        if skill is None:
            raise HTTPException(404, detail={"code": "SKILL_NOT_FOUND", "message": "Skill not found"})
        questions = get_questions(skill)
        if questions is None:
            raise HTTPException(404, detail={"code": "QUESTION_SET_NOT_FOUND", "message": "No assessment for this skill"})
        return questions

    @app.post("/api/assessment/submit", response_model=AssessmentOut, tags=["learning"])
    def assessment_submit(request: AssessmentSubmitIn, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        allow_student(principal, request.student_id)
        student = db.get(models.Student, request.student_id)
        skill = db.get(models.Skill, request.skill_id)
        if student is None or skill is None:
            raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Student or skill not found"})
        try:
            return submit_assessment(db, student, skill, request)
        except ValueError as exc:
            raise HTTPException(422, detail={"code": "INVALID_ASSESSMENT", "message": str(exc)}) from exc

    @app.get("/api/dashboard/{student_id}", response_model=DashboardOut, tags=["learning"])
    def student_dashboard(student_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        allow_student(principal, student_id)
        student = db.get(models.Student, student_id)
        if student is None:
            raise HTTPException(404, detail={"code": "STUDENT_NOT_FOUND", "message": "Student not found"})
        return dashboard(db, student)

    def demo_import_only(db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
        if get_settings().app_env.lower() not in {"development", "test"}:
            raise HTTPException(403, detail={"code": "IMPORT_DISABLED", "message": "Imports require authenticated admin access outside development"})

        purge_expired_imports(db, get_settings().import_retention_hours)

    @app.post("/api/import/upload", tags=["import"])
    async def import_upload(file: UploadFile = File(...), db: Session = Depends(get_db), access: None = Depends(demo_import_only)):
        if not file.filename or not file.filename.lower().endswith((".csv", ".xlsx")):
            raise HTTPException(422, detail={"code": "INVALID_FILE", "message": "Upload CSV or XLSX"})
        limit = get_settings().max_upload_mb * 1024 * 1024
        content = await file.read(limit + 1)
        await file.close()
        if len(content) > limit:
            raise HTTPException(413, detail={"code": "FILE_TOO_LARGE", "message": "Upload exceeds configured size limit"})
        try:
            job, headers = import_service.upload(db, file.filename, content)
            return {"job_id": job.id, "headers": headers, "suggested_mapping": job.field_mapping, "total_rows": job.total_rows}
        except ValueError as exc:
            raise HTTPException(422, detail={"code": "INVALID_FILE", "message": str(exc)}) from exc

    def find_import(db: Session, job_id: int):
        job = db.get(models.ImportJob, job_id)
        if job is None:
            raise HTTPException(404, detail={"code": "IMPORT_NOT_FOUND", "message": "Import job not found"})
        return job

    @app.post("/api/import/preview", tags=["import"])
    def import_preview(payload: dict, db: Session = Depends(get_db), access: None = Depends(demo_import_only)):
        job_id, mapping = payload.get("job_id"), payload.get("mapping")
        if not isinstance(job_id, int) or not isinstance(mapping, dict):
            raise HTTPException(422, detail={"code": "INVALID_MAPPING", "message": "job_id and mapping required"})
        try:
            return import_service.preview(db, find_import(db, job_id), mapping)
        except ValueError as exc:
            raise HTTPException(422, detail={"code": "INVALID_MAPPING", "message": str(exc)}) from exc

    @app.post("/api/import/confirm", tags=["import"])
    def import_confirm(payload: dict, db: Session = Depends(get_db), access: None = Depends(demo_import_only)):
        if not isinstance(payload.get("job_id"), int) or not isinstance(payload.get("update_duplicates", False), bool):
            raise HTTPException(422, detail="Invalid import confirmation")
        try:
            return import_service.confirm(db, find_import(db, payload["job_id"]), payload.get("update_duplicates", False))
        except ValueError as exc:
            raise HTTPException(409, detail={"code": "INVALID_IMPORT_STATE", "message": str(exc)}) from exc

    @app.get("/api/import/{job_id}", tags=["import"])
    def import_status(job_id: int, db: Session = Depends(get_db), access: None = Depends(demo_import_only)):
        return import_service.summary(db, find_import(db, job_id))

    @app.get("/api/import/{job_id}/errors", tags=["import"])
    def import_errors(job_id: int, db: Session = Depends(get_db), access: None = Depends(demo_import_only)):
        return import_service.summary(db, find_import(db, job_id))["issues"]

    @app.post("/api/import/{job_id}/retry", tags=["import"])
    def import_retry(job_id: int, db: Session = Depends(get_db), access: None = Depends(demo_import_only)):
        try:
            return import_service.retry(db, find_import(db, job_id))
        except ValueError as exc:
            raise HTTPException(409, detail={"code": "INVALID_IMPORT_STATE", "message": str(exc)}) from exc

    return app


app = create_app()
