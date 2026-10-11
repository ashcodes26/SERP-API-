"""Private resume revisions, consent-based profile imports and independent roadmap tasks."""
from datetime import date, datetime, timezone
from pathlib import PurePath
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.responses import Response, HTMLResponse
from sqlalchemy import delete, select, update, func
from sqlalchemy.orm import Session

from app import models, schemas as s
from app.auth import Principal, current_principal
from app.db import get_db
from app.services import resume_enhancer as enhancer
from app.services.job_discovery import get_listing, extract_requirements
from app.services.resume_files import parse_resume, MAX_RESUME_BYTES, DOCX_MIME
from app.services.serpapi import SearchFailure
from app.services import linkedin, linkedin_public
from app.config import get_settings

router = APIRouter(prefix='/api', tags=['private career workspace'])


def error(status, code, message):
    raise HTTPException(status, detail={'code': code, 'message': message, 'retryable': False})


def owner(principal: Principal = Depends(current_principal), db: Session = Depends(get_db)) -> models.Student:
    if principal.role != 'student':
        error(403, 'STUDENT_REQUIRED', 'Sign in with a student account to use your private workspace')
    result = db.get(models.Student, principal.student_id)
    if result is None:
        error(404, 'STUDENT_NOT_FOUND', 'Student not found')
    return result


def owned(db, model, item_id, student):
    result = db.scalar(select(model).where(model.id == item_id, model.student_pk == student.id))
    if result is None:
        error(404, 'NOT_FOUND', 'Saved item not found')
    return result


def now():
    return datetime.now(timezone.utc)


def check_version(item, version):
    if item.version != version:
        error(409, 'VERSION_CONFLICT', 'This item changed. Reload the saved version before retrying; keep your local edits.')


def change(db, item, version, values):
    check_version(item, version)
    model = type(item)
    changed = db.execute(update(model).where(model.id == item.id, model.student_pk == item.student_pk,
                        model.version == version).values(**values, version=version + 1, updated_at=now()),
                        execution_options={'synchronize_session': False}).rowcount
    if changed != 1:
        db.rollback()
        error(409, 'VERSION_CONFLICT', 'This item changed. Reload before retrying.')
    db.commit()
    db.refresh(item)
    return item


def readable(text):
    try:
        return enhancer.validate_text(text)
    except SearchFailure as exc:
        error(exc.status, exc.code, exc.message)


async def uploaded(file):
    try:
        return parse_resume(await file.read(MAX_RESUME_BYTES + 1), file.filename or '', file.content_type)
    except SearchFailure as exc:
        error(exc.status, exc.code, exc.message)
    finally:
        await file.close()


def create_resume(db, student, text, consent, filename='pasted-resume.txt'):
    if not consent:
        error(422, 'CONSENT_REQUIRED', 'Consent to private storage is required; you can delete the saved resume at any time')
    if db.scalar(select(func.count()).select_from(models.ResumeWorkspace).where(models.ResumeWorkspace.student_pk == student.id)) >= 20:
        error(422, 'WORKSPACE_LIMIT', 'Delete an older resume before saving another (limit 20)')
    text = readable(text)
    item = models.ResumeWorkspace(student_pk=student.id, filename=PurePath(filename.replace('\\', '/')).name[:200], original_text=text,
                                  revised_text=text, target={}, decisions={})
    db.add(item); db.commit(); db.refresh(item)
    return item


@router.get('/resumes', response_model=list[s.ResumeWorkspaceOut])
def resumes(db: Session = Depends(get_db), student=Depends(owner)):
    return db.scalars(select(models.ResumeWorkspace).where(models.ResumeWorkspace.student_pk == student.id).order_by(models.ResumeWorkspace.updated_at.desc())).all()


@router.post('/resumes', response_model=s.ResumeWorkspaceOut, status_code=201)
def resume_create(body: s.ResumeCreateIn, db: Session = Depends(get_db), student=Depends(owner)):
    return create_resume(db, student, body.text, body.storage_consent)


@router.post('/resumes/upload', response_model=s.ResumeWorkspaceOut, status_code=201)
async def resume_upload(file: UploadFile = File(), storage_consent: bool = Form(), db: Session = Depends(get_db), student=Depends(owner)):
    if not storage_consent:
        error(422, 'CONSENT_REQUIRED', 'Consent to private resume storage is required')
    return create_resume(db, student, await uploaded(file), storage_consent, file.filename or 'resume.txt')


@router.get('/resumes/{item_id}', response_model=s.ResumeWorkspaceOut)
def resume_get(item_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    return owned(db, models.ResumeWorkspace, item_id, student)


@router.delete('/resumes/{item_id}')
def resume_delete(item_id: int, version: int = Query(ge=1), db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.ResumeWorkspace, item_id, student); check_version(item, version)
    db.delete(item); db.commit()
    return {'deleted': True}


@router.delete('/workspace/session-data')
def clear_session_data(db: Session = Depends(get_db), student=Depends(owner)):
    """Remove private uploads and derived analysis when a student signs out."""
    db.execute(delete(models.ResumeWorkspace).where(models.ResumeWorkspace.student_pk == student.id))
    db.execute(delete(models.LinkedInAuthorization).where(models.LinkedInAuthorization.student_pk == student.id))
    db.execute(delete(models.LinkedInPublicLookup).where(models.LinkedInPublicLookup.student_pk == student.id))
    db.execute(delete(models.LinkedInProfile).where(models.LinkedInProfile.student_pk == student.id))
    db.execute(delete(models.RoadmapItem).where(models.RoadmapItem.student_pk == student.id))
    db.execute(delete(models.Analysis).where(models.Analysis.student_pk == student.id))
    db.commit()
    return {'deleted': True}


@router.post('/resumes/{item_id}/analyze', response_model=s.ResumeWorkspaceOut)
def resume_analyze(item_id: int, body: s.ResumeTargetIn, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.ResumeWorkspace, item_id, student); check_version(item, body.version)
    title, description, source, url = body.title.strip(), body.description.strip(), 'user_provided', None
    if body.job_id:
        listing = get_listing(db, body.job_id)
        if listing is None:
            error(404, 'JOB_NOT_FOUND', 'Retrieved listing not found; choose another or paste the description')
        if listing.provenance.value != 'serpapi_live':
            error(422, 'LIVE_LISTING_REQUIRED', 'Choose a real retrieved listing or paste your own job description')
        title, description, source = listing.title, listing.description, 'serpapi_live'
        url = str(listing.source_url) if listing.source_url else None
    if len(description.strip()) < 30:
        error(422, 'DESCRIPTION_INCOMPLETE', 'The listing has insufficient description text. Paste the complete description instead.')
    analysis = enhancer.analyze_resume(db, student, item.original_text, title, description, source, url)
    return change(db, item, body.version, {'target': {'job_id': body.job_id, 'title': title, 'description': description, 'source': source, 'source_url': url},
                                         'analysis': analysis.model_dump(mode='json'), 'decisions': {}})


@router.patch('/resumes/{item_id}/suggestions/{suggestion_id}', response_model=s.ResumeWorkspaceOut)
def decision(item_id: int, suggestion_id: str, body: s.ResumeDecisionIn, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.ResumeWorkspace, item_id, student)
    suggestion = next((x for x in (item.analysis or {}).get('suggestions', []) if x['id'] == suggestion_id), None)
    if suggestion is None:
        error(404, 'SUGGESTION_NOT_FOUND', 'Analyze this resume before reviewing the suggestion')
    confirmation = body.confirmation.strip()
    if body.decision == 'accepted' and suggestion['kind'] == 'append':
        detected = {x.name for x in extract_requirements(confirmation)}
        if len(confirmation) < 12 or suggestion['skill'] not in detected:
            error(422, 'FACTUAL_EVIDENCE_REQUIRED', 'Describe your actual work with this skill before adding it; no experience or metrics will be invented')
    decisions = dict(item.decisions)
    decisions[suggestion_id] = {'decision': body.decision, 'confirmation': confirmation}
    return change(db, item, body.version, {'decisions': decisions})


@router.post('/resumes/{item_id}/apply', response_model=s.ResumeWorkspaceOut)
def apply(item_id: int, body: s.ResumeVersionIn, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.ResumeWorkspace, item_id, student)
    if not item.analysis:
        error(422, 'ANALYSIS_REQUIRED', 'Analyze the resume first')
    try:
        revision = enhancer.approved_revision(item)
    except SearchFailure as exc:
        error(exc.status, exc.code, exc.message)
    return change(db, item, body.version, {'revised_text': revision})


@router.put('/resumes/{item_id}/revision', response_model=s.ResumeWorkspaceOut)
def save(item_id: int, body: s.ResumeSaveIn, db: Session = Depends(get_db), student=Depends(owner)):
    if not body.factual_confirmation:
        error(422, 'FACTUAL_REVIEW_REQUIRED', 'Confirm that your edited resume contains only accurate information')
    return change(db, owned(db, models.ResumeWorkspace, item_id, student), body.version, {'revised_text': readable(body.text)})


@router.post('/resumes/{item_id}/restore', response_model=s.ResumeWorkspaceOut)
def restore(item_id: int, body: s.ResumeVersionIn, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.ResumeWorkspace, item_id, student)
    return change(db, item, body.version, {'revised_text': item.original_text, 'decisions': {}})


@router.post('/resumes/{item_id}/export')
def export(item_id: int, body: s.ResumeExportIn, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.ResumeWorkspace, item_id, student); check_version(item, body.version)
    if not body.final_review_confirmed:
        error(422, 'FINAL_REVIEW_REQUIRED', 'Review the saved final text before downloading')
    data = enhancer.export_document(item.revised_text, body.format)
    return Response(data, media_type=DOCX_MIME if body.format == 'docx' else 'text/plain; charset=utf-8',
                    headers={'Content-Disposition': f'attachment; filename="skillup-resume-{item.id}.{body.format}"', 'Cache-Control': 'no-store'})


def invalidate(db, student):
    # Preserve independently approved resume text; discard source-derived analysis and decisions.
    db.execute(update(models.ResumeWorkspace).where(models.ResumeWorkspace.student_pk == student.id).values(
        analysis=None, decisions={}, version=models.ResumeWorkspace.version + 1, updated_at=now()))


def linkedin_out(item=None):
    result = s.LinkedInOut.model_validate(item, from_attributes=True) if item else s.LinkedInOut()
    result.automatic_import_available = get_settings().linkedin_configured
    return result


def store_linkedin(db, student, body, method):
    if not body.consent:
        error(422, 'CONSENT_REQUIRED', 'Consent is required to store and analyze your supplied profile')
    if not body.profile_url and not body.profile_text.strip():
        error(422, 'PROFILE_REQUIRED', 'Supply a LinkedIn profile URL or your profile information')
    text = readable(body.profile_text) if body.profile_text.strip() else ''
    if body.lookup_id:
        lookup = db.get(models.LinkedInPublicLookup, student.id)
        if not lookup or lookup.id != body.lookup_id:
            error(404, 'LOOKUP_NOT_FOUND', 'Your public profile preview is unavailable. Search again.')
        if lookup.result['profile_url'] != body.profile_url or lookup.result['status'] != 'found':
            error(422, 'LOOKUP_MISMATCH', 'Review a successful preview for this exact profile URL before saving.')
        if not body.confirmed or not text:
            error(422, 'PROFILE_REVIEW_REQUIRED', 'Review the retrieved text and confirm it describes your own background before saving.')
        method = 'public_search_reviewed'
    item = db.get(models.LinkedInProfile, student.id)
    if item is None:
        item = models.LinkedInProfile(student_pk=student.id); db.add(item)
    item.profile_url, item.profile_text = body.profile_url, text
    item.confirmed, item.import_method = body.confirmed, method if text else None
    item.consent_at = item.updated_at = now()
    invalidate(db, student); db.commit(); db.refresh(item)
    return linkedin_out(item)


@router.get('/profile/linkedin', response_model=s.LinkedInOut)
def linkedin_get(db: Session = Depends(get_db), student=Depends(owner)):
    item = db.get(models.LinkedInProfile, student.id)
    return linkedin_out(item)


@router.put('/profile/linkedin', response_model=s.LinkedInOut)
def linkedin_put(body: s.LinkedInIn, db: Session = Depends(get_db), student=Depends(owner)):
    return store_linkedin(db, student, body, 'pasted_summary')


@router.post('/profile/linkedin/analyze', response_model=s.LinkedInAnalysisOut)
def linkedin_analyze(body: s.LinkedInAnalyzeIn, db: Session = Depends(get_db), student=Depends(owner)):
    from app.services.linkedin_insights import analyze_profile
    item = db.get(models.LinkedInProfile, student.id)
    if not item or not item.consent_at or len(item.profile_text.strip()) < 30:
        error(422, 'PROFILE_TEXT_REQUIRED', 'Save at least 30 characters of career information with consent before analysis')
    if body.job_description.strip():
        try:
            enhancer.validate_text(body.job_description)
        except SearchFailure:
            error(422, 'INVALID_TARGET_DESCRIPTION', 'Use 30-20,000 readable characters for the target description')
    return analyze_profile(item.profile_text, item.import_method, item.confirmed, body.target_role, body.job_description)


@router.post('/profile/linkedin/upload', response_model=s.LinkedInOut)
async def linkedin_upload(file: UploadFile = File(), consent: bool = Form(), profile_url: str | None = Form(default=None),
                          confirmed: bool = Form(default=False), db: Session = Depends(get_db), student=Depends(owner)):
    if not consent:
        error(422, 'CONSENT_REQUIRED', 'Consent is required to import your own profile export')
    try:
        body = s.LinkedInIn(profile_url=profile_url, profile_text=await uploaded(file), consent=consent, confirmed=confirmed)
    except ValueError:
        error(422, 'INVALID_PROFILE_URL', 'Use an HTTPS linkedin.com/in/ profile URL')
    return store_linkedin(db, student, body, 'user_export')


@router.post('/profile/linkedin/automatic', response_model=s.LinkedInAuthorizationOut)
def linkedin_automatic(body: s.LinkedInIn, db: Session = Depends(get_db), student=Depends(owner)):
    if not body.consent:
        error(422, 'CONSENT_REQUIRED', 'Consent is required to connect your LinkedIn account')
    # The URL is optional metadata; OAuth always retrieves the consenting member.
    return linkedin.start(db, student)


@router.get('/profile/linkedin/public-search', response_model=s.LinkedInPublicSearchOut | None)
def linkedin_public_latest(db: Session = Depends(get_db), student=Depends(owner)):
    item = db.get(models.LinkedInPublicLookup, student.id)
    return s.LinkedInPublicSearchOut.model_validate(item.result) if item else None


@router.post('/profile/linkedin/public-search', response_model=s.LinkedInPublicSearchOut)
async def linkedin_public_search(body: s.LinkedInPublicSearchIn, db: Session = Depends(get_db), student=Depends(owner)):
    if not body.consent:
        error(422, 'CONSENT_REQUIRED', 'Consent is required to search this public profile URL and store the preview.')
    item = db.get(models.LinkedInPublicLookup, student.id)
    if item and item.result['profile_url'] == body.profile_url:
        previous = s.LinkedInPublicSearchOut.model_validate(item.result)
        if (now() - previous.retrieved_at).total_seconds() < 900:
            return previous.model_copy(update={'cache_status': 'cached'})
    try:
        result = await linkedin_public.lookup(body.profile_url, get_settings())
    except SearchFailure as exc:
        raise HTTPException(exc.status, detail={'code': exc.code, 'message': exc.message, 'retryable': exc.retryable}) from None
    if item is None:
        item = models.LinkedInPublicLookup(student_pk=student.id)
        db.add(item)
    item.id, item.result = result.id, result.model_dump(mode='json')
    db.commit()
    return result


@router.get('/profile/linkedin/connection/{attempt_id}', response_model=s.LinkedInConnectionOut)
def linkedin_connection(attempt_id: str, db: Session = Depends(get_db), student=Depends(owner)):
    return s.LinkedInConnectionOut.model_validate(linkedin.connection(db, student, attempt_id), from_attributes=True)


@router.get('/profile/linkedin/connection', response_model=s.LinkedInConnectionOut | None)
def linkedin_latest_connection(db: Session = Depends(get_db), student=Depends(owner)):
    item = linkedin.latest_connection(db, student)
    return s.LinkedInConnectionOut.model_validate(item, from_attributes=True) if item else None


@router.delete('/profile/linkedin/connection/{attempt_id}')
def linkedin_cancel(attempt_id: str, db: Session = Depends(get_db), student=Depends(owner)):
    item = linkedin.connection(db, student, attempt_id)
    db.delete(item); db.commit()
    return {'deleted': True}


@router.get('/profile/linkedin/callback', response_class=HTMLResponse)
async def linkedin_callback(request: Request, db: Session = Depends(get_db)):
    status = await linkedin.callback(db, getattr(request.state, 'linkedin_callback_params', {}))
    title = 'LinkedIn connected' if status == 'connected' else 'LinkedIn connection unsuccessful'
    return HTMLResponse(f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
        f'<title>{title}</title><body><h1>{title}</h1><p>Return to your Skillup tab to see the result. You can close this tab.</p></body></html>',
        headers={'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
                 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"})


@router.delete('/profile/linkedin')
def linkedin_delete(db: Session = Depends(get_db), student=Depends(owner)):
    from sqlalchemy import delete
    db.execute(delete(models.LinkedInAuthorization).where(models.LinkedInAuthorization.student_pk == student.id))
    db.execute(delete(models.LinkedInPublicLookup).where(models.LinkedInPublicLookup.student_pk == student.id))
    item = db.get(models.LinkedInProfile, student.id)
    if item:
        db.delete(item)
    invalidate(db, student); db.commit()
    return {'deleted': True, 'message': 'Imported profile and derived analyses removed. Previously approved resume text is preserved; delete a resume to remove that copy.'}


def references(db, student, values):
    milestone = values.get('roadmap_milestone_id')
    skill = values.get('skill_id')
    if milestone:
        item = owned(db, models.RoadmapItem, milestone, student)
        if skill and skill != item.skill_id:
            error(422, 'SKILL_MISMATCH', 'The task skill must match its linked milestone')
        values['skill_id'] = item.skill_id
    elif skill and db.get(models.Skill, skill) is None:
        error(422, 'SKILL_NOT_FOUND', 'Choose an existing skill')


@router.get('/roadmap/skills', response_model=list[s.SkillOut])
def task_skills(db: Session = Depends(get_db), student=Depends(owner)):
    return db.scalars(select(models.Skill).order_by(models.Skill.canonical_name).limit(500)).all()


@router.get('/roadmap/milestones/{item_id}', response_model=s.RoadmapItemOut)
def milestone_get(item_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    return owned(db, models.RoadmapItem, item_id, student)


@router.get('/roadmap/tasks', response_model=s.TaskListOut)
def tasks(view: Literal['all', 'today', 'upcoming', 'completed'] = 'all', sort: Literal['due_date', 'priority', 'updated', 'title'] = 'due_date',
          db: Session = Depends(get_db), student=Depends(owner)):
    rows = list(db.scalars(select(models.RoadmapTask).where(models.RoadmapTask.student_pk == student.id)))
    completed = sum(x.status == 'done' for x in rows)
    counts = {}
    for x in rows:
        if x.roadmap_milestone_id:
            count = counts.setdefault(x.roadmap_milestone_id, {'total': 0, 'completed': 0})
            count['total'] += 1; count['completed'] += int(x.status == 'done')
    today = now().date()
    filtered = [x for x in rows if view == 'all' or (view == 'completed' and x.status == 'done')
                or (view == 'today' and x.status != 'done' and x.due_date == today)
                or (view == 'upcoming' and x.status != 'done' and x.due_date is not None and x.due_date > today)]
    keys = {'due_date': lambda x: (x.due_date or date.max, x.id), 'priority': lambda x: ({'high': 0, 'medium': 1, 'low': 2}[x.priority], x.id),
            'updated': lambda x: (-x.updated_at.timestamp(), x.id), 'title': lambda x: (x.title.casefold(), x.id)}
    return s.TaskListOut(tasks=sorted(filtered, key=keys[sort]), total=len(rows), completed=completed, remaining=len(rows) - completed,
                        completion_percentage=round(completed / len(rows) * 100, 1) if rows else None, milestone_counts=counts)


@router.post('/roadmap/tasks', response_model=s.RoadmapTaskOut, status_code=201)
def task_create(body: s.RoadmapTaskIn, db: Session = Depends(get_db), student=Depends(owner)):
    if db.scalar(select(func.count()).select_from(models.RoadmapTask).where(models.RoadmapTask.student_pk == student.id)) >= 500:
        error(422, 'TASK_LIMIT', 'Delete an older task before adding another (limit 500)')
    values = body.model_dump(mode='python'); references(db, student, values)
    item = models.RoadmapTask(student_pk=student.id, **values)
    db.add(item); db.commit(); db.refresh(item)
    return item


@router.patch('/roadmap/tasks/{item_id}', response_model=s.RoadmapTaskOut)
def task_update(item_id: int, body: s.RoadmapTaskPatch, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.RoadmapTask, item_id, student)
    values = body.model_dump(exclude_unset=True, exclude={'version'}, mode='python')
    if any(values.get(key) is None for key in ('title', 'description', 'status', 'priority') if key in values):
        error(422, 'INVALID_TASK', 'Title, description, status and priority cannot be null')
    if 'title' in values:
        values['title'] = values['title'].strip()
        if not values['title']:
            error(422, 'INVALID_TASK', 'Task title cannot be blank')
    if 'roadmap_milestone_id' in values or 'skill_id' in values:
        refs = {'roadmap_milestone_id': values.get('roadmap_milestone_id', item.roadmap_milestone_id), 'skill_id': values.get('skill_id', item.skill_id)}
        if 'roadmap_milestone_id' in values and 'skill_id' not in values:
            refs['skill_id'] = None if values['roadmap_milestone_id'] else item.skill_id
        references(db, student, refs); values.update(refs)
    if 'status' in values:
        values['completed_at'] = (item.completed_at or now()) if values['status'] == 'done' else None
    return change(db, item, body.version, values)


@router.delete('/roadmap/tasks/{item_id}')
def task_delete(item_id: int, version: int = Query(ge=1), db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, models.RoadmapTask, item_id, student); check_version(item, version)
    db.delete(item); db.commit()
    return {'deleted': True}
