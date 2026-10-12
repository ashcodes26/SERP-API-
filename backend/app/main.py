from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.config import get_settings
from app.db import SessionLocal, init_db, get_db
from app.schemas import (AuthSessionOut, HealthOut, ResourceSearchIn, ResourceSearchOut, ErrorBody, ProfileOut,
                         JobOut, JobAnalyzeIn, SkillGapAnalyzeIn, AnalysisOut, RoadmapItemOut,
                         AssessmentSubmitIn, AssessmentOut, DashboardOut)
from app import models
from app.auth import Principal, current_principal, allow_student, issue_token
from app.services.analysis import analyze, get_job, get_profile
from app.services.demo_seed import seed_demo
from app.services.serpapi import SearchFailure, search_resources
from app.services.learning import create_roadmap, get_questions, submit_assessment, dashboard, latest_analysis
from app.routes.accounts import router as accounts_router
from app.routes.placement import router as placement_router
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
    app.include_router(accounts_router)
    app.include_router(placement_router)
    app.include_router(jobs_router)
    app.include_router(workspace_router)

    @app.exception_handler(RequestValidationError)
    async def workspace_validation(request: Request, exc: RequestValidationError):
        if request.url.path.startswith(('/api/auth', '/api/admin', '/api/placement', '/api/import', '/api/resumes', '/api/profile/linkedin', '/api/roadmap/tasks', '/api/journey')):
            first = exc.errors()[0]
            field = '.'.join(str(part) for part in first['loc'] if part not in {'body', 'query'})
            # Never echo uploaded resume/profile input (including invalid Unicode).
            return JSONResponse(status_code=422, content={'detail': {'code': 'INVALID_INPUT',
                'message': f"{field}: {first['msg']}", 'retryable': False}})
        return await request_validation_exception_handler(request, exc)

    @app.middleware('http')
    async def private_workspace_cache(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith('/api/') and request.url.path != '/api/health':
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

    @app.post('/api/auth/demo-session', response_model=AuthSessionOut, tags=['auth'])
    def demo_session(request: Request, db: Session = Depends(get_db)):
        cfg = get_settings()
        # Temporary local convenience: never grant admin access or enable in production.
        if not cfg.demo_login_bypass or cfg.app_env != 'development':
            raise HTTPException(404, detail={'code': 'DEMO_LOGIN_DISABLED',
                                            'message': 'Automatic demo entry is disabled'})
        if not request.client or request.client.host not in {'127.0.0.1', '::1'}:
            raise HTTPException(403, detail={'code': 'LOCAL_DEMO_ONLY',
                                            'message': 'Automatic demo entry is available on this computer only'})
        # Check signing configuration before creating records.
        if not cfg.auth_signing_key or len(cfg.auth_signing_key.get_secret_value()) < 32:
            raise HTTPException(503, detail={'code': 'AUTH_NOT_CONFIGURED',
                                            'message': 'Server authentication is not configured'})
        student, _ = seed_demo(db)
        if not student.is_synthetic:
            raise HTTPException(403, detail={'code': 'ACCOUNT_DISABLED',
                                            'message': 'Demo account is unavailable'})
        from app.services.accounts import demo_account
        return AuthSessionOut(access_token=issue_token(demo_account(db, student)),
                              role='student', student_id=student.id)

    @app.post("/api/demo/seed", tags=["demo"])
    def demo_seed(db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
        if get_settings().app_env not in {"development", "test"}:
            raise HTTPException(403, detail="Demo seeding disabled")
        if principal.role == 'student':
            existing = db.get(models.Student, principal.student_id)
            if not existing or existing.student_id != 'AIMORA-DEMO-001':
                raise HTTPException(403, detail={'code': 'DEMO_ONLY', 'message': 'Use your own student journey'})
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

    return app


app = create_app()
