"""SQLAlchemy models. Mirrors PRD section 11.1; proficiency NULL means *unknown*, never zero."""

from datetime import UTC, datetime, date

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(UTC)


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # institutional id
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    department: Mapped[str | None] = mapped_column(String(120))
    program: Mapped[str | None] = mapped_column(String(120))
    specialization: Mapped[str | None] = mapped_column(String(120))
    semester: Mapped[int | None] = mapped_column(Integer)
    cgpa: Mapped[float | None] = mapped_column(Float)
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    is_synthetic: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    evidence: Mapped[list["Evidence"]] = relationship(back_populates="student", cascade="all, delete-orphan")
    skills: Mapped[list["StudentSkill"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[int] = mapped_column(primary_key=True)
    canonical_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str | None] = mapped_column(String(80))
    aliases: Mapped[list] = mapped_column(JSON, default=list)


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(32))
    source_ref: Mapped[str | None] = mapped_column(String(500))
    extracted_summary: Mapped[str] = mapped_column(Text)
    observed_at: Mapped[datetime] = mapped_column(default=_now)
    extraction_confidence: Mapped[float | None] = mapped_column(Float)  # 0..1

    student: Mapped[Student] = relationship(back_populates="evidence")


class StudentSkill(Base):
    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("student_pk", "skill_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), index=True)
    level: Mapped[int | None] = mapped_column(Integer)  # 0-5; NULL = unknown
    confidence: Mapped[float] = mapped_column(Float, default=0.0)  # 0..1
    evidence_ids: Mapped[list] = mapped_column(JSON, default=list)

    student: Mapped[Student] = relationship(back_populates="skills")
    skill: Mapped[Skill] = relationship()


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    company: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    is_seeded: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=_now)

    skills: Mapped[list["JobSkill"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class JobSkill(Base):
    __tablename__ = "job_skills"
    __table_args__ = (UniqueConstraint("job_id", "skill_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), index=True)
    requirement_type: Mapped[str] = mapped_column(String(16))  # required | preferred
    importance: Mapped[float] = mapped_column(Float, default=0.5)  # 0..1
    expected_level: Mapped[int | None] = mapped_column(Integer)  # 0-5

    job: Mapped[Job] = relationship(back_populates="skills")
    skill: Mapped[Skill] = relationship()


class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    alignment: Mapped[float] = mapped_column(Float)  # 0..1
    evidence_coverage: Mapped[float] = mapped_column(Float)  # 0..1
    confidence: Mapped[float] = mapped_column(Float)  # 0..1
    formula_version: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(default=_now)

    gaps: Mapped[list["SkillGap"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    swot_items: Mapped[list["SWOTItem"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")


class SkillGap(Base):
    __tablename__ = "skill_gaps"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"))
    current_level: Mapped[int | None] = mapped_column(Integer)  # NULL = unknown
    required_level: Mapped[int | None] = mapped_column(Integer)
    gap: Mapped[int | None] = mapped_column(Integer)  # NULL when current level unknown
    priority: Mapped[str] = mapped_column(String(8))
    rationale: Mapped[str] = mapped_column(Text)

    analysis: Mapped[Analysis] = relationship(back_populates="gaps")
    skill: Mapped[Skill] = relationship()


class SWOTItem(Base):
    __tablename__ = "swot_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(16))
    statement: Mapped[str] = mapped_column(Text)
    evidence_refs: Mapped[list] = mapped_column(JSON, default=list)
    confidence_label: Mapped[str] = mapped_column(String(24), default="evidence_based")  # or "inference"

    analysis: Mapped[Analysis] = relationship(back_populates="swot_items")


class RoadmapItem(Base):
    __tablename__ = "roadmap_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey("analyses.id"))
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"))
    task: Mapped[str] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    resource_title: Mapped[str | None] = mapped_column(String(300))
    resource_url: Mapped[str | None] = mapped_column(String(2000))
    resource_provenance: Mapped[str | None] = mapped_column(String(24))  # serpapi_live | curated_fallback | demo_fixture
    effort_hours: Mapped[float | None] = mapped_column(Float)
    week: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="not_started")
    completion_criteria: Mapped[str | None] = mapped_column(Text)
    completion_evidence: Mapped[str | None] = mapped_column(Text)


class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"))
    question_set_version: Mapped[str] = mapped_column(String(32))
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    score: Mapped[float] = mapped_column(Float)  # 0..1
    completed_at: Mapped[datetime] = mapped_column(default=_now)


class ImportJob(Base):
    __tablename__ = "import_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(300))
    source_type: Mapped[str] = mapped_column(String(8))  # csv | xlsx
    status: Mapped[str] = mapped_column(String(24), default="uploaded")
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0)
    imported_rows: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_rows: Mapped[int] = mapped_column(Integer, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, default=0)
    field_mapping: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=_now)
    completed_at: Mapped[datetime | None] = mapped_column()

    issues: Mapped[list["ImportRowIssue"]] = relationship(back_populates="import_job", cascade="all, delete-orphan")


class ImportRowIssue(Base):
    __tablename__ = "import_row_issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    import_job_id: Mapped[int] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    field: Mapped[str | None] = mapped_column(String(80))
    issue_code: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(8), default="error")  # error | warning
    message: Mapped[str] = mapped_column(Text)

    import_job: Mapped[ImportJob] = relationship(back_populates="issues")

class ImportStagedRow(Base):
    __tablename__ = "import_staged_rows"
    id: Mapped[int] = mapped_column(primary_key=True)
    import_job_id: Mapped[int] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    values: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending")


class DiscoveredJob(Base):
    """Provider metadata lives beside existing jobs; old tables need no alteration."""
    __tablename__ = "discovered_jobs"
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True)
    provider_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    listing: Mapped[dict] = mapped_column(JSON)


class JobSearchCache(Base):
    __tablename__ = "job_search_cache"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    scope_key: Mapped[str] = mapped_column(String(64), index=True)
    page: Mapped[int] = mapped_column(Integer)
    response: Mapped[dict] = mapped_column(JSON)
    retrieved_at: Mapped[datetime] = mapped_column(default=_now)


class ResumeWorkspace(Base):
    __tablename__ = 'resume_workspaces'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    filename: Mapped[str] = mapped_column(String(200))
    original_text: Mapped[str] = mapped_column(Text)
    revised_text: Mapped[str] = mapped_column(Text)
    target: Mapped[dict] = mapped_column(JSON, default=dict)
    analysis: Mapped[dict | None] = mapped_column(JSON)
    decisions: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(default=_now)
    updated_at: Mapped[datetime] = mapped_column(default=_now)


class LinkedInProfile(Base):
    __tablename__ = 'linkedin_profiles'
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), primary_key=True)
    profile_url: Mapped[str | None] = mapped_column(String(500))
    profile_text: Mapped[str] = mapped_column(Text, default='')
    import_method: Mapped[str | None] = mapped_column(String(32))
    consent_at: Mapped[datetime] = mapped_column(default=_now)
    confirmed: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(default=_now)


class LinkedInPublicLookup(Base):
    __tablename__ = 'linkedin_public_lookups'
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), primary_key=True)
    id: Mapped[str] = mapped_column(String(64), unique=True)
    result: Mapped[dict] = mapped_column(JSON)


class LinkedInAuthorization(Base):
    """Short-lived authorization receipts; provider tokens are never persisted."""
    __tablename__ = 'linkedin_authorizations'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    expires_at: Mapped[datetime] = mapped_column(index=True)
    status: Mapped[str] = mapped_column(String(16), default='pending')
    name: Mapped[str | None] = mapped_column(String(200))
    message: Mapped[str | None] = mapped_column(String(300))


class RoadmapTask(Base):
    __tablename__ = 'roadmap_tasks'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default='')
    status: Mapped[str] = mapped_column(String(16), default='not_started')
    priority: Mapped[str] = mapped_column(String(8), default='medium')
    due_date: Mapped[date | None]
    roadmap_milestone_id: Mapped[int | None] = mapped_column(ForeignKey('roadmap_items.id', ondelete='SET NULL'), index=True)
    skill_id: Mapped[int | None] = mapped_column(ForeignKey('skills.id'))
    created_at: Mapped[datetime] = mapped_column(default=_now)
    updated_at: Mapped[datetime] = mapped_column(default=_now)
    completed_at: Mapped[datetime | None]
    version: Mapped[int] = mapped_column(default=1)


class Account(Base):
    __tablename__ = 'accounts'
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(16), default='student')
    student_pk: Mapped[int | None] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), unique=True)
    active: Mapped[bool] = mapped_column(default=True)
    session_version: Mapped[int] = mapped_column(default=1)


class FacultyScope(Base):
    __tablename__ = 'faculty_scopes'
    admin_id: Mapped[int] = mapped_column(ForeignKey('accounts.id', ondelete='CASCADE'), primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), primary_key=True)


class Cohort(Base):
    __tablename__ = 'placement_cohorts'
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey('accounts.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(120))
    batch: Mapped[str] = mapped_column(String(40))
    section: Mapped[str] = mapped_column(String(40))


class CohortMember(Base):
    __tablename__ = 'placement_cohort_members'
    cohort_id: Mapped[int] = mapped_column(ForeignKey('placement_cohorts.id', ondelete='CASCADE'), primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), primary_key=True)


class StudentPlacementMeta(Base):
    __tablename__ = 'student_placement_meta'
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), primary_key=True)
    batch: Mapped[str | None] = mapped_column(String(40))
    section: Mapped[str | None] = mapped_column(String(40))


class ImportAccess(Base):
    __tablename__ = 'placement_import_access'
    import_id: Mapped[int] = mapped_column(ForeignKey('import_jobs.id', ondelete='CASCADE'), primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey('accounts.id', ondelete='CASCADE'), index=True)
    cohort_id: Mapped[int] = mapped_column(ForeignKey('placement_cohorts.id', ondelete='CASCADE'))


class ResumeRevision(Base):
    __tablename__ = 'resume_revisions'
    id: Mapped[int] = mapped_column(primary_key=True)
    __table_args__ = (UniqueConstraint('workspace_id', 'version'),)
    workspace_id: Mapped[int] = mapped_column(ForeignKey('resume_workspaces.id', ondelete='CASCADE'), index=True)
    version: Mapped[int]
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=_now)


class FacultyResumeReview(Base):
    __tablename__ = 'faculty_resume_reviews'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey('accounts.id', ondelete='CASCADE'), index=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey('resume_revisions.id', ondelete='CASCADE'))
    status: Mapped[str] = mapped_column(String(24), default='submitted')
    shared: Mapped[bool] = mapped_column(default=True)
    suggestions: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_now)


class FacultyReviewFeedback(Base):
    __tablename__ = 'faculty_review_feedback'
    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey('faculty_resume_reviews.id', ondelete='CASCADE'), index=True)
    status: Mapped[str] = mapped_column(String(24))
    feedback: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=_now)


class PlacementDrive(Base):
    __tablename__ = 'placement_drives'
    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey('accounts.id', ondelete='CASCADE'), index=True)
    cohort_id: Mapped[int] = mapped_column(ForeignKey('placement_cohorts.id', ondelete='CASCADE'))
    company: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    deadline: Mapped[date]
    eligibility: Mapped[dict] = mapped_column(JSON, default=dict)
    application_link: Mapped[str] = mapped_column(String(2000))
    version: Mapped[int] = mapped_column(default=1)


class PlacementApplication(Base):
    __tablename__ = 'placement_applications'
    __table_args__ = (UniqueConstraint('drive_id', 'student_pk'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    drive_id: Mapped[int] = mapped_column(ForeignKey('placement_drives.id', ondelete='CASCADE'), index=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    stage: Mapped[str] = mapped_column(String(24), default='applied')
    eligibility_override: Mapped[bool | None]
    review_reason: Mapped[str | None] = mapped_column(String(2000))
    version: Mapped[int] = mapped_column(default=1)
    updated_at: Mapped[datetime] = mapped_column(default=_now)


class ApplicationEvent(Base):
    __tablename__ = 'placement_application_events'
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey('placement_applications.id', ondelete='CASCADE'), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey('accounts.id'))
    stage: Mapped[str] = mapped_column(String(24))
    note: Mapped[str] = mapped_column(String(2000), default='')
    created_at: Mapped[datetime] = mapped_column(default=_now)


class TrainingAssignment(Base):
    __tablename__ = 'faculty_training_assignments'
    __table_args__ = (UniqueConstraint('group_key', 'student_pk'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    group_key: Mapped[str] = mapped_column(String(64))
    admin_id: Mapped[int] = mapped_column(ForeignKey('accounts.id'), index=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(24))
    instructions: Mapped[str] = mapped_column(Text, default='')
    resource_url: Mapped[str | None] = mapped_column(String(2000))
    skill_id: Mapped[int | None] = mapped_column(ForeignKey('skills.id'))
    roadmap_item_id: Mapped[int | None] = mapped_column(ForeignKey('roadmap_items.id', ondelete='SET NULL'))
    deadline: Mapped[date]
    status: Mapped[str] = mapped_column(String(24), default='not_started')
    evidence: Mapped[str] = mapped_column(Text, default='')
    version: Mapped[int] = mapped_column(default=1)


class AdminAudit(Base):
    __tablename__ = 'admin_audit'
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey('accounts.id'))
    action: Mapped[str] = mapped_column(String(60))
    object_type: Mapped[str] = mapped_column(String(40))
    object_id: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(default=_now)


class AuthRateLimit(Base):
    __tablename__ = 'auth_rate_limits'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(default=_now)
    attempts: Mapped[int] = mapped_column(default=0)
