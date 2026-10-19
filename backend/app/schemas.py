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


DocumentType = Literal['resume', 'certificate', 'transcript', 'project_report', 'internship_document', 'unknown']
DocumentField = Literal['name', 'department', 'program', 'specialization', 'semester', 'graduation_year',
                        'skills', 'projects', 'experience', 'certifications', 'portfolio_urls', 'github_urls', 'linkedin_urls']


class DocumentStrict(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, str_strip_whitespace=True)


class SourceExcerpt(DocumentStrict):
    excerpt: str = Field(min_length=1, max_length=600)
    page: int | None = Field(default=None, ge=1, le=30)
    section: str | None = Field(default=None, max_length=80)


class DocumentScalar(DocumentStrict):
    value: str = Field(min_length=1, max_length=600)


class DocumentSkill(DocumentStrict):
    name: str = Field(min_length=1, max_length=120)


class DocumentFact(DocumentStrict):
    id: str = Field(pattern=r'^fact-[A-Za-z0-9_-]{1,60}$')
    field: DocumentField
    value: DocumentScalar | DocumentSkill
    fact_kind: Literal['explicit'] = 'explicit'
    evidence: list[SourceExcerpt] = Field(min_length=1, max_length=5)
    confidence: float = Field(ge=0, le=1, default=0.5)

    @model_validator(mode='after')
    def field_value(self):
        if (self.field == 'skills') != isinstance(self.value, DocumentSkill):
            raise ValueError('Field value does not match field policy')
        return self


class DocumentSuggestion(DocumentStrict):
    id: str = Field(pattern=r'^suggestion-[A-Za-z0-9_-]{1,60}$')
    field: DocumentField
    value: DocumentScalar | DocumentSkill
    reason: str = Field(min_length=1, max_length=300)
    evidence: list[SourceExcerpt] = Field(min_length=1, max_length=5)


class DocumentClassification(DocumentStrict):
    status: Literal['classified', 'uncertain', 'unsupported']
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(min_length=1, max_length=300)


class DocumentExtractionResult(DocumentStrict):
    schema_version: Literal['document-extraction-v1'] = 'document-extraction-v1'
    document_type: DocumentType
    classification: DocumentClassification
    facts: list[DocumentFact] = Field(max_length=100)
    suggestions: list[DocumentSuggestion] = Field(default_factory=list, max_length=25)
    warnings: list[str] = Field(default_factory=list, max_length=20)


class DocumentAiIn(DocumentStrict):
    ai_consent: bool
    version: int = Field(ge=1)


class DocumentTypeIn(DocumentStrict):
    document_type: DocumentType
    version: int = Field(ge=1)


class DocumentDecisionIn(DocumentStrict):
    proposal_version: int = Field(ge=1)
    item_version: int = Field(ge=1)
    decision: Literal['accept', 'edit', 'reject']
    edited_value: DocumentScalar | DocumentSkill | None = None
    confirm_conflict: bool = False
    idempotency_key: str = Field(pattern=r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')


class DocumentItemOut(DocumentStrict):
    id: int
    field_path: str
    operation: str
    current_value: DocumentScalar | DocumentSkill | None
    proposed_value: DocumentScalar | DocumentSkill | None
    evidence: list[SourceExcerpt]
    fact_kind: Literal['explicit']
    comparison_status: str
    decision: str
    version: int


class DocumentProposalOut(DocumentStrict):
    id: int
    document_id: int
    status: str
    version: int
    items: list[DocumentItemOut]
    refresh_recommended: bool


class DocumentOut(DocumentStrict):
    id: int
    filename: str | None
    document_type: DocumentType
    classification_status: str
    status: str
    expires_at: datetime
    proposal: DocumentProposalOut | None = None
    extraction_status: str = 'not_requested'
    warnings: list[str] = Field(default_factory=list)


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorBody(BaseModel):
    """Structured error returned by every failing endpoint."""

    code: str
    message: str
    retryable: bool = False


class AuthSessionOut(BaseModel):
    access_token: str
    token_type: Literal['bearer'] = 'bearer'
    expires_in: int = 3600
    role: Literal['admin', 'student']
    student_id: int | None


class AccountOut(BaseModel):
    account_id: int
    username: str
    role: Literal['admin', 'student']
    student_id: int | None


class LoginIn(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)


class SignupIn(LoginIn):
    password: str = Field(min_length=12, max_length=256)
    student_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    department: str = Field(min_length=1, max_length=120)


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


class JourneyDetails(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    department: str | None = Field(default=None, min_length=1, max_length=120)
    program: str | None = Field(default=None, min_length=1, max_length=120)
    specialization: str | None = Field(default=None, min_length=1, max_length=120)
    semester: int | None = Field(default=None, ge=1, le=12)
    cgpa: float | None = Field(default=None, ge=0, le=10)
    graduation_year: int | None = Field(default=None, ge=2000, le=2100)
    skills: list[str] = Field(default_factory=list, max_length=30)
    summary: str = Field(default='', max_length=2000)

    @field_validator('skills')
    @classmethod
    def skill_names(cls, values):
        if any(not value.strip() or len(value.strip()) > 60 for value in values):
            raise ValueError('Use 1-60 characters per skill')
        return list(dict.fromkeys(value.strip() for value in values))


class JourneyPreviewOut(BaseModel):
    details: JourneyDetails
    ignored_columns: list[str]
    profile_digest: str


class JourneySaveIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    details: JourneyDetails
    profile_digest: str = Field(pattern=r'^[a-f0-9]{64}$')
    confirmed: bool


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


class RoadmapAiIn(BaseModel):
    description: str = Field(min_length=30, max_length=4000)
    consent: bool


class RoadmapAiPhaseOut(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    actions: list[str] = Field(min_length=1, max_length=8)


class RoadmapAiOut(BaseModel):
    status: Literal['available', 'not_requested', 'unavailable', 'quota_limit', 'timeout', 'blocked', 'invalid_output', 'error']
    message: str
    model: str | None = None
    summary: str | None = None
    phases: list[RoadmapAiPhaseOut] = Field(default_factory=list, max_length=6)


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


class ResumeCreateIn(BaseModel):
    text: str = Field(min_length=30, max_length=20000)
    storage_consent: bool


class ResumeTargetIn(BaseModel):
    ai_consent: bool = False
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


class ResumeSuggestionOut(BaseModel):
    source: Literal['gemini'] = 'gemini'
    factual_validation: Literal['equivalent_wording', 'gemini_verified'] = 'equivalent_wording'
    id: str
    kind: Literal['replace']
    original: str
    proposed: str
    reason: str
    skill: str | None = None
    requires_confirmation: bool = False


class GeminiStrengthOut(BaseModel):
    model_config = {'extra': 'forbid', 'str_strip_whitespace': True, 'strict': True}
    strength: str = Field(min_length=1, max_length=1000)
    excerpt: str = Field(min_length=1, max_length=2000)


class GeminiRewriteOut(BaseModel):
    model_config = {'extra': 'forbid', 'str_strip_whitespace': True, 'strict': True}
    original: str = Field(min_length=1, max_length=2000)
    proposed: str = Field(min_length=1, max_length=2000)
    reason: str = Field(min_length=1, max_length=1000)


class GeminiRewriteVerdictOut(BaseModel):
    model_config = {'extra': 'forbid', 'strict': True}
    id: str = Field(min_length=1, max_length=64)
    facts_preserved: bool


class GeminiRewriteVerificationOut(BaseModel):
    model_config = {'extra': 'forbid', 'strict': True}
    verdicts: list[GeminiRewriteVerdictOut] = Field(max_length=20)


class GeminiRatingOut(BaseModel):
    model_config = {'extra': 'forbid', 'strict': True, 'str_strip_whitespace': True}
    value: int | None = Field(ge=0, le=100)
    reason: str = Field(min_length=1, max_length=1000)
    excerpts: list[str] = Field(max_length=5)

    @field_validator('value', mode='before')
    @classmethod
    def integral_json_number(cls, value):
        # JSON providers sometimes serialize an integer rating as 65.0.
        # Preserve its exact value; never coerce strings, booleans or fractions.
        return int(value) if type(value) is float and value.is_integer() else value


class GeminiScoresOut(BaseModel):
    model_config = {'extra': 'forbid', 'strict': True, 'str_strip_whitespace': True}
    overall: GeminiRatingOut
    relevance: GeminiRatingOut
    evidence: GeminiRatingOut
    clarity: GeminiRatingOut
    structure: GeminiRatingOut


class GeminiFeedbackOut(BaseModel):
    model_config = {'extra': 'forbid', 'strict': True, 'str_strip_whitespace': True}
    summary: str = Field(min_length=1, max_length=1500)
    scores: GeminiScoresOut
    strengths: list[GeminiStrengthOut] = Field(max_length=12)
    gaps: list[str] = Field(max_length=20)
    improvements: list[str] = Field(max_length=20)
    rewrites: list[GeminiRewriteOut] = Field(max_length=20)
    questions: list[str] = Field(max_length=20)

    @model_validator(mode='after')
    def bounded_text(self):
        for text in self.gaps + self.improvements + self.questions:
            if not text.strip() or len(text) > 1000:
                raise ValueError('Feedback must be nonblank and bounded')
        return self


class GeminiReviewOut(BaseModel):
    status: Literal['available', 'not_requested', 'unavailable', 'quota_limit', 'timeout', 'blocked', 'invalid_output', 'error']
    message: str
    model: str | None = None
    feedback: GeminiFeedbackOut | None = None
    rejected_rewrites: int = 0
    rewrite_validation_status: Literal['not_needed', 'available', 'unavailable'] = 'not_needed'
    rewrite_message: str | None = None
    validation_warnings: list[str] = Field(default_factory=list)


class ResumeAnalysisOut(BaseModel):
    engine: Literal['gemini'] = 'gemini'
    ai_review: GeminiReviewOut
    target_title: str
    target_source: Literal['serpapi_live', 'user_provided']
    source_url: str | None = None
    suggestions: list[ResumeSuggestionOut]
    disclaimer: str = 'Gemini ratings are subjective AI estimates out of 100, not official ATS scores, verified proficiency or hiring probabilities.'


class ExtractedFieldOut(BaseModel):
    value: str
    source: str
    excerpt: str
    status: Literal['explicit', 'uncertain'] = 'explicit'
    confidence: float = Field(ge=0, le=1)


class ExtractedSkillOut(BaseModel):
    name: str
    category: str | None
    level: Level = None
    sources: list[SourceClaimOut]


class CandidateExtractionOut(BaseModel):
    fields: dict[str, list[ExtractedFieldOut]]
    skills: list[ExtractedSkillOut]
    conflicts: list[str] = Field(default_factory=list)
    missing_fields: list[str]
    analyzed_at: datetime | None
    warnings: list[str]


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

    @field_validator('analysis', mode='before')
    @classmethod
    def current_analysis_only(cls, value):
        # Preserve old originals/revisions without exposing retired engine results.
        return value if value is None or isinstance(value, ResumeAnalysisOut) or value.get('engine') == 'gemini' else None

    @computed_field
    @property
    def extracted_profile(self) -> CandidateExtractionOut:
        from app.services.candidate_profile import extract_profile
        return extract_profile([(self.revised_text, 'resume_saved_revision', False)], self.updated_at)


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
    def extracted_profile(self) -> CandidateExtractionOut:
        from app.services.candidate_profile import extract_profile
        return extract_profile([(self.profile_text, 'linkedin_' + (self.import_method or 'self_provided'), self.confirmed)], self.updated_at)

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


# Placement contracts. No readiness value is used to infer placement outcomes.
class PlacementInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class ImportPreviewIn(PlacementInput):
    job_id: int = Field(gt=0)
    mapping: dict[str, str]


class ImportConfirmIn(PlacementInput):
    job_id: int = Field(gt=0)
    update_duplicates: bool = False


class CohortIn(PlacementInput):
    name: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    batch: str = Field(min_length=1, max_length=40)
    section: str = Field(min_length=1, max_length=40)


class CohortOut(CohortIn, ORM):
    id: int
    students: int = 0


class PlacementStudentOut(BaseModel):
    id: int
    student_id: str
    name: str
    department: str | None
    batch: str | None
    section: str | None
    profile_completion: float
    resume_status: str
    assessments_completed: int
    roadmap_completed: int
    roadmap_total: int
    training_completed: int
    training_total: int
    overdue: int
    applications: int
    offers: int
    follow_up: list[str]


class PlacementStudentsOut(BaseModel):
    items: list[PlacementStudentOut]
    total: int
    page: int
    page_size: int


class PlacementDashboardOut(BaseModel):
    metrics: dict[str, int | float | None]
    definitions: dict[str, str]
    follow_up: list[PlacementStudentOut]


class ReviewShareIn(PlacementInput):
    workspace_id: int = Field(gt=0)
    version: int = Field(ge=1)
    admin_id: int = Field(gt=0)
    share_suggestions: bool = False
    consent: bool


class ReviewDecisionIn(PlacementInput):
    status: Literal['changes_requested', 'approved']
    feedback: str = Field(min_length=1, max_length=4000)


class ReviewFeedbackOut(ORM):
    id: int
    status: str
    feedback: str
    created_at: datetime


class FacultyReviewOut(BaseModel):
    id: int
    student_id: int
    admin_id: int
    workspace_id: int
    version: int
    text: str
    status: Literal['submitted', 'changes_requested', 'approved']
    shared: bool
    suggestions: ResumeAnalysisOut | None
    feedback: list[ReviewFeedbackOut]
    created_at: datetime
    disclaimer: str = 'Faculty approval is a review decision, not external verification of resume facts.'


class ResumeRevisionOut(ORM):
    id: int
    workspace_id: int
    version: int
    text: str
    created_at: datetime


class EligibilityIn(PlacementInput):
    min_cgpa: float | None = Field(default=None, ge=0, le=10)
    departments: list[str] = Field(default_factory=list, max_length=30)
    graduation_year: int | None = Field(default=None, ge=2000, le=2100)


class DriveIn(PlacementInput):
    cohort_id: int = Field(gt=0)
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=8000)
    deadline: date
    eligibility: EligibilityIn = Field(default_factory=EligibilityIn)
    application_link: HttpUrl


class DriveUpdateIn(DriveIn):
    version: int = Field(ge=1)


class EligibilityOut(BaseModel):
    status: Literal['eligible', 'not_eligible', 'needs_review']
    reasons: list[str]


class DriveOut(ORM):
    id: int
    cohort_id: int
    company: str
    role: str
    description: str
    deadline: date
    eligibility: EligibilityIn
    application_link: str
    version: int
    decision: EligibilityOut | None = None


ApplicationStage = Literal['applied', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn']


class ApplicationUpdateIn(PlacementInput):
    version: int = Field(ge=1)
    stage: ApplicationStage
    note: str = Field(default='', max_length=2000)
    eligibility_override: bool | None = None
    review_reason: str | None = Field(default=None, min_length=1, max_length=2000)


class ApplicationEventOut(ORM):
    stage: ApplicationStage
    note: str
    created_at: datetime


class ApplicationOut(ORM):
    id: int
    drive_id: int
    student_pk: int
    stage: ApplicationStage
    eligibility_override: bool | None
    review_reason: str | None
    version: int
    updated_at: datetime
    history: list[ApplicationEventOut] = []


class TrainingIn(PlacementInput):
    student_ids: list[int] = Field(default_factory=list, max_length=5000)
    cohort_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=200)
    kind: Literal['resource', 'course', 'project', 'assessment']
    instructions: str = Field(default='', max_length=4000)
    resource_url: HttpUrl | None = None
    skill_id: int | None = Field(default=None, gt=0)
    roadmap_item_id: int | None = Field(default=None, gt=0)
    deadline: date


class TrainingProgressIn(PlacementInput):
    version: int = Field(ge=1)
    status: Literal['not_started', 'in_progress', 'completed']
    evidence: str = Field(default='', max_length=4000)


class TrainingOut(ORM):
    id: int
    student_pk: int
    title: str
    kind: str
    instructions: str
    resource_url: str | None
    skill_id: int | None
    roadmap_item_id: int | None
    deadline: date
    status: str
    evidence: str
    version: int


class AssessmentSummaryOut(ORM):
    id: int
    skill_id: int
    score: float
    completed_at: datetime


class PlacementDetailOut(BaseModel):
    profile: ProfileOut
    summary: PlacementStudentOut
    assessments: list[AssessmentSummaryOut]
    roadmap: list[RoadmapItemOut]
    training: list[TrainingOut]
    applications: list[ApplicationOut]
    reviews: list[FacultyReviewOut]


class BatchSkillOut(BaseModel):
    skill: SkillOut
    required_level: int | None
    common_gap_count: int
    known_count: int
    mean_proficiency: float | None
    assessed_count: int
    mean_assessed_proficiency: float | None
    missing_assessment_count: int
    unknown_count: int
    gap_student_ids: list[int]
    unknown_student_ids: list[int]
    assessed_student_ids: list[int]
    missing_assessment_student_ids: list[int]


class BatchGapOut(BaseModel):
    cohort_id: int
    job: JobOut
    student_count: int
    skills: list[BatchSkillOut]
    source: str
    disclaimer: str = READINESS_DISCLAIMER
