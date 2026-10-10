"""Profile, seeded role, and reproducible persisted analysis orchestration."""
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app import models
from app.schemas import (AnalysisOut, Competency, EvidenceOut, JobOut, JobSkillOut,
                         ProfileOut, SkillOut, StudentOut, SwotItemOut)
from app.services.intelligence import score_role


def get_profile(db: Session, student: models.Student) -> ProfileOut:
    evidence = db.scalars(select(models.Evidence).where(models.Evidence.student_pk == student.id)).all()
    skills = db.scalars(select(models.StudentSkill).options(selectinload(models.StudentSkill.skill)).where(models.StudentSkill.student_pk == student.id)).all()
    return ProfileOut(student=StudentOut.model_validate(student),
                      evidence=[EvidenceOut.model_validate(e) for e in evidence],
                      competencies=[Competency(skill=SkillOut.model_validate(s.skill), level=s.level,
                                               confidence=s.confidence, evidence_ids=s.evidence_ids or []) for s in skills])


def get_job(db: Session, job: models.Job) -> JobOut:
    skills = db.scalars(select(models.JobSkill).options(selectinload(models.JobSkill.skill)).where(models.JobSkill.job_id == job.id)).all()
    return JobOut(id=job.id, title=job.title, company=job.company,
                  skills=[JobSkillOut(skill=SkillOut.model_validate(s.skill), requirement_type=s.requirement_type,
                                      importance=s.importance, expected_level=s.expected_level) for s in skills])


def analyze(db: Session, student: models.Student, job: models.Job) -> AnalysisOut:
    role = get_job(db, job)
    scored = score_role(role, get_profile(db, student).competencies)
    analysis = models.Analysis(student_pk=student.id, job_id=job.id, alignment=scored.readiness.alignment,
                               evidence_coverage=scored.readiness.evidence_coverage,
                               confidence=scored.readiness.confidence, formula_version=scored.readiness.formula_version)
    db.add(analysis)
    db.flush()
    for gap in scored.gaps:
        db.add(models.SkillGap(analysis_id=analysis.id, skill_id=gap.skill.id,
                               current_level=gap.current_level, required_level=gap.required_level,
                               gap=gap.gap, priority=gap.priority.value, rationale=gap.rationale))
    db.commit()
    db.refresh(analysis)
    return AnalysisOut(id=analysis.id, student_id=student.id, job=role, readiness=scored.readiness,
                       strengths=scored.strengths, gaps=scored.gaps, warnings=scored.warnings,
                       swot=[], created_at=analysis.created_at)
