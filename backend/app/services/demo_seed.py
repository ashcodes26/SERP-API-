"""Idempotent, explicitly synthetic demonstration records."""
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import Evidence, Job, JobSkill, Skill, Student, StudentSkill
from app.services.intelligence import normalize_skill

DEMO_STUDENT_ID = 'AIMORA-DEMO-001'
DEMO_ROLE_TITLE = 'Machine Learning Engineer (synthetic demo)'


def seed_demo(db: Session) -> tuple[Student, Job]:
    student = db.scalar(select(Student).where(Student.student_id == DEMO_STUDENT_ID))
    if student is None:
        student = Student(student_id=DEMO_STUDENT_ID, name='Aarav Kumar (Demo)',
                          email='aarav.demo@example.com', department='CSE', program='B.Tech',
                          specialization='AI/ML', semester=5, cgpa=8.2, graduation_year=2028, is_synthetic=True)
        db.add(student)
        db.flush()
    role = seed_role(db)
    skills = [('Python', 5, 4, 0.95), ('Machine Learning', 5, 3, 0.90),
              ('SQL', 4, 2, 0.90), ('Docker', 3, None, 0.0), ('Pandas', 4, 4, 0.90)]
    for name, expected, actual, importance in skills:
        skill = db.scalar(select(Skill).where(Skill.canonical_name == name))
        if actual is not None and db.scalar(select(StudentSkill).where(StudentSkill.student_pk == student.id, StudentSkill.skill_id == skill.id)) is None:
            ev = Evidence(student_pk=student.id, source_type='demo',
                          source_ref='synthetic-seed-v1', extracted_summary=f'Synthetic evidence for {name}',
                          extraction_confidence=0.85)
            db.add(ev)
            db.flush()
            db.add(StudentSkill(student_pk=student.id, skill_id=skill.id, level=actual,
                                confidence=0.85, evidence_ids=[ev.id]))
    db.commit()
    return student, role


def seed_role(db: Session) -> Job:
    """Create the clearly labeled example role without populating any student evidence."""
    role = db.scalar(select(Job).where(Job.title == DEMO_ROLE_TITLE, Job.is_seeded.is_(True)))
    if role is None:
        role = Job(title=DEMO_ROLE_TITLE, description='Synthetic target role for demonstration only.', is_seeded=True)
        db.add(role)
        db.flush()
    skills = [('Python', 5, 4, 0.95), ('Machine Learning', 5, 3, 0.90),
              ('SQL', 4, 2, 0.90), ('Docker', 3, None, 0.0), ('Pandas', 4, 4, 0.90)]
    for name, expected, actual, importance in skills:
        canonical, category = normalize_skill(name)
        skill = db.scalar(select(Skill).where(Skill.canonical_name == canonical))
        if skill is None:
            skill = Skill(canonical_name=canonical, category=category, aliases=[])
            db.add(skill)
            db.flush()
        if db.scalar(select(JobSkill).where(JobSkill.job_id == role.id, JobSkill.skill_id == skill.id)) is None:
            db.add(JobSkill(job_id=role.id, skill_id=skill.id, requirement_type='required',
                            importance=importance if importance > 0 else 0.75, expected_level=expected))
    db.commit()
    return role
