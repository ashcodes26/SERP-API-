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
        result.status = 'stale'; result.insights = []; result.sources = []
        result.message = 'Your profile changed. Reload the analysis and request an explanation again.'
    else:
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


def opportunity_context(db, student, job_id, analysis_id):
    from app.services.job_discovery import get_listing, extract_requirements
    from app.services.gemini_resume import source_excerpt
    listing = get_listing(db, job_id)
    meta = db.get(models.DiscoveredJob, job_id)
    if not listing or not meta or listing.provenance.value != 'serpapi_live' or not listing.source_url:
        error(422, 'RETRIEVED_LISTING_REQUIRED', 'Choose a genuine retrieved listing with an original source URL')
    analysis = db.get(models.Analysis, analysis_id)
    if not analysis or analysis.student_pk != student.id or analysis.job_id != job_id:
        error(404, 'ANALYSIS_NOT_FOUND', 'Compare this listing with your evidence first')
    gaps, gap_actions, context, recommendations = readiness_context(db, student, analysis_id)
    sources, allowed = [], {}
    # Re-extract from the actual retrieved description; never trust a model-created requirement.
    for index, requirement in enumerate(extract_requirements(listing.description)[:8]):
        if requirement.requirement_type == 'mentioned' or not source_excerpt(listing.description, requirement.excerpt): continue
        # A truncated excerpt must still explicitly name this canonical skill.
        if not any(r.name == requirement.name for r in extract_requirements(requirement.excerpt)): continue
        source_id = f'listing:{job_id}:{index}'
        sources.append(s.AiSourceOut(id=source_id, label=f'{requirement.name}: {requirement.requirement_type}',
            detail=f'Retrieved listing excerpt: {requirement.excerpt}', source_url=str(listing.source_url)))
        allowed[source_id] = ['align']
    if not sources: error(422, 'LISTING_EVIDENCE_INSUFFICIENT', 'This listing has no verifiable explicit requirements')
    sources += gaps[:4]; allowed.update({source.id: gap_actions[source.id] for source in gaps[:4]})
    context['listing_version'] = digest(meta.listing)
    context['opening_status'] = 'not_verified'
    return sources, allowed, context, recommendations


@router.post('/opportunities/{job_id}/analysis/{analysis_id}', response_model=s.AiExplanationOut)
def opportunity(job_id: int, analysis_id: int, body: s.AiExplainIn, db: Session = Depends(get_db), student=Depends(owner)):
    sources, allowed, context, recommendations = opportunity_context(db, student, job_id, analysis_id)
    owner_id = student.id; engine = db.bind; db.rollback()
    result = explain(engine, owner_id, 'job_explanation_v1', sources, allowed, context, body.ai_consent, get_settings())
    student = db.get(models.Student, owner_id)
    try:
        _, _, latest, _ = opportunity_context(db, student, job_id, analysis_id)
    except Exception:
        latest = None
    if latest != context:
        result.status = 'stale'; result.insights = []; result.sources = []
        result.message = 'The listing or approved profile evidence changed. Reload the comparison.'
    else:
        result.recommendations = recommendations
    return result
