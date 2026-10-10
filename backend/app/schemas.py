"""Shared API contracts (Pydantic). The mobile client mirrors these in mobile/src/types/contracts.ts.

Conventions: proficiency 0-5 where None means *unknown* (never zero); confidence/alignment/coverage are 0-1.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl

from app.enums import (
    ImportStatus,
    Priority,
    RequirementType,
    ResourceProvenance,
    RoadmapStatus,
    SourceType,
    SwotCategory,
)

READINESS_DISCLAIMER = (
    "Informational indicator of alignment with a target role based on available evidence. "
    "It is not a prediction or probability of placement or employment."
)
FORMULA_VERSION = "v0-unset"  # replaced by the Phase 3 scoring service

Level = int | None  # 0-5, None = unknown


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorBody(BaseModel):
    """Structured error returned by every failing endpoint."""

    code: str
    message: str
    retryable: bool = False


# ---- Students & evidence -------------------------------------------------
class StudentIn(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    department: str | None = None
    program: str | None = None
    specialization: str | None = None
    semester: int | None = Field(default=None, ge=1, le=12)
    cgpa: float | None = Field(default=None, ge=0, le=10)
    graduation_year: int | None = Field(default=None, ge=2000, le=2100)


class StudentOut(StudentIn, ORM):
    id: int
    is_synthetic: bool = False


class EvidenceIn(BaseModel):
    source_type: SourceType
    source_ref: str | None = None
    extracted_summary: str = Field(min_length=1, max_length=4000)
    extraction_confidence: float | None = Field(default=None, ge=0, le=1)


class EvidenceOut(EvidenceIn, ORM):
    id: int
    observed_at: datetime


class SkillOut(ORM):
    id: int
    canonical_name: str
    category: str | None = None


class Competency(BaseModel):
    skill: SkillOut
    level: Level = Field(default=None, ge=0, le=5)
    confidence: float = Field(default=0, ge=0, le=1)
    evidence_ids: list[int] = []


class ProfileOut(BaseModel):
    student: StudentOut
    evidence: list[EvidenceOut] = []
    competencies: list[Competency] = []


# ---- Jobs ---------------------------------------------------------------
class JobAnalyzeIn(BaseModel):
    """Provide a pasted description or the id of a seeded role."""

    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    seeded_job_id: int | None = None


class JobSkillOut(BaseModel):
    skill: SkillOut
    requirement_type: RequirementType
    importance: float = Field(ge=0, le=1)
    expected_level: Level = Field(default=None, ge=0, le=5)


class JobOut(BaseModel):
    id: int
    title: str
    company: str | None = None
    skills: list[JobSkillOut] = []


# ---- Analysis, gaps, readiness ------------------------------------------
class SkillGapOut(BaseModel):
    skill: SkillOut
    current_level: Level = None
    required_level: Level = None
    gap: int | None = Field(default=None, description="None when current level is unknown")
    priority: Priority
    rationale: str
    evidence_ids: list[int] = []


class ReadinessOut(BaseModel):
    alignment: float = Field(ge=0, le=1)
    evidence_coverage: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    formula_version: str
    drivers: list[str] = []
    label: str = "Readiness indicator (informational)"
    disclaimer: str = READINESS_DISCLAIMER


class SwotItemOut(BaseModel):
    category: SwotCategory
    statement: str
    evidence_refs: list[str] = []
    confidence_label: str = "evidence_based"  # or "inference"


class SkillGapAnalyzeIn(BaseModel):
    student_id: int
    job_id: int


class AnalysisOut(BaseModel):
    id: int
    student_id: int
    job: JobOut
    readiness: ReadinessOut
    strengths: list[Competency] = []
    gaps: list[SkillGapOut] = []
    swot: list[SwotItemOut] = []
    warnings: list[str] = []
    created_at: datetime


# ---- Discovery (SerpApi) and roadmap ------------------------------------
class ResourceLink(BaseModel):
    title: str
    url: HttpUrl
    snippet: str | None = Field(default=None, max_length=500)
    source_domain: str | None = None
    provenance: ResourceProvenance  # serpapi_live | curated_fallback | demo_fixture


class ResourceSearchIn(BaseModel):
    skill: str = Field(min_length=1, max_length=120)
    kind: str = Field(default="learning_resource", pattern="^(learning_resource|job_postings)$")
    max_results: int = Field(default=5, ge=1, le=10)


class ResourceSearchOut(BaseModel):
    query: str
    results: list[ResourceLink]
    provenance: ResourceProvenance
    warnings: list[str] = []


class RoadmapItemOut(ORM):
    id: int
    skill_id: int
    task: str
    objective: str | None = None
    resource_title: str | None = None
    resource_url: str | None = None
    resource_provenance: ResourceProvenance | None = None
    effort_hours: float | None = Field(default=None, ge=0)
    week: int | None = None
    status: RoadmapStatus = RoadmapStatus.not_started
    completion_criteria: str | None = None
    completion_evidence: str | None = None


# ---- Assessment & dashboard ---------------------------------------------
class AssessmentSubmitIn(BaseModel):
    student_id: int
    skill_id: int
    question_set_version: str
    answers: dict[str, str]


class AssessmentOut(BaseModel):
    id: int
    skill_id: int
    score: float = Field(ge=0, le=1)
    updated_level: Level = Field(default=None, ge=0, le=5)
    readiness: ReadinessOut | None = None


class DashboardOut(BaseModel):
    student: StudentOut
    target_job: JobOut | None = None
    readiness: ReadinessOut | None = None
    top_gaps: list[SkillGapOut] = []
    roadmap_progress: dict[str, int] = {}  # status -> count
    next_action: RoadmapItemOut | None = None
    data_mode: str = "live"  # live | demo


# ---- Imports ------------------------------------------------------------
class ImportIssueOut(ORM):
    row_number: int
    field: str | None = None
    issue_code: str
    severity: str = "error"
    message: str


class ImportJobOut(ORM):
    id: int
    filename: str
    source_type: str
    status: ImportStatus
    total_rows: int = 0
    valid_rows: int = 0
    imported_rows: int = 0
    duplicate_rows: int = 0
    error_rows: int = 0
    field_mapping: dict[str, str] = {}
    created_at: datetime
    completed_at: datetime | None = None


# ---- Health -------------------------------------------------------------
class HealthOut(BaseModel):
    status: str
    version: str
    database: str
    serpapi_configured: bool  # boolean only; the key is never exposed
