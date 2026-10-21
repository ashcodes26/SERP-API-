"""Faculty and student placement workflows. Every faculty object is scope checked."""
import csv
import io
import uuid
from datetime import date, datetime, UTC
from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy import select, update, or_
from sqlalchemy.orm import Session
from app import models as m, schemas as s
from app.auth import Principal, current_principal, require_admin, allow_student
from app.db import get_db
from app.routes.workspace import owner, owned, check_version
from app.services import placement as p, imports
from app.services.analysis import get_profile, get_job
from app.services.accounts import backfill_accounts
from app.services.learning import get_questions
from app.config import get_settings

router = APIRouter(prefix='/api', tags=['placement'])


@router.get('/placement/journey')
def journey(db: Session = Depends(get_db), student=Depends(owner)):
    from app.services.demo_seed import seed_role
    role = seed_role(db)
    return {'student_id': student.id, 'job_id': role.id, 'synthetic': student.is_synthetic}


@router.get('/admin/cohorts', response_model=list[s.CohortOut])
def cohorts(db: Session = Depends(get_db), principal=Depends(require_admin)):
    rows = db.scalars(select(m.Cohort).where(m.Cohort.admin_id == principal.account_id).order_by(m.Cohort.id))
    return [s.CohortOut(**s.CohortIn.model_validate(row, from_attributes=True).model_dump(), id=row.id,
            students=len(p.cohort_ids(db, principal, row.id))) for row in rows]


@router.post('/admin/demo', response_model=s.FacultyDemoOut)
def demo_records(db: Session = Depends(get_db), principal=Depends(require_admin)):
    if get_settings().app_env not in {'development', 'test'}:
        p.fail(404, 'DEMO_DISABLED', 'Demo fixtures are available only in local development.')
    from app.services.faculty_demo import load_demo
    return load_demo(db, principal)


@router.post('/admin/cohorts', response_model=s.CohortOut, status_code=201)
def create_cohort(body: s.CohortIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    item = m.Cohort(admin_id=principal.account_id, **body.model_dump())
    db.add(item); db.flush(); p.audit(db, principal, 'cohort_created', 'cohort', item.id); db.commit()
    return item


def filters(q: str = Query(default='', max_length=120), department: str | None = Query(default=None, max_length=120),
            batch: str | None = Query(default=None, max_length=40), section: str | None = Query(default=None, max_length=40),
            progress: str | None = Query(default=None, pattern='^(follow_up|complete)$'), cohort_id: int | None = Query(default=None, gt=0)):
    return dict(q=q, department=department, batch=batch, section=section, progress=progress, cohort_id=cohort_id)


@router.get('/admin/students', response_model=s.PlacementStudentsOut)
def students(page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=100),
             query=Depends(filters), db: Session = Depends(get_db), principal=Depends(require_admin)):
    rows = p.filtered_students(db, principal, **query)
    return s.PlacementStudentsOut(items=rows[(page-1)*page_size:page*page_size], total=len(rows), page=page, page_size=page_size)


@router.get('/admin/dashboard', response_model=s.PlacementDashboardOut)
def dashboard(query=Depends(filters), db: Session = Depends(get_db), principal=Depends(require_admin)):
    return p.dashboard(p.filtered_students(db, principal, **query))


@router.get('/admin/students/{student_id}', response_model=s.PlacementDetailOut)
def detail(student_id: int, db: Session = Depends(get_db), principal=Depends(require_admin)):
    allow_student(principal, student_id)
    student = db.get(m.Student, student_id)
    if not student: p.fail(404, 'STUDENT_NOT_FOUND', 'Assigned student not found')
    reviews = db.scalars(select(m.FacultyResumeReview).where(m.FacultyResumeReview.student_pk == student_id,
                        m.FacultyResumeReview.admin_id == principal.account_id, m.FacultyResumeReview.shared.is_(True)).order_by(m.FacultyResumeReview.id.desc()))
    return s.PlacementDetailOut(profile=get_profile(db, student), summary=p.summaries(db, principal, [student])[0],
        assessments=list(db.scalars(select(m.Assessment).where(m.Assessment.student_pk == student_id))),
        roadmap=list(db.scalars(select(m.RoadmapItem).where(m.RoadmapItem.student_pk == student_id))),
        training=list(db.scalars(select(m.TrainingAssignment).where(m.TrainingAssignment.student_pk == student_id, m.TrainingAssignment.admin_id == principal.account_id))),
        applications=[p.application_out(db, x) for x in db.scalars(select(m.PlacementApplication).join(m.PlacementDrive).where(
            m.PlacementApplication.student_pk == student_id, m.PlacementDrive.admin_id == principal.account_id))],
        reviews=[p.review_out(db, x) for x in reviews])


@router.get('/admin/roles', response_model=list[s.JobOut])
def roles(db: Session = Depends(get_db), principal=Depends(require_admin)):
    return [get_job(db, x) for x in db.scalars(select(m.Job).where(m.Job.skills.any()).order_by(m.Job.id).limit(500))]


@router.get('/admin/skill-gaps', response_model=s.BatchGapOut)
def gaps(cohort_id: int = Query(gt=0), job_id: int = Query(gt=0), db: Session = Depends(get_db), principal=Depends(require_admin)):
    return p.batch_gaps(db, principal, cohort_id, job_id)


def csv_safe(value):
    value = '' if value is None else str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r', '\n')) or value.startswith(('\t', '\r', '\n')) else value


@router.get('/admin/report')
def report(query=Depends(filters), job_id: int | None = Query(default=None, gt=0), db: Session = Depends(get_db), principal=Depends(require_admin)):
    rows = p.filtered_students(db, principal, **query)
    role = None
    if job_id:
        job = db.get(m.Job, job_id)
        if not job: p.fail(404, 'ROLE_NOT_FOUND', 'Target role not found')
        role = get_job(db, job)
        if not role.skills: p.fail(422, 'ROLE_REQUIREMENTS_REQUIRED', 'Choose a role with requirements')
    out = io.StringIO(newline=''); writer = csv.writer(out)
    writer.writerow(['student_id', 'name', 'department', 'batch', 'section', 'profile_completion_percent', 'resume_review_status',
        'assessment_attempts', 'roadmap_completed', 'roadmap_total', 'training_completed', 'training_total', 'overdue_training',
        'applications', 'offered_applications', 'application_stages', 'target_role', 'known_skill_gaps', 'unknown_proficiency_skills'])
    from app.services.intelligence import score_role
    for row in rows:
        known, unknown = [], []
        if role:
            scored = score_role(role, get_profile(db, db.get(m.Student, row.id)).competencies)
            known = [f'{x.skill.canonical_name}:{x.gap}' for x in scored.gaps if x.gap is not None]
            unknown = [x.skill.canonical_name for x in scored.gaps if x.gap is None]
        stages = list(db.scalars(select(m.PlacementApplication.stage).join(m.PlacementDrive).where(m.PlacementApplication.student_pk == row.id, m.PlacementDrive.admin_id == principal.account_id)))
        writer.writerow([csv_safe(x) for x in [row.student_id, row.name, row.department, row.batch, row.section,
            row.profile_completion, row.resume_status, row.assessments_completed, row.roadmap_completed, row.roadmap_total,
            row.training_completed, row.training_total, row.overdue, row.applications, row.offers, '; '.join(stages),
            role.title if role else '', '; '.join(known), '; '.join(unknown)]])
    p.audit(db, principal, 'report_exported', 'cohort', query['cohort_id']); db.commit()
    return Response(out.getvalue(), media_type='text/csv', headers={'Content-Disposition': 'attachment; filename="aimora-cohort.csv"', 'Cache-Control': 'no-store'})


@router.get('/placement/faculty', response_model=list[s.AccountOut])
def faculty(db: Session = Depends(get_db), student=Depends(owner)):
    return [s.AccountOut(account_id=x.id, username=x.username, role=x.role, student_id=None) for x in db.scalars(
        select(m.Account).join(m.FacultyScope, m.FacultyScope.admin_id == m.Account.id).where(
            m.FacultyScope.student_pk == student.id, m.Account.active.is_(True), m.Account.role == 'admin'))]


@router.get('/placement/resume-reviews', response_model=list[s.FacultyReviewOut])
def student_reviews(db: Session = Depends(get_db), student=Depends(owner)):
    return [p.review_out(db, x) for x in db.scalars(select(m.FacultyResumeReview).where(m.FacultyResumeReview.student_pk == student.id).order_by(m.FacultyResumeReview.id.desc()))]


@router.get('/placement/resume-revisions/{workspace_id}', response_model=list[s.ResumeRevisionOut])
def revisions(workspace_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, m.ResumeWorkspace, workspace_id, student)
    p.snapshot(db, item); db.commit()
    return list(db.scalars(select(m.ResumeRevision).where(m.ResumeRevision.workspace_id == item.id).order_by(m.ResumeRevision.version.desc())))


@router.post('/placement/resume-reviews', response_model=s.FacultyReviewOut, status_code=201)
def share(body: s.ReviewShareIn, db: Session = Depends(get_db), student=Depends(owner)):
    if not body.consent: p.fail(422, 'SHARING_CONSENT_REQUIRED', 'Explicit sharing consent is required')
    item = owned(db, m.ResumeWorkspace, body.workspace_id, student); check_version(item, body.version)
    admin = db.get(m.Account, body.admin_id)
    if not admin or not admin.active or admin.role != 'admin' or not db.get(m.FacultyScope, (body.admin_id, student.id)):
        p.fail(403, 'FACULTY_NOT_ASSIGNED', 'Choose a faculty member assigned to your record')
    revision = p.snapshot(db, item)
    existing = db.scalar(select(m.FacultyResumeReview).where(m.FacultyResumeReview.revision_id == revision.id,
        m.FacultyResumeReview.admin_id == admin.id, m.FacultyResumeReview.shared.is_(True)))
    if existing: p.fail(409, 'ALREADY_SHARED', 'This revision is already shared. Save a new revision to resubmit changes.')
    review = m.FacultyResumeReview(student_pk=student.id, admin_id=admin.id, revision_id=revision.id,
        suggestions=item.analysis if body.share_suggestions and (item.analysis or {}).get('engine') == 'gemini' else None)
    db.add(review); db.commit()
    return p.review_out(db, review)


@router.delete('/placement/resume-reviews/{review_id}')
def revoke_share(review_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, m.FacultyResumeReview, review_id, student)
    item.shared = False; db.commit()
    return {'revoked': True}


@router.post('/admin/resume-reviews/{review_id}', response_model=s.FacultyReviewOut)
def decide(review_id: int, body: s.ReviewDecisionIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    item = db.get(m.FacultyResumeReview, review_id)
    if not item or item.admin_id != principal.account_id or not item.shared:
        p.fail(404, 'REVIEW_NOT_FOUND', 'Shared review not found')
    allow_student(principal, item.student_pk)
    changed = db.execute(update(m.FacultyResumeReview).where(m.FacultyResumeReview.id == item.id,
        m.FacultyResumeReview.status == 'submitted', m.FacultyResumeReview.shared.is_(True)).values(status=body.status)).rowcount
    if changed != 1: p.fail(409, 'REVIEW_ALREADY_DECIDED', 'Save and submit a new revision after a review decision')
    db.add(m.FacultyReviewFeedback(review_id=item.id, status=body.status, feedback=body.feedback))
    p.audit(db, principal, 'resume_' + body.status, 'resume_review', item.id); db.commit(); db.refresh(item)
    return p.review_out(db, item)


def drive_owned(db, principal, drive_id):
    item = db.get(m.PlacementDrive, drive_id)
    if not item or item.admin_id != principal.account_id: p.fail(404, 'DRIVE_NOT_FOUND', 'Drive not found')
    p.cohort(db, principal, item.cohort_id)
    return item


@router.get('/admin/drives', response_model=list[s.DriveOut])
def admin_drives(db: Session = Depends(get_db), principal=Depends(require_admin)):
    return list(db.scalars(select(m.PlacementDrive).where(m.PlacementDrive.admin_id == principal.account_id).order_by(m.PlacementDrive.id.desc())))


@router.post('/admin/drives', response_model=s.DriveOut, status_code=201)
def create_drive(body: s.DriveIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    p.cohort(db, principal, body.cohort_id)
    item = m.PlacementDrive(admin_id=principal.account_id, **body.model_dump(mode='json'))
    item.deadline = body.deadline
    db.add(item); db.flush(); p.audit(db, principal, 'drive_created', 'drive', item.id); db.commit()
    return item


@router.put('/admin/drives/{drive_id}', response_model=s.DriveOut)
def edit_drive(drive_id: int, body: s.DriveUpdateIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    item = drive_owned(db, principal, drive_id)
    if body.cohort_id != item.cohort_id: p.fail(422, 'COHORT_IMMUTABLE', 'Create a new drive for a different cohort')
    values = body.model_dump(mode='json', exclude={'version'}); values['deadline'] = body.deadline
    changed = db.execute(update(m.PlacementDrive).where(m.PlacementDrive.id == drive_id, m.PlacementDrive.version == body.version)
        .values(**values, version=body.version+1)).rowcount
    if changed != 1: p.fail(409, 'VERSION_CONFLICT', 'Drive changed; reload before editing')
    p.audit(db, principal, 'drive_updated', 'drive', item.id); db.commit(); db.refresh(item)
    return item


def visible_drive(db, student, drive_id):
    item = db.get(m.PlacementDrive, drive_id)
    if not item or not db.get(m.CohortMember, (item.cohort_id, student.id)) or not db.get(m.FacultyScope, (item.admin_id, student.id)):
        p.fail(404, 'DRIVE_NOT_FOUND', 'Opportunity not available to your cohort')
    return item


@router.get('/placement/drives', response_model=list[s.DriveOut])
def student_drives(db: Session = Depends(get_db), student=Depends(owner)):
    rows = db.scalars(select(m.PlacementDrive).join(m.CohortMember, m.CohortMember.cohort_id == m.PlacementDrive.cohort_id)
        .join(m.FacultyScope, (m.FacultyScope.admin_id == m.PlacementDrive.admin_id) & (m.FacultyScope.student_pk == m.CohortMember.student_pk))
        .where(m.CohortMember.student_pk == student.id).order_by(m.PlacementDrive.deadline))
    return [s.DriveOut.model_validate(x).model_copy(update={'decision': p.eligibility(student, x.eligibility)}) for x in rows]


@router.post('/placement/drives/{drive_id}/apply', response_model=s.ApplicationOut, status_code=201)
def apply(drive_id: int, db: Session = Depends(get_db), student=Depends(owner), principal=Depends(current_principal)):
    drive = visible_drive(db, student, drive_id)
    existing = db.scalar(select(m.PlacementApplication).where(m.PlacementApplication.drive_id == drive.id, m.PlacementApplication.student_pk == student.id))
    if existing: p.fail(409, 'ALREADY_APPLIED', 'Application is already tracked')
    if drive.deadline < date.today(): p.fail(409, 'DEADLINE_PASSED', 'Application deadline has passed')
    item = m.PlacementApplication(drive_id=drive.id, student_pk=student.id)
    db.add(item); db.flush()
    db.add(m.ApplicationEvent(application_id=item.id, actor_id=principal.account_id, stage='applied', note='Student reported an application. Eligibility remains subject to faculty review.'))
    db.commit(); return p.application_out(db, item)


@router.get('/placement/applications', response_model=list[s.ApplicationOut])
def student_applications(db: Session = Depends(get_db), student=Depends(owner)):
    return [p.application_out(db, x) for x in db.scalars(select(m.PlacementApplication).where(m.PlacementApplication.student_pk == student.id))]


@router.patch('/placement/applications/{application_id}', response_model=s.ApplicationOut)
def update_application(application_id: int, body: s.ApplicationUpdateIn, db: Session = Depends(get_db), principal=Depends(current_principal)):
    item = db.get(m.PlacementApplication, application_id)
    if not item: p.fail(404, 'APPLICATION_NOT_FOUND', 'Application not found')
    if principal.role == 'admin':
        drive_owned(db, principal, item.drive_id); allow_student(principal, item.student_pk)
    elif principal.student_id != item.student_pk:
        p.fail(403, 'FORBIDDEN', 'You can only update your own application')
    if principal.role != 'admin' and (body.eligibility_override is not None or body.review_reason is not None):
        p.fail(403, 'FACULTY_REVIEW_REQUIRED', 'Only faculty can review eligibility')
    if body.eligibility_override is not None and not body.review_reason:
        p.fail(422, 'REASON_REQUIRED', 'Explain the eligibility review decision')
    if item.stage == 'withdrawn' and body.stage != 'withdrawn':
        p.fail(409, 'APPLICATION_WITHDRAWN', 'A withdrawn application cannot be reopened')
    values = {'stage': body.stage, 'version': body.version+1, 'updated_at': datetime.now(UTC)}
    if principal.role == 'admin' and body.eligibility_override is not None:
        values.update(eligibility_override=body.eligibility_override, review_reason=body.review_reason)
    changed = db.execute(update(m.PlacementApplication).where(m.PlacementApplication.id == item.id, m.PlacementApplication.version == body.version).values(**values)).rowcount
    if changed != 1: p.fail(409, 'VERSION_CONFLICT', 'Application changed; reload before updating')
    db.add(m.ApplicationEvent(application_id=item.id, actor_id=principal.account_id, stage=body.stage, note=body.note))
    p.audit(db, principal, 'application_outcome_updated', 'application', item.id); db.commit(); db.refresh(item)
    return p.application_out(db, item)


@router.patch('/admin/applications/{application_id}', response_model=s.ApplicationOut)
def admin_application(application_id: int, body: s.ApplicationUpdateIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    return update_application(application_id, body, db, principal)


@router.post('/admin/training', response_model=list[s.TrainingOut], status_code=201)
def assign(body: s.TrainingIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    ids = set(body.student_ids)
    if body.cohort_id: ids.update(p.cohort_ids(db, principal, body.cohort_id))
    if not ids: p.fail(422, 'ASSIGNEES_REQUIRED', 'Choose assigned students or a non-empty cohort')
    for sid in ids:
        allow_student(principal, sid)
        if not db.get(m.Student, sid): p.fail(404, 'STUDENT_NOT_FOUND', 'Assigned student not found')
    if body.kind == 'assessment':
        skill = db.get(m.Skill, body.skill_id) if body.skill_id else None
        if not skill or not get_questions(skill): p.fail(422, 'ASSESSMENT_REQUIRED', 'Choose a skill with an existing assessment')
    elif body.skill_id and not db.get(m.Skill, body.skill_id): p.fail(422, 'SKILL_NOT_FOUND', 'Skill not found')
    if body.kind in {'resource', 'course'} and not body.resource_url and not body.roadmap_item_id:
        p.fail(422, 'RESOURCE_REQUIRED', 'Provide a learning resource URL or an existing roadmap item')
    if body.roadmap_item_id:
        milestone = db.get(m.RoadmapItem, body.roadmap_item_id)
        if len(ids) != 1 or not milestone or milestone.student_pk not in ids:
            p.fail(422, 'ROADMAP_OWNER_MISMATCH', 'A roadmap item can only be assigned to its owner')
    group = uuid.uuid4().hex
    values = body.model_dump(mode='json', exclude={'student_ids', 'cohort_id'}); values['deadline'] = body.deadline
    if body.roadmap_item_id and not values['resource_url']:
        values['resource_url'] = milestone.resource_url
    rows = [m.TrainingAssignment(group_key=group, admin_id=principal.account_id, student_pk=sid, **values) for sid in sorted(ids)]
    db.add_all(rows); db.flush()
    for item in rows: p.audit(db, principal, 'training_assigned', 'training', item.id)
    db.commit(); return rows


@router.get('/placement/training', response_model=list[s.TrainingOut])
def student_training(db: Session = Depends(get_db), student=Depends(owner)):
    return list(db.scalars(select(m.TrainingAssignment).where(m.TrainingAssignment.student_pk == student.id).order_by(m.TrainingAssignment.deadline)))


@router.patch('/placement/training/{assignment_id}', response_model=s.TrainingOut)
def training_progress(assignment_id: int, body: s.TrainingProgressIn, db: Session = Depends(get_db), student=Depends(owner)):
    item = owned(db, m.TrainingAssignment, assignment_id, student)
    if body.status == 'completed' and not body.evidence: p.fail(422, 'EVIDENCE_REQUIRED', 'Submit completion evidence')
    if body.status == 'completed' and item.kind == 'assessment':
        if not db.scalar(select(m.Assessment.id).where(m.Assessment.student_pk == student.id, m.Assessment.skill_id == item.skill_id)):
            p.fail(422, 'ASSESSMENT_INCOMPLETE', 'Complete the assigned assessment before submitting')
    changed = db.execute(update(m.TrainingAssignment).where(m.TrainingAssignment.id == item.id, m.TrainingAssignment.version == body.version)
        .values(status=body.status, evidence=body.evidence, version=body.version+1)).rowcount
    if changed != 1: p.fail(409, 'VERSION_CONFLICT', 'Assignment changed; reload before updating')
    db.commit(); db.refresh(item); return item


def import_access(db, principal, job_id):
    access = db.get(m.ImportAccess, job_id)
    if not access or access.admin_id != principal.account_id: p.fail(404, 'IMPORT_NOT_FOUND', 'Import not found')
    return db.get(m.ImportJob, job_id), p.cohort(db, principal, access.cohort_id)


def validate_scope(db, principal, job, target):
    # Re-run against current scope before confirmation (permissions may have changed).
    for row in db.scalars(select(m.ImportStagedRow).where(m.ImportStagedRow.import_job_id == job.id, m.ImportStagedRow.status != 'imported')):
        data, _ = imports._normalize(row.values, job.field_mapping)
        existing = db.scalar(select(m.Student).where(or_(m.Student.student_id == data.get('student_id'), m.Student.email == data.get('email'))))
        issue = None
        from pydantic import TypeAdapter, EmailStr, ValidationError
        if data.get('email'):
            try: TypeAdapter(EmailStr).validate_python(data['email'])
            except ValidationError: issue = 'Email address is invalid for the student profile contract'
        if existing and existing.id not in principal.assigned_ids: issue = 'Existing identity is outside your assigned scope'
        if data.get('department') and data['department'] != target.department: issue = 'Department does not match selected cohort'
        for field in ('batch', 'section'):
            if data.get(field) and data[field] != getattr(target, field): issue = f'{field} does not match selected cohort'
        if existing:
            meta = db.get(m.StudentPlacementMeta, existing.id)
            if meta and ((meta.batch and meta.batch != target.batch) or (meta.section and meta.section != target.section)):
                issue = 'Existing student batch/section does not match selected cohort'
        if issue:
            row.status = 'error'
            db.add(m.ImportRowIssue(import_job_id=job.id, row_number=row.row_number, field=None, issue_code='SCOPE_MISMATCH', severity='error', message=issue))
    db.flush()
    rows = list(db.scalars(select(m.ImportStagedRow).where(m.ImportStagedRow.import_job_id == job.id)))
    job.valid_rows = sum(x.status == 'valid' for x in rows)
    job.duplicate_rows = sum(x.status == 'duplicate' for x in rows)
    job.error_rows = sum(x.status == 'error' for x in rows)
    db.commit()
    return imports.summary(db, job)


@router.post('/import/upload')
async def import_upload(cohort_id: int = Query(gt=0), file: UploadFile = File(), db: Session = Depends(get_db), principal=Depends(require_admin)):
    target = p.cohort(db, principal, cohort_id)
    limit = get_settings().max_upload_mb * 1024 * 1024
    content = await file.read(limit+1); await file.close()
    if len(content) > limit: p.fail(413, 'FILE_TOO_LARGE', 'Upload exceeds size limit')
    try: job, headers = imports.upload(db, file.filename or '', content)
    except ValueError as exc: p.fail(422, 'INVALID_FILE', str(exc))
    db.add(m.ImportAccess(import_id=job.id, admin_id=principal.account_id, cohort_id=target.id))
    p.audit(db, principal, 'import_uploaded', 'import', job.id); db.commit()
    return {'job_id': job.id, 'headers': headers, 'suggested_mapping': job.field_mapping, 'total_rows': job.total_rows}


@router.post('/import/preview')
def import_preview(body: s.ImportPreviewIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    job, target = import_access(db, principal, body.job_id)
    try: imports.preview(db, job, body.mapping)
    except ValueError as exc: p.fail(422, 'INVALID_MAPPING', str(exc))
    return validate_scope(db, principal, job, target)


@router.post('/import/confirm')
def import_confirm(body: s.ImportConfirmIn, db: Session = Depends(get_db), principal=Depends(require_admin)):
    job, target = import_access(db, principal, body.job_id)
    if job.status != 'validated': p.fail(409, 'INVALID_IMPORT_STATE', 'Preview before confirming')
    validate_scope(db, principal, job, target)
    result = imports.confirm(db, job, body.update_duplicates, admin_id=principal.account_id, cohort=target, allowed_ids=principal.assigned_ids)
    backfill_accounts(db)
    p.audit(db, principal, 'import_confirmed', 'import', job.id); db.commit()
    return result


@router.get('/import/{job_id}')
def import_status(job_id: int, db: Session = Depends(get_db), principal=Depends(require_admin)):
    job, _ = import_access(db, principal, job_id)
    return imports.summary(db, job)


@router.get('/import/{job_id}/errors')
def import_errors(job_id: int, db: Session = Depends(get_db), principal=Depends(require_admin)):
    return import_status(job_id, db, principal)['issues']


@router.post('/import/{job_id}/retry')
def import_retry(job_id: int, db: Session = Depends(get_db), principal=Depends(require_admin)):
    job, target = import_access(db, principal, job_id)
    try: imports.retry(db, job)
    except ValueError as exc: p.fail(409, 'INVALID_IMPORT_STATE', str(exc))
    return validate_scope(db, principal, job, target)
