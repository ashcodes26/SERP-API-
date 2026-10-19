"""Additive student-only read-only intelligence endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas as s
from app.config import get_settings
from app.db import get_db
from app.routes.workspace import owner, error
from app.services.analysis import get_job, get_profile
from app.services.intelligence import score_role
from app.services.learning import recommendations_for_gaps
from app.services.grounded_ai import explain
from app.services.job_discovery import digest

router = APIRouter(prefix='/api/ai', tags=['private grounded AI'])


def readiness_context(db, student, analysis_id):
    analysis = db.get(models.Analysis, analysis_id)
    if not analysis or analysis.student_pk != student.id: error(404, 'ANALYSIS_NOT_FOUND', 'Your analysis was not found')
    job = db.get(models.Job, analysis.job_id)
    if not job: error(404, 'JOB_NOT_FOUND', 'Analyzed role was not found')
    profile = get_profile(db, student); role = get_job(db, job)
    scored = score_role(role, profile.competencies)
    evidence_ids = {e.id for e in profile.evidence}
    sources, allowed = [], {}
    for gap in scored.gaps[:12]:
        ref = f'gap:{gap.skill.id}'
        sources.append(s.AiSourceOut(id=ref, label=gap.skill.canonical_name, detail=gap.rationale,
            evidence_ids=[e for e in gap.evidence_ids if e in evidence_ids]))
        allowed[ref] = ['assess', 'align'] if gap.current_level is None or gap.required_level is None else ['practice', 'align']
    for strength in scored.strengths[:max(0, 12 - len(sources))]:
        ref = f'skill:{strength.skill.id}'
        sources.append(s.AiSourceOut(id=ref, label=strength.skill.canonical_name,
            detail='The saved deterministic comparison records this skill at the target level.',
            evidence_ids=[e for e in strength.evidence_ids if e in evidence_ids]))
        allowed[ref] = ['document', 'align']
    context = {'analysis_id': analysis.id, 'role': role.model_dump(mode='json'),
        'readiness': scored.readiness.model_dump(mode='json'),
        'competencies': [c.model_dump(mode='json') for c in profile.competencies],
        # No raw profile documents, names, contacts or excerpt text enter the cache or provider.
        'approved_evidence': [{'id': e.id, 'source_type': e.source_type.value, 'observed_at': e.observed_at.isoformat(),
                               'version': digest(e.model_dump(mode='json'))} for e in profile.evidence]}
    recommendations = recommendations_for_gaps(db, student, analysis, scored.gaps)
    return sources, allowed, context, recommendations


@router.post('/readiness/{analysis_id}', response_model=s.AiExplanationOut)
def readiness(analysis_id: int, body: s.AiExplainIn, db: Session = Depends(get_db), student=Depends(owner)):
    sources, allowed, context, recommendations = readiness_context(db, student, analysis_id)
    owner_id = student.id; engine = db.bind; db.rollback()
    result = explain(engine, owner_id, 'readiness_explanation_v1', sources, allowed, context, body.ai_consent, get_settings())
    # Re-read after the provider call; never show cached explanations for a changed source snapshot.
    student = db.get(models.Student, owner_id)
    _, _, latest, _ = readiness_context(db, student, analysis_id)
    if latest != context:
        result.status = 'stale'; result.insights = []; result.message = 'Your profile changed. Reload the analysis and request an explanation again.'
    result.recommendations = recommendations
    return result


def linkedin_context(db, student):
    from app.services.gemini_resume import redact_contacts
    item = db.get(models.LinkedInProfile, student.id)
    if not item or not item.profile_text: error(404, 'LINKEDIN_PROFILE_REQUIRED', 'Save your own LinkedIn text first')
    if not item.confirmed: error(422, 'PROFILE_REVIEW_REQUIRED', 'Review and confirm the saved LinkedIn text first')
    redacted = redact_contacts(item.profile_text)
    # Public lookup metadata and contact headers are never used as factual profile evidence.
    lines = list(dict.fromkeys(line.strip() for line in redacted.splitlines()
        if 20 <= len(line.strip()) <= 600 and not line.casefold().startswith(('source:', 'profile url:', 'retrieved:'))))[:12]
    sources = [s.AiSourceOut(id=f'linkedin:{index}', label='Confirmed supplied LinkedIn excerpt', detail=line)
               for index, line in enumerate(lines)]
    allowed = {source.id: ['clarify', 'document'] for source in sources}
    # Include all saved text in versioning, but transmit no reusable document fingerprint.
    context = {'import_method': item.import_method, 'confirmed': item.confirmed,
               'updated_at': item.updated_at.isoformat(), 'source_version': digest(item.profile_text)}
    return sources, allowed, context


@router.post('/linkedin', response_model=s.AiExplanationOut)
def linkedin(body: s.AiExplainIn, db: Session = Depends(get_db), student=Depends(owner)):
    sources, allowed, context = linkedin_context(db, student)
    owner_id = student.id; engine = db.bind; db.rollback()
    result = explain(engine, owner_id, 'linkedin_optimization_v1', sources, allowed, context, body.ai_consent, get_settings())
    student = db.get(models.Student, owner_id)
    try:
        _, _, latest = linkedin_context(db, student)
    except Exception:
        latest = None
    if latest != context:
        result.status = 'stale'; result.insights = []; result.sources = []
        result.message = 'Your saved LinkedIn source changed. Reload before another request.'
    return result
