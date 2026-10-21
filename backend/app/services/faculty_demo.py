"""Owner-scoped, repeatable demo fixtures. No providers or real student data."""
from datetime import date, timedelta
from threading import Lock

from sqlalchemy import select

from app import models as m
from app.schemas import FacultyDemoOut
from app.services.demo_seed import seed_role
from app.services.placement import audit, fail


DEMO_COHORT_NAME = 'Demo fixtures - placement workspace'
_LOCK = Lock()  # Single-process SQLite demo, as used by the resume workspace.


def load_demo(db, principal):
    with _LOCK:
        try:
            return _load(db, principal)
        except Exception:
            db.rollback()
            raise


def _load(db, principal):
    role = seed_role(db)
    cohort = db.scalar(select(m.Cohort).where(m.Cohort.admin_id == principal.account_id,
                                             m.Cohort.name == DEMO_COHORT_NAME))
    if cohort is None:
        cohort = m.Cohort(admin_id=principal.account_id, name=DEMO_COHORT_NAME,
                          department='Demo fixtures', batch='2027', section='DEMO')
        db.add(cohort)
        db.flush()
        audit(db, principal, 'demo_fixture_created', 'cohort', cohort.id)
    else:
        marker = db.scalar(select(m.AdminAudit.id).where(m.AdminAudit.actor_id == principal.account_id,
            m.AdminAudit.action == 'demo_fixture_created', m.AdminAudit.object_type == 'cohort',
            m.AdminAudit.object_id == cohort.id))
        if not marker:
            fail(409, 'DEMO_NAME_CONFLICT', 'A cohort already uses the demo name. Rename it before loading demo fixtures.')

    skills = {row.canonical_name: row for row in db.scalars(select(m.Skill))}
    today = date.today()
    drives = []
    for company, title in [('Demo fixture - Example Analytics', 'Demo fixture - Data Analyst'),
                           ('Demo fixture - Example Software', 'Demo fixture - Python Developer')]:
        drive = db.scalar(select(m.PlacementDrive).where(m.PlacementDrive.admin_id == principal.account_id,
            m.PlacementDrive.cohort_id == cohort.id, m.PlacementDrive.company == company))
        if drive is None:
            drive = m.PlacementDrive(admin_id=principal.account_id, cohort_id=cohort.id, company=company,
                role=title, description='[demo_fixture] Fictional placement drive for exploring the workspace. No real vacancy or application.',
                deadline=today + timedelta(days=21), eligibility={'min_cgpa': 7},
                application_link='https://example.com/demo-fixture')
            db.add(drive)
            db.flush()
        drives.append(drive)

    members = []
    stages = ['applied', 'shortlisted', 'interview', 'offered', 'rejected', 'applied']
    reviews = ['submitted', 'approved', 'changes_requested', 'submitted', 'approved']
    for index in range(6):
        sid = f'DEMO-FACULTY-{principal.account_id}-{index + 1:02d}'
        student = db.scalar(select(m.Student).where(m.Student.student_id == sid))
        if student is None:
            student = m.Student(student_id=sid, name=f'Demo fixture student {index + 1:02d}',
                email=f'faculty{principal.account_id}.fixture{index + 1}@example.com',
                department='Demo fixtures', program='B.Tech', specialization='Computer Science',
                semester=7, cgpa=[8.5, 7.2, 9.0, 8.1, 6.8, None][index],
                graduation_year=2027, is_synthetic=True)
            db.add(student)
            db.flush()
            db.add(m.Account(username=f'student-{student.id}', role='student', student_pk=student.id))
        elif not student.is_synthetic or not db.get(m.CohortMember, (cohort.id, student.id)):
            fail(409, 'DEMO_ID_CONFLICT', 'A demo student identity is already in use. No existing profile was changed.')
        members.append(student)
        if not db.get(m.FacultyScope, (principal.account_id, student.id)):
            db.add(m.FacultyScope(admin_id=principal.account_id, student_pk=student.id))
        if not db.get(m.CohortMember, (cohort.id, student.id)):
            db.add(m.CohortMember(cohort_id=cohort.id, student_pk=student.id))
        if not db.get(m.StudentPlacementMeta, student.id):
            db.add(m.StudentPlacementMeta(student_pk=student.id, batch='2027', section='DEMO'))

        levels = {'Python': [4, 3, 5, 2, 3, None][index], 'SQL': [2, 4, 3, 4, None, None][index],
                  'Machine Learning': [3, 2, 4, None, 2, None][index]}
        for name, level in levels.items():
            skill = skills[name]
            existing = db.scalar(select(m.StudentSkill.id).where(m.StudentSkill.student_pk == student.id,
                                                                 m.StudentSkill.skill_id == skill.id))
            if existing is None:
                evidence = m.Evidence(student_pk=student.id, source_type='demo',
                    source_ref='demo_fixture:faculty-v1', extracted_summary=f'[demo_fixture] Synthetic {name} evidence; no real student proficiency is claimed.',
                    extraction_confidence=0.8 if level is not None else 0)
                db.add(evidence)
                db.flush()
                db.add(m.StudentSkill(student_pk=student.id, skill_id=skill.id, level=level,
                    confidence=0.8 if level is not None else 0, evidence_ids=[evidence.id]))
        sql = skills['SQL']
        if index < 4 and not db.scalar(select(m.Assessment.id).where(m.Assessment.student_pk == student.id,
                            m.Assessment.question_set_version == 'demo_fixture-v1')):
            db.add(m.Assessment(student_pk=student.id, skill_id=sql.id, question_set_version='demo_fixture-v1',
                answers={'provenance': 'demo_fixture'}, score=[0.4, 0.8, 0.6, 1.0][index]))
        if not db.scalar(select(m.RoadmapItem.id).where(m.RoadmapItem.student_pk == student.id)):
            db.add(m.RoadmapItem(student_pk=student.id, skill_id=sql.id,
                task='[demo_fixture] Practice SQL joins with synthetic tables',
                objective='Demonstration learning task', resource_provenance='demo_fixture',
                resource_title='Demo fixture SQL project', status='done' if index < 2 else 'in_progress',
                completion_evidence='[demo_fixture] Synthetic completion record' if index < 2 else None))
        group = f'demo_fixture:faculty:{principal.account_id}:sql-v1'
        if not db.scalar(select(m.TrainingAssignment.id).where(m.TrainingAssignment.group_key == group,
                                                              m.TrainingAssignment.student_pk == student.id)):
            db.add(m.TrainingAssignment(group_key=group, admin_id=principal.account_id, student_pk=student.id,
                title='Demo fixture - SQL practice project', kind='project',
                instructions='[demo_fixture] Explore assignment progress using synthetic SQL tables.', skill_id=sql.id,
                deadline=today + timedelta(days=-2 if index == 5 else 7),
                status='completed' if index < 2 else 'in_progress' if index < 4 else 'not_started',
                evidence='[demo_fixture] Synthetic project completion' if index < 2 else ''))
        drive = drives[index % 2]
        application = db.scalar(select(m.PlacementApplication).where(m.PlacementApplication.drive_id == drive.id,
                                                                    m.PlacementApplication.student_pk == student.id))
        if application is None:
            application = m.PlacementApplication(drive_id=drive.id, student_pk=student.id, stage=stages[index])
            db.add(application)
            db.flush()
            db.add(m.ApplicationEvent(application_id=application.id, actor_id=principal.account_id,
                stage=stages[index], note='[demo_fixture] Simulated application status; no real employer outcome.'))
        if index < len(reviews):
            resume = db.scalar(select(m.ResumeWorkspace).where(m.ResumeWorkspace.student_pk == student.id))
            if resume is None:
                text = f'DEMO FIXTURE - fictional resume\n{student.name}\nSQL and Python practice projects using synthetic datasets.\nNo real personal information or hiring outcome.'
                resume = m.ResumeWorkspace(student_pk=student.id, filename='demo_fixture_resume.txt',
                    original_text=text, revised_text=text, target={}, decisions={})
                db.add(resume)
                db.flush()
                revision = m.ResumeRevision(workspace_id=resume.id, version=1, text=text)
                db.add(revision)
                db.flush()
                review = m.FacultyResumeReview(student_pk=student.id, admin_id=principal.account_id,
                    revision_id=revision.id, status=reviews[index], shared=True)
                db.add(review)
                db.flush()
                if reviews[index] != 'submitted':
                    db.add(m.FacultyReviewFeedback(review_id=review.id, status=reviews[index],
                        feedback='[demo_fixture] Synthetic faculty feedback for demonstration only.'))

    db.flush()
    audit(db, principal, 'demo_fixture_loaded', 'cohort', cohort.id)
    result = FacultyDemoOut(cohort_id=cohort.id, job_id=role.id, student_id=members[0].id)
    db.commit()
    return result
