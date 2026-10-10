"""Shared API contracts (Pydantic). The mobile client mirrors these in mobile/src/types/contracts.ts.

Conventions: proficiency 0-5 where None means *unknown* (never zero); confidence/alignment/coverage are 0-1.
"""

from datetime import datetime, date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, computed_field, field_validator, model_validator

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
    measurable: bool = True


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


# ---- Retrieved listings: observations, not verified active openings -------
class JobSearchIn(BaseModel):
    role: str = Field(min_length=1, max_length=120)
    location: str = Field(default="", max_length=120)
    keywords: str = Field(default="", max_length=160)
    level: Literal["any", "entry_level", "internship"] = "any"
    page: int = Field(default=1, ge=1, le=3)
    next_page_token: str | None = Field(default=None, max_length=2048)


class ObservedRequirement(BaseModel):
    name: str
    requirement_type: Literal["required", "preferred", "mentioned"]
    expected_level: Level = None
    excerpt: str


class JobListingOut(BaseModel):
    id: int
    stable_identity: str | None = None
    title: str
    company: str | None = None
    location: str | None = None
    employment_type: str | None = None
    experience_level: str | None = None
    description: str
    source_url: HttpUrl | None = None
    source_domain: str | None = None
    retrieved_at: datetime
    provenance: ResourceProvenance
    active_status: Literal["not_verified"] = "not_verified"
    skills: list[ObservedRequirement] = []
    missing_fields: list[str] = []
    warnings: list[str] = []


class JobSearchOut(BaseModel):
    search_id: str
    scope: JobSearchIn
    query: str
    jobs: list[JobListingOut]
    retrieved_at: datetime
    provenance: ResourceProvenance
    cache_status: Literal["live", "fresh_cache", "stale_cache"]
    next_page_token: str | None = None
    warnings: list[str] = []


class JobMatchIn(BaseModel):
    student_id: int = Field(gt=0)


class JobMatchOut(BaseModel):
    listing: JobListingOut
    analysis: AnalysisOut
    evidenced_skills: list[str]
    unknown_skills: list[str]
    explanation: list[str]


class MarketSkillOut(BaseModel):
    name: str
    count: int
    required_count: int
    preferred_count: int
    share: float


class MarketSkillsOut(BaseModel):
    search_id: str
    scope: JobSearchIn
    sample_size: int
    retrieved_at: datetime
    provenance: ResourceProvenance
    skills: list[MarketSkillOut]
    warnings: list[str]


class ResumeAdviceIn(JobMatchIn):
    text: str = Field(min_length=30, max_length=20000)


class ResumeAdviceOut(BaseModel):
    supported_keywords: list[str]
    unsubstantiated_keywords: list[str]
    suggestions: list[str]
    limitations: list[str]


class RoadmapProgressIn(BaseModel):
    status: RoadmapStatus
    completion_evidence: str | None = Field(default=None, max_length=2000)


class MarketFilter(BaseModel):
    role: str = Field(default='', max_length=120)
    location: str = Field(default='', max_length=120)
    collected_after: datetime | None = None
    collected_before: datetime | None = None


class DemandSkillOut(BaseModel):
    name: str
    distinct_job_count: int
    demand_percentage: float | None
    required_count: int
    preferred_count: int
    job_ids: list[int]


class MarketDemandOut(BaseModel):
    filters: MarketFilter
    sample_size: int
    collection_count: int
    first_collected_at: datetime | None
    last_collected_at: datetime | None
    data_status: Literal['available', 'insufficient', 'empty']
    skills: list[DemandSkillOut]
    jobs: list[JobListingOut]
    warnings: list[str]
    formula: str = 'distinct_jobs_mentioning_skill / total_distinct_jobs_analyzed * 100'


class MarketScopeOut(BaseModel):
    roles: list[str]
    locations: list[str]
    collection_count: int


class MarketCompareSkillOut(BaseModel):
    name: str
    # Absent from a nonempty collected sample is 0; an empty sample is null.
    percentages: dict[str, float | None]


class MarketCompareOut(BaseModel):
    roles: list[MarketDemandOut]
    rows: list[MarketCompareSkillOut]


class StudentDemandSkillOut(DemandSkillOut):
    status: Literal['present', 'missing', 'unverified']
    current_level: Level
    competency_percentage: float | None
    expected_level: Level
    evidence_ids: list[int]
    action: Literal['learn', 'assess', 'maintain']
    priority_score: float
    explanation: str
    resources: list[ResourceLink]
    roadmap_items: list[RoadmapItemOut]


class MarketMeOut(BaseModel):
    student_id: int
    market: MarketDemandOut
    skills: list[StudentDemandSkillOut]
    evidenced_skill_count: int
    observed_skill_count: int
    coverage_percentage: float | None
    coverage_definition: str = 'Observed skills with recorded evidence and known proficiency above zero / all observed skills * 100; not eligibility.'


class ResumeUploadOut(BaseModel):
    filename: str
    extracted_character_count: int
    advice: ResumeAdviceOut


class ResumeCreateIn(BaseModel):
    text: str = Field(min_length=30, max_length=20000)
    storage_consent: bool


class ResumeTargetIn(BaseModel):
    version: int = Field(ge=1)
    job_id: int | None = Field(default=None, gt=0)
    title: str = Field(default='', max_length=200)
    description: str = Field(default='', max_length=20000)

    @model_validator(mode='after')
    def valid_target(self):
        if self.job_id is None and (not self.title.strip() or len(self.description.strip()) < 30):
            raise ValueError('Select a retrieved job or supply a title and at least 30 description characters')
        if self.job_id is not None and (self.title or self.description):
            raise ValueError('Choose either a retrieved job or a manual description')
        return self


class SourceClaimOut(BaseModel):
    source: str
    kind: Literal['assessed_profile', 'profile_evidence', 'project_or_experience', 'self_report']
    excerpt: str
    confirmed: bool = False
    claimed_level: Level = None


class UnifiedSkillOut(BaseModel):
    name: str
    sources: list[SourceClaimOut]
    profile_level: Level
    proficiency_assessed: bool
    conflict: bool
    requires_confirmation: bool


class ResumeSuggestionOut(BaseModel):
    id: str
    kind: Literal['replace', 'append', 'review']
    original: str
    proposed: str
    reason: str
    skill: str | None = None
    requires_confirmation: bool = False


class ResumeAnalysisOut(BaseModel):
    target_title: str
    target_source: Literal['serpapi_live', 'user_provided']
    source_url: str | None = None
    requirements: list[ObservedRequirement]
    resume_skills: list[str]
    matching_skills: list[str]
    not_detected_skills: list[str]
    stronger_evidence_skills: list[str]
    unified_skills: list[UnifiedSkillOut]
    sections: dict[str, list[str]]
    profile_sections: dict[str, list[str]] = Field(default_factory=dict)
    relevant_excerpts: list[str]
    structure_feedback: list[str]
    score: float | None
    score_components: dict[str, float | None]
    rubric_version: str = 'resume-text-checks-v1'
    rubric: str = '50% required-keyword coverage + 20% all requirement-keyword coverage + 20% project/experience context coverage + 10% recognized section coverage; all components 0–100.'
    suggestions: list[ResumeSuggestionOut]
    career_recommendations: list[str]
    warnings: list[str]


class ResumeStatisticsOut(BaseModel):
    strength_score: int
    section_coverage: int
    present_sections: list[str]
    missing_sections: list[str]
    word_count: int
    character_count: int
    bullet_count: int
    action_statement_count: int
    quantified_statement_count: int
    detected_skills: list[str]
    feedback: list[str]
    rubric_version: str
    rubric: str


class ResumeWorkspaceOut(ORM):
    id: int
    filename: str
    original_text: str
    revised_text: str
    target: dict
    analysis: ResumeAnalysisOut | None
    decisions: dict[str, dict]
    version: int
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def original_statistics(self) -> ResumeStatisticsOut:
        from app.services.resume_statistics import text_statistics
        return ResumeStatisticsOut(**text_statistics(self.original_text))

    @computed_field
    @property
    def revised_statistics(self) -> ResumeStatisticsOut:
        from app.services.resume_statistics import text_statistics
        return ResumeStatisticsOut(**text_statistics(self.revised_text))


class ResumeDecisionIn(BaseModel):
    version: int = Field(ge=1)
    decision: Literal['accepted', 'rejected', 'pending']
    confirmation: str = Field(default='', max_length=2000)


class ResumeSaveIn(BaseModel):
    version: int = Field(ge=1)
    text: str = Field(min_length=30, max_length=20000)
    factual_confirmation: bool


class ResumeVersionIn(BaseModel):
    version: int = Field(ge=1)


class ResumeExportIn(ResumeVersionIn):
    format: Literal['docx', 'txt'] = 'docx'
    final_review_confirmed: bool


class LinkedInIn(BaseModel):
    lookup_id: str | None = Field(default=None, max_length=64)
    profile_url: str | None = Field(default=None, max_length=500)
    profile_text: str = Field(default='', max_length=20000)
    consent: bool
    confirmed: bool = False

    @field_validator('profile_url')
    @classmethod
    def profile_link(cls, value):
        from app.validation import linkedin_url
        return linkedin_url(value)


class LinkedInAnalyzeIn(BaseModel):
    target_role: Literal['Data Analyst', 'Machine Learning Engineer', 'Full Stack Developer', 'Backend Developer', 'Cloud / DevOps Engineer'] = 'Data Analyst'
    job_description: str = Field(default='', max_length=20000)


class ProfileSkillEvidenceOut(BaseModel):
    name: str
    level: None = None
    evidence_strength: Literal['mention_only', 'project_context', 'applied_example', 'quantified_example']
    excerpts: list[dict[str, str]]


class ProfileRoleMatchOut(BaseModel):
    title: str
    source: Literal['curated_role_template', 'user_provided_job_description']
    keyword_coverage: float | None
    expected_skills: list[str]
    matched_skills: list[str]
    evidence_backed_skills: list[str]
    not_detected_skills: list[str]


class ProfileImprovementOut(BaseModel):
    priority: Literal['high', 'medium', 'low']
    title: str
    reason: str
    action: str
    excerpt: str | None


class LinkedInAnalysisOut(BaseModel):
    engine: str
    source: str
    confirmed: bool
    data_scope: Literal['partial_public_search', 'supplied_profile_text']
    summary: str
    profile_quality_score: int | None
    quality_rubric: str
    present_sections: list[str]
    missing_sections: list[str]
    action_statement_count: int
    quantified_statement_count: int
    skills: list[ProfileSkillEvidenceOut]
    role_matches: list[ProfileRoleMatchOut]
    target: ProfileRoleMatchOut | None
    improvements: list[ProfileImprovementOut]
    headline_suggestion: str | None
    wording_suggestions: list[dict[str, str]]
    limitations: list[str]


class LinkedInOut(BaseModel):
    profile_url: str | None = None
    profile_text: str = ''
    import_method: str | None = None
    confirmed: bool = False
    consent_at: datetime | None = None
    updated_at: datetime | None = None
    automatic_import_available: bool = False
    message: str = 'Enter a LinkedIn profile URL to retrieve publicly indexed information, or supply your own profile text/export.'

    @computed_field
    @property
    def analysis(self) -> LinkedInAnalysisOut:
        from app.services.linkedin_insights import analyze_profile
        return LinkedInAnalysisOut(**analyze_profile(self.profile_text, self.import_method, self.confirmed))

    @computed_field
    @property
    def detected_skills(self) -> list[str]:
        from app.services.resume_enhancer import claims
        source = 'linkedin_public_search_reviewed' if self.import_method == 'public_search_reviewed' else 'linkedin_self_provided'
        return sorted(claims(self.profile_text, source, self.confirmed))

    @computed_field
    @property
    def sections(self) -> dict[str, list[str]]:
        from app.services.resume_enhancer import sections
        return sections(self.profile_text)


class LinkedInAuthorizationOut(BaseModel):
    id: str
    authorization_url: str
    expires_at: datetime


class LinkedInConnectionOut(BaseModel):
    id: str
    status: Literal['pending', 'exchanging', 'connected', 'failed']
    name: str | None = None
    message: str | None = None
    source: Literal['linkedin_oidc'] = 'linkedin_oidc'


class LinkedInPublicSearchIn(BaseModel):
    profile_url: str = Field(min_length=1, max_length=500)
    consent: bool

    @field_validator('profile_url')
    @classmethod
    def valid_url(cls, value):
        from app.validation import linkedin_url
        normalized = linkedin_url(value)
        if not normalized:
            raise ValueError('Enter a LinkedIn profile URL')
        return normalized


class LinkedInPublicSourceOut(BaseModel):
    title: str
    url: str
    snippet: str


class LinkedInPublicSearchOut(BaseModel):
    id: str
    profile_url: str
    status: Literal['found', 'not_found']
    retrieved_at: datetime
    provenance: Literal['serpapi_live', 'demo_fixture']
    cache_status: Literal['live', 'cached'] = 'live'
    sources: list[LinkedInPublicSourceOut]
    detected_skills: list[str]
    profile_text: str
    warnings: list[str]


class RoadmapTaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=4000)
    priority: Priority = Priority.medium
    due_date: date | None = None
    roadmap_milestone_id: int | None = Field(default=None, gt=0)
    skill_id: int | None = Field(default=None, gt=0)

    @field_validator('title')
    @classmethod
    def nonblank_title(cls, value):
        if not value.strip():
            raise ValueError('Task title cannot be blank')
        return value.strip()


class RoadmapTaskPatch(BaseModel):
    version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    status: RoadmapStatus | None = None
    priority: Priority | None = None
    due_date: date | None = None
    roadmap_milestone_id: int | None = Field(default=None, gt=0)
    skill_id: int | None = Field(default=None, gt=0)


class RoadmapTaskOut(ORM):
    id: int
    title: str
    description: str
    status: RoadmapStatus
    priority: Priority
    due_date: date | None
    roadmap_milestone_id: int | None
    skill_id: int | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    version: int


class TaskListOut(BaseModel):
    tasks: list[RoadmapTaskOut]
    total: int
    completed: int
    remaining: int
    completion_percentage: float | None
    milestone_counts: dict[int, dict[str, int]]
