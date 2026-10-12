"""Scoped placement reporting and deterministic aggregates; no external requests."""
from collections import defaultdict
from datetime import date
from sqlalchemy import select
from fastapi import HTTPException
from app import models as m, schemas as s
from app.services.analysis import get_profile, get_job
from app.services.intelligence import score_role


def fail(status, code, message):
    raise HTTPException(status, detail={'code': code, 'message': message})


def cohort(db, principal, cohort_id):
    item = db.get(m.Cohort, cohort_id)
    if not item or item.admin_id != principal.account_id:
        fail(404, 'COHORT_NOT_FOUND', 'Assigned cohort not found')
    return item


def cohort_ids(db, principal, cohort_id):
    cohort(db, principal, cohort_id)
    return set(db.scalars(select(m.CohortMember.student_pk).where(m.CohortMember.cohort_id == cohort_id))) & set(principal.assigned_ids)


def audit(db, principal, action, object_type, object_id=None):
    if principal.account_id:
        db.add(m.AdminAudit(actor_id=principal.account_id, action=action, object_type=object_type, object_id=object_id))


def snapshot(db, workspace):
    item = db.scalar(select(m.ResumeRevision).where(m.ResumeRevision.workspace_id == workspace.id, m.ResumeRevision.version == workspace.version))
    if not item:
        item = m.ResumeRevision(workspace_id=workspace.id, version=workspace.version, text=workspace.revised_text)
        db.add(item); db.flush()
    return item


def review_out(db, item):
    revision = db.get(m.ResumeRevision, item.revision_id)
    return s.FacultyReviewOut(id=item.id, student_id=item.student_pk, admin_id=item.admin_id,
        workspace_id=revision.workspace_id, version=revision.version, text=revision.text,
        status=item.status, shared=item.shared, suggestions=item.suggestions,
        feedback=list(db.scalars(select(m.FacultyReviewFeedback).where(m.FacultyReviewFeedback.review_id == item.id).order_by(m.FacultyReviewFeedback.id))),
        created_at=item.created_at)


def summaries(db, principal, students):
    ids = [x.id for x in students]
    groups = {}
    for model in (m.Assessment, m.RoadmapItem, m.TrainingAssignment, m.PlacementApplication, m.FacultyResumeReview):
        grouped = defaultdict(list)
        query = select(model).where(model.student_pk.in_(ids))
        if model == m.FacultyResumeReview:
            query = query.where(model.admin_id == principal.account_id, model.shared.is_(True)).order_by(model.id)
        if model == m.TrainingAssignment:
            query = query.where(model.admin_id == principal.account_id)
        if model == m.PlacementApplication:
            query = query.join(m.PlacementDrive, model.drive_id == m.PlacementDrive.id).where(m.PlacementDrive.admin_id == principal.account_id)
        for row in db.scalars(query):
            grouped[row.student_pk].append(row)
        groups[model] = grouped
    meta = {x.student_pk: x for x in db.scalars(select(m.StudentPlacementMeta).where(m.StudentPlacementMeta.student_pk.in_(ids)))}
    result = []
    for student in students:
        fields = [student.name, student.email, student.department, student.program, student.semester, student.cgpa, student.graduation_year]
        completion = round(sum(x is not None and x != '' for x in fields) / len(fields) * 100, 1)
        reviews = groups[m.FacultyResumeReview][student.id]
        status = reviews[-1].status if reviews else 'not_shared'
        assessments = groups[m.Assessment][student.id]
        roadmap = groups[m.RoadmapItem][student.id]
        training = groups[m.TrainingAssignment][student.id]
        applications = groups[m.PlacementApplication][student.id]
        overdue = sum(x.deadline < date.today() and x.status != 'completed' for x in training)
        follow = []
        if completion < 100: follow.append('Profile incomplete')
        if status in {'submitted', 'changes_requested'}: follow.append('Resume ' + status.replace('_', ' '))
        if not assessments: follow.append('No completed assessments')
        if overdue: follow.append('Overdue training')
        info = meta.get(student.id)
        result.append(s.PlacementStudentOut(id=student.id, student_id=student.student_id, name=student.name,
            department=student.department, batch=info.batch if info else str(student.graduation_year) if student.graduation_year else None,
            section=info.section if info else None, profile_completion=completion, resume_status=status,
            assessments_completed=len(assessments), roadmap_completed=sum(x.status == 'done' for x in roadmap), roadmap_total=len(roadmap),
            training_completed=sum(x.status == 'completed' for x in training), training_total=len(training), overdue=overdue,
            applications=len(applications), offers=sum(x.stage == 'offered' for x in applications), follow_up=follow))
    return result


def filtered_students(db, principal, q='', department=None, batch=None, section=None, progress=None, cohort_id=None):
    allowed = cohort_ids(db, principal, cohort_id) if cohort_id else principal.assigned_ids
    query = select(m.Student).where(m.Student.id.in_(allowed)).order_by(m.Student.name, m.Student.id)
    if department: query = query.where(m.Student.department == department)
    if q:
        query = query.where(m.Student.name.icontains(q, autoescape=True) | m.Student.student_id.icontains(q, autoescape=True))
    rows = summaries(db, principal, list(db.scalars(query)))
    return [x for x in rows if (not batch or x.batch == batch) and (not section or x.section == section)
            and (not progress or (progress == 'follow_up' and x.follow_up) or (progress == 'complete' and not x.follow_up))]


def dashboard(rows):
    count = len(rows)
    metrics = {'assigned_students': count, 'profile_complete': sum(x.profile_completion == 100 for x in rows),
        'resumes_submitted': sum(x.resume_status == 'submitted' for x in rows), 'resumes_changes_requested': sum(x.resume_status == 'changes_requested' for x in rows),
        'resumes_approved': sum(x.resume_status == 'approved' for x in rows), 'students_assessed': sum(x.assessments_completed > 0 for x in rows),
        'assessment_attempts': sum(x.assessments_completed for x in rows), 'training_completed': sum(x.training_completed for x in rows),
        'training_total': sum(x.training_total for x in rows), 'overdue_training': sum(x.overdue for x in rows),
        'applications': sum(x.applications for x in rows), 'offers': sum(x.offers for x in rows),
        'students_offered': sum(x.offers > 0 for x in rows), 'follow_up_students': sum(bool(x.follow_up) for x in rows)}
    definitions = {
        'assigned_students': 'Students explicitly assigned to this faculty account within the selected filters.',
        'profile_complete': 'All seven saved fields present: name, email, department, program, semester, CGPA, graduation year. Completion is not verification.',
        'resumes_submitted': 'Latest actively shared revision for this faculty awaiting a decision.',
        'resumes_changes_requested': 'Latest actively shared revision for this faculty needs changes.',
        'resumes_approved': 'Latest actively shared revision approved by this faculty; facts are not externally verified.',
        'students_assessed': 'Assigned students with at least one completed assessment.',
        'assessment_attempts': 'Completed assessment attempts, including repeated attempts.',
        'training_completed': 'Assignments marked completed with evidence by the assignee.',
        'training_total': 'Assignments created by this faculty for these students.',
        'overdue_training': 'Incomplete assignments whose deadline is before today.',
        'applications': 'Explicit application records for this faculty’s drives.',
        'offers': 'Applications explicitly updated to offered; no readiness inference.',
        'students_offered': 'Distinct assigned students with at least one current offered application.',
        'follow_up_students': 'Students with incomplete profiles, submitted/change-requested resumes, no assessments, or overdue training.'}
    return s.PlacementDashboardOut(metrics=metrics, definitions=definitions, follow_up=[x for x in rows if x.follow_up][:20])


def batch_gaps(db, principal, cohort_id, job_id):
    ids = sorted(cohort_ids(db, principal, cohort_id))
    job = db.get(m.Job, job_id)
    if not job: fail(404, 'ROLE_NOT_FOUND', 'Target role not found')
    role = get_job(db, job)
    if not role.skills: fail(422, 'ROLE_REQUIREMENTS_REQUIRED', 'Choose a role with skill requirements')
    gaps, known, assessed, latest = defaultdict(list), defaultdict(list), defaultdict(list), {}
    for attempt in db.scalars(select(m.Assessment).where(m.Assessment.student_pk.in_(ids)).order_by(m.Assessment.completed_at, m.Assessment.id)):
        latest[(attempt.student_pk, attempt.skill_id)] = attempt
    for student in db.scalars(select(m.Student).where(m.Student.id.in_(ids))):
        profile = get_profile(db, student)
        scored = score_role(role, profile.competencies)
        for gap in scored.gaps:
            if gap.gap is not None and gap.gap > 0: gaps[gap.skill.id].append(student.id)
        for comp in profile.competencies:
            if comp.level is not None: known[comp.skill.id].append((student.id, comp.level))
        for req in role.skills:
            attempt = latest.get((student.id, req.skill.id))
            if attempt: assessed[req.skill.id].append((student.id, round(attempt.score * 5)))
    rows = []
    for req in role.skills:
        values, tests = known[req.skill.id], assessed[req.skill.id]
        unknown = sorted(set(ids) - {x[0] for x in values})
        missing = sorted(set(ids) - {x[0] for x in tests})
        rows.append(s.BatchSkillOut(skill=req.skill, required_level=req.expected_level,
            common_gap_count=len(gaps[req.skill.id]), known_count=len(values), mean_proficiency=round(sum(x[1] for x in values)/len(values), 2) if values else None,
            assessed_count=len(tests), mean_assessed_proficiency=round(sum(x[1] for x in tests)/len(tests), 2) if tests else None,
            missing_assessment_count=len(missing), unknown_count=len(unknown), gap_student_ids=gaps[req.skill.id],
            unknown_student_ids=unknown, assessed_student_ids=[x[0] for x in tests], missing_assessment_student_ids=missing))
    return s.BatchGapOut(cohort_id=cohort_id, job=role, student_count=len(ids), skills=rows,
        source='Current saved competencies scored with role-alignment-v1; latest stored assessment per student/skill mapped by round(score × 5), as in the existing quiz service. Scope: explicitly assigned cohort members. Unknown levels excluded from means and gap counts; missing assessments are reported separately. No provider requests.')


def eligibility(student, rules):
    reasons, missing, failed = [], False, False
    checks = [(rules.get('min_cgpa'), student.cgpa, lambda a,b: b >= a, 'Minimum CGPA'),
              (rules.get('departments') or None, student.department, lambda a,b: b in a, 'Department'),
              (rules.get('graduation_year'), student.graduation_year, lambda a,b: a == b, 'Graduation year')]
    for required, current, predicate, label in checks:
        if required is None: continue
        if current is None:
            missing = True; reasons.append(f'{label}: saved data missing; faculty review required')
        elif not predicate(required, current):
            failed = True; reasons.append(f'{label}: saved value {current} does not meet {required}')
        else: reasons.append(f'{label}: saved value {current} meets {required}')
    return s.EligibilityOut(status='not_eligible' if failed else 'needs_review' if missing else 'eligible', reasons=reasons or ['No additional eligibility criteria'])


def application_out(db, item):
    result = s.ApplicationOut.model_validate(item)
    result.history = list(db.scalars(select(m.ApplicationEvent).where(m.ApplicationEvent.application_id == item.id).order_by(m.ApplicationEvent.id)))
    return result
