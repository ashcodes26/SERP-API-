"""Authenticated discovery, matching, sample insights and preparation routes."""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session

from app import models
from app.auth import Principal, allow_student, current_principal
from app.config import get_settings
from app.db import get_db
from app.schemas import (JobListingOut, JobMatchIn, JobMatchOut, JobSearchIn, JobSearchOut,
                         MarketSkillsOut, ResumeAdviceIn, ResumeAdviceOut, RoadmapItemOut,
                         RoadmapProgressIn)
from app.schemas import MarketFilter, MarketDemandOut, MarketCompareOut, MarketMeOut, MarketScopeOut, ResumeUploadOut
from app.services import market as insights
from app.services.resume_files import parse_resume, MAX_RESUME_BYTES
from app.services import job_discovery as service
from app.services.learning import create_roadmap
from app.services.serpapi import SearchFailure

router = APIRouter(prefix='/api', tags=['job discovery'])


def failure(exc: SearchFailure):
    raise HTTPException(exc.status, detail={'code': exc.code, 'message': exc.message, 'retryable': exc.retryable}) from None


def listing(db: Session, job_id: int) -> JobListingOut:
    result = service.get_listing(db, job_id)
    if result is None:
        raise HTTPException(404, detail={'code': 'JOB_NOT_FOUND', 'message': 'Retrieved job not found'})
    return result


def student(db: Session, principal: Principal, student_id: int) -> models.Student:
    allow_student(principal, student_id)
    result = db.get(models.Student, student_id)
    if result is None:
        raise HTTPException(404, detail={'code': 'STUDENT_NOT_FOUND', 'message': 'Student not found'})
    return result


@router.get('/jobs/search', response_model=JobSearchOut)
async def search(request: JobSearchIn = Depends(), db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    try:
        return await service.search_jobs(db, request, get_settings())
    except SearchFailure as exc:
        failure(exc)


@router.get('/jobs/{job_id}', response_model=JobListingOut)
def detail(job_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    return listing(db, job_id)


@router.post('/jobs/{job_id}/match', response_model=JobMatchOut)
def match(job_id: int, request: JobMatchIn, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    selected = student(db, principal, request.student_id)
    try:
        return service.match_job(db, selected, listing(db, job_id))
    except SearchFailure as exc:
        failure(exc)


@router.get('/market/skills', response_model=MarketSkillsOut | MarketDemandOut)
def market(search_id: str | None = Query(default=None, min_length=64, max_length=64, pattern='^[a-f0-9]+$'),
           filters: MarketFilter = Depends(),
           db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    if search_id is None:
        try:
            return insights.demand(db, filters)
        except SearchFailure as exc:
            failure(exc)
    result = service.market_skills(db, search_id)
    if result is None:
        raise HTTPException(404, detail={'code': 'SEARCH_NOT_FOUND', 'message': 'Search sample expired; search again'})
    return result


@router.get('/market/scopes', response_model=MarketScopeOut)
def market_scopes(db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    return insights.scopes(db)


@router.get('/market/skills/compare', response_model=MarketCompareOut)
def market_compare(roles: str = Query(min_length=3, max_length=400), filters: MarketFilter = Depends(),
                   db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    try:
        return insights.compare(db, roles.split(','), filters)
    except SearchFailure as exc:
        failure(exc)


@router.get('/market/skills/me', response_model=MarketMeOut)
def market_me(filters: MarketFilter = Depends(), db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    if principal.role != 'student' or principal.student_id is None:
        raise HTTPException(403, detail={'code': 'STUDENT_SESSION_REQUIRED', 'message': 'Sign in as a student for personal insights'})
    selected = student(db, principal, principal.student_id)
    try:
        return insights.personal(db, selected, filters)
    except SearchFailure as exc:
        failure(exc)


@router.post('/jobs/{job_id}/resume-upload', response_model=ResumeUploadOut)
async def resume_upload(job_id: int, student_id: int = Form(gt=0), file: UploadFile = File(),
                        db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    selected = student(db, principal, student_id)
    job = listing(db, job_id)
    try:
        data = await file.read(MAX_RESUME_BYTES + 1)
        text = parse_resume(data, file.filename or '', file.content_type)
        return ResumeUploadOut(filename=(file.filename or '').replace('\\', '/').split('/')[-1][:200],
            extracted_character_count=len(text), advice=service.resume_advice(db, selected, job, text))
    except SearchFailure as exc:
        failure(exc)
    finally:
        await file.close()


@router.post('/jobs/{job_id}/resume-advice', response_model=ResumeAdviceOut)
def advice(job_id: int, request: ResumeAdviceIn, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    return service.resume_advice(db, student(db, principal, request.student_id), listing(db, job_id), request.text)


@router.get('/roadmap/{student_id}/analysis/{analysis_id}', response_model=list[RoadmapItemOut])
async def selected_roadmap(student_id: int, analysis_id: int, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    selected = student(db, principal, student_id)
    analysis = db.get(models.Analysis, analysis_id)
    if analysis is None or analysis.student_pk != selected.id:
        raise HTTPException(404, detail={'code': 'ANALYSIS_NOT_FOUND', 'message': 'Student analysis not found'})
    return await create_roadmap(db, selected, analysis, get_settings())


@router.patch('/roadmap/items/{item_id}', response_model=RoadmapItemOut)
def progress(item_id: int, request: RoadmapProgressIn, db: Session = Depends(get_db), principal: Principal = Depends(current_principal)):
    item = db.get(models.RoadmapItem, item_id)
    if item is None:
        raise HTTPException(404, detail={'code': 'ROADMAP_ITEM_NOT_FOUND', 'message': 'Roadmap item not found'})
    allow_student(principal, item.student_pk)
    resulting_evidence = request.completion_evidence if request.completion_evidence is not None else item.completion_evidence
    if request.status.value == 'done' and not (resulting_evidence or '').strip():
        raise HTTPException(422, detail={'code': 'EVIDENCE_REQUIRED', 'message': 'Record completion evidence before marking a task done'})
    item.status = request.status.value
    if request.completion_evidence is not None:
        item.completion_evidence = request.completion_evidence.strip() or None
    db.commit()
    return RoadmapItemOut.model_validate(item)
