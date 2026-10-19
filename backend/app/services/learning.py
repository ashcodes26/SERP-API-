"""Phase 4 learning workflow: persisted roadmap, auditable quiz, fresh readiness."""
from sqlalchemy import select
from sqlalchemy.orm import Session
from collections import Counter
from app import models
from app.config import Settings
from app.enums import ResourceProvenance
from app.schemas import (AssessmentOut, AssessmentSubmitIn, DashboardOut, ResourceSearchIn,
                         RoadmapItemOut, ReadinessOut, StudentOut)
from app.services.analysis import get_job, get_profile
from app.services.intelligence import score_role
from app.services.serpapi import SearchFailure, search_resources

# Curated, known documentation links; not claimed to be search results.
CURATED = {
    'Python': ('Python Tutorial', 'https://docs.python.org/3/tutorial/'),
    'SQL': ('PostgreSQL SQL Tutorial', 'https://www.postgresql.org/docs/current/tutorial-sql.html'),
    'Docker': ('Docker Get Started', 'https://docs.docker.com/get-started/'),
    'Machine Learning': ('Scikit-learn User Guide', 'https://scikit-learn.org/stable/user_guide.html'),
    'Pandas': ('Pandas Getting Started', 'https://pandas.pydata.org/docs/getting_started/index.html'),
}
DEFAULT_RESOURCE = ('Learning resources directory', 'https://www.freecodecamp.org/learn/')

# Public questions; private answer keys never included in GET response.
QUESTION_BANK = {
    'SQL': ('sql-basics-v1', (
        ('q1', 'Which SQL clause filters rows before grouping?', ('WHERE', 'HAVING', 'ORDER BY'), 'WHERE'),
        ('q2', 'Which JOIN includes only rows matching both tables?', ('INNER JOIN', 'LEFT JOIN', 'FULL JOIN'), 'INNER JOIN'),
        ('q3', 'Which keyword removes duplicate rows in SELECT?', ('DISTINCT', 'UNIQUE', 'GROUP'), 'DISTINCT'),
    )),
    'Python': ('python-basics-v1', (
        ('q1', 'Which Python type is immutable?', ('tuple', 'list', 'dict'), 'tuple'),
        ('q2', 'Which statement handles exceptions?', ('try', 'switch', 'repeat'), 'try'),
        ('q3', 'What does len() return?', ('element count', 'byte count', 'memory address'), 'element count'),
    )),
    'Docker': ('docker-basics-v1', (
        ('q1', 'Which file defines image build steps?', ('Dockerfile', 'compose.lock', 'requirements.txt'), 'Dockerfile'),
        ('q2', 'Which command creates an image?', ('docker build', 'docker run', 'docker ps'), 'docker build'),
        ('q3', 'A container is an instance of a?', ('image', 'registry', 'volume'), 'image'),
    )),
}


def get_questions(skill: models.Skill) -> dict | None:
    bank = QUESTION_BANK.get(skill.canonical_name)
    if bank is None:
        return None
    version, questions = bank
    return {'skill_id': skill.id, 'question_set_version': version,
            'questions': [{'id': qid, 'prompt': prompt, 'options': list(options)}
                          for qid, prompt, options, _ in questions]}


def latest_analysis(db: Session, student_id: int) -> models.Analysis | None:
    return db.scalar(select(models.Analysis).where(models.Analysis.student_pk == student_id)
                     .order_by(models.Analysis.id.desc()))


def current_readiness(db: Session, student: models.Student, job: models.Job) -> ReadinessOut:
    return score_role(get_job(db, job), get_profile(db, student).competencies).readiness


def recommendations_for_gaps(db, student, analysis, gaps):
    """Read-only companion to create_roadmap: reuse saved resources/progress or labelled curated links."""
    from app.schemas import LearningRecommendationOut
    result = []
    for gap in gaps[:8]:
        saved = db.scalar(select(models.RoadmapItem).where(models.RoadmapItem.student_pk == student.id,
            models.RoadmapItem.analysis_id == analysis.id, models.RoadmapItem.skill_id == gap.skill.id))
        title, url = CURATED.get(gap.skill.canonical_name, DEFAULT_RESOURCE)
        result.append(LearningRecommendationOut(skill_id=gap.skill.id,
            task=saved.task if saved else f'Practice {gap.skill.canonical_name} and record your own evidence',
            resource_title=saved.resource_title if saved else title,
            resource_url=saved.resource_url if saved else url,
            resource_provenance=saved.resource_provenance if saved else 'curated_fallback',
            milestone_id=saved.id if saved else None, status=saved.status if saved else 'not_started'))
    return result


async def create_roadmap(db: Session, student: models.Student, analysis: models.Analysis,
                         settings: Settings) -> list[RoadmapItemOut]:
    existing = db.scalars(select(models.RoadmapItem).where(
        models.RoadmapItem.student_pk == student.id, models.RoadmapItem.analysis_id == analysis.id)
                          .order_by(models.RoadmapItem.week, models.RoadmapItem.id)).all()
    if existing:
        return [RoadmapItemOut.model_validate(row) for row in existing]
    gaps = db.scalars(select(models.SkillGap).where(models.SkillGap.analysis_id == analysis.id)
                      .order_by(models.SkillGap.id)).all()
    rank = {'high': 0, 'medium': 1, 'low': 2}
    # Repeated observed requirements are only a tie-breaker after existing gap priority.
    recent_jobs = list(dict.fromkeys(db.scalars(select(models.Analysis.job_id).where(
        models.Analysis.student_pk == student.id).order_by(models.Analysis.id.desc()).limit(50)).all()))[:10]
    demand = Counter()
    for job_id in recent_jobs:
        for skill_id in db.scalars(select(models.JobSkill.skill_id).where(models.JobSkill.job_id == job_id)).all():
            demand[skill_id] += 1
    # The selected retrieved role can use an actual, deduplicated collected search
    # sample. Import locally because market's resource links reuse CURATED above.
    from app.services.market import roadmap_demand_context
    collected = roadmap_demand_context(db, analysis.job_id)
    if collected is not None:
        counts = {s.name: s.distinct_job_count for s in collected.skills}
        demand = Counter({s.id: counts.get(s.canonical_name, 0) for s in db.scalars(select(models.Skill)).all()})
    gaps = sorted(gaps, key=lambda g: (rank.get(g.priority, 3), -(g.gap or 0), -demand[g.skill_id], g.id))
    target_job = db.get(models.Job, analysis.job_id)
    for index, gap in enumerate(gaps[:8]):
        skill = db.get(models.Skill, gap.skill_id)
        if skill is None:
            continue
        fallback_title, fallback_url = CURATED.get(skill.canonical_name, DEFAULT_RESOURCE)
        title, url, provenance = fallback_title, fallback_url, ResourceProvenance.curated_fallback.value
        if settings.serpapi_configured:
            try:
                found = await search_resources(ResourceSearchIn(skill=skill.canonical_name, max_results=3), settings)
                if found.results:
                    choice = found.results[0]
                    title, url, provenance = choice.title, str(choice.url), choice.provenance.value
            except SearchFailure:
                pass  # Explicitly labelled curated fallback; no synthetic provider data.
        prior = db.scalar(select(models.RoadmapItem).join(models.Analysis, models.RoadmapItem.analysis_id == models.Analysis.id)
            .where(models.RoadmapItem.student_pk == student.id, models.RoadmapItem.skill_id == skill.id,
                   models.Analysis.job_id == analysis.job_id, models.RoadmapItem.analysis_id != analysis.id)
            .order_by(models.RoadmapItem.id.desc()))
        repeated = (f' Observed in {demand[skill.id]} of {len(recent_jobs)} distinct analyzed role profiles; this is your sample, not the whole market.'
                    if demand[skill.id] >= 2 else '')
        if collected is not None:
            repeated = (f' Mentioned in {demand[skill.id]} of {collected.sample_size} distinct collected jobs in the '
                        f'{collected.filters.role} / {collected.filters.location or "unspecified location"} search scope; not a market-wide estimate.')
        item = models.RoadmapItem(
            student_pk=student.id, analysis_id=analysis.id, skill_id=skill.id,
            task=f'Practice {skill.canonical_name} for {target_job.title}',
            objective=(f'Build evidence for {skill.canonical_name} at the role-required level'
                       if gap.required_level is not None else f'Assess current {skill.canonical_name} proficiency') + f'. {gap.rationale}' + repeated,
            resource_title=title, resource_url=url, resource_provenance=provenance,
            effort_hours=3.0 if gap.priority == 'high' else 2.0, week=index + 1,
            completion_criteria=f'Complete a {skill.canonical_name} exercise and record evidence',
            status=prior.status if prior else 'not_started',
            completion_evidence=prior.completion_evidence if prior else None)
        db.add(item)
    db.commit()
    return [RoadmapItemOut.model_validate(row) for row in db.scalars(
        select(models.RoadmapItem).where(models.RoadmapItem.student_pk == student.id,
                                         models.RoadmapItem.analysis_id == analysis.id)
        .order_by(models.RoadmapItem.week, models.RoadmapItem.id)).all()]


def submit_assessment(db: Session, student: models.Student, skill: models.Skill,
                      request: AssessmentSubmitIn) -> AssessmentOut:
    bank = QUESTION_BANK.get(skill.canonical_name)
    if bank is None or request.question_set_version != bank[0]:
        raise ValueError('Unknown or outdated assessment question set')
    questions = bank[1]
    expected = {qid for qid, _, _, _ in questions}
    if set(request.answers) != expected:
        raise ValueError('Every assessment question must be answered exactly once')
    score = sum(request.answers[qid] == answer for qid, _, _, answer in questions) / len(questions)
    prior = db.scalar(select(models.StudentSkill).where(models.StudentSkill.student_pk == student.id,
                                                       models.StudentSkill.skill_id == skill.id))
    # Conservative update: only demonstrated passing performance can increase a level;
    # 0 and unknown are separate. No automatic downgrade on one short quiz.
    previous = prior.level if prior else None
    estimated = round(score * 5)
    updated = max(previous, estimated) if previous is not None else estimated
    assessment = models.Assessment(student_pk=student.id, skill_id=skill.id,
                                   question_set_version=bank[0], answers=dict(request.answers), score=score)
    db.add(assessment)
    db.flush()
    evidence = models.Evidence(student_pk=student.id, source_type='assessment',
                               source_ref=f'assessment:{assessment.id}',
                               extracted_summary=f'{skill.canonical_name} quiz {bank[0]} score {score:.0%}',
                               extraction_confidence=score)
    db.add(evidence)
    db.flush()
    if prior is None:
        prior = models.StudentSkill(student_pk=student.id, skill_id=skill.id,
                                    level=updated, confidence=score, evidence_ids=[evidence.id])
        db.add(prior)
    else:
        prior.level = updated
        prior.confidence = max(prior.confidence, score)
        prior.evidence_ids = list(dict.fromkeys([*(prior.evidence_ids or []), evidence.id]))
    db.commit()
    analysis = latest_analysis(db, student.id)
    job = db.get(models.Job, analysis.job_id) if analysis else None
    readiness = current_readiness(db, student, job) if job else None
    return AssessmentOut(id=assessment.id, skill_id=skill.id, score=round(score, 4),
                         updated_level=updated, readiness=readiness)


def dashboard(db: Session, student: models.Student) -> DashboardOut:
    analysis = latest_analysis(db, student.id)
    job = db.get(models.Job, analysis.job_id) if analysis else None
    scored = score_role(get_job(db, job), get_profile(db, student).competencies) if job else None
    rows = db.scalars(select(models.RoadmapItem).where(models.RoadmapItem.student_pk == student.id,
                 models.RoadmapItem.analysis_id == analysis.id).order_by(models.RoadmapItem.week, models.RoadmapItem.id)).all() if analysis else []
    counts = {'not_started': 0, 'in_progress': 0, 'done': 0}
    for row in rows:
        counts[row.status] = counts.get(row.status, 0) + 1
    next_item = next((row for row in rows if row.status != 'done'), None)
    return DashboardOut(student=StudentOut.model_validate(student), target_job=get_job(db, job) if job else None,
                        readiness=scored.readiness if scored else None,
                        top_gaps=scored.gaps[:3] if scored else [], roadmap_progress=counts,
                        next_action=RoadmapItemOut.model_validate(next_item) if next_item else None,
                        data_mode='demo' if student.is_synthetic else 'live')
