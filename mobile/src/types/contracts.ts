/**
 * API contracts mirrored from backend/app/schemas.py.
 * Conventions: proficiency 0-5 where `null` means unknown (never zero); alignment/coverage/confidence are 0-1.
 */
export type Level = number | null;

export interface CohortIn { name: string; department: string; batch: string; section: string }
export interface ImportPreviewIn { job_id: number; mapping: Record<string, string> }
export interface ImportConfirmIn { job_id: number; update_duplicates?: boolean }
export interface CohortOut extends CohortIn { id: number; students: number }
export interface PlacementStudentOut {
  id: number; student_id: string; name: string; department: string | null; batch: string | null; section: string | null;
  profile_completion: number; resume_status: string; assessments_completed: number; roadmap_completed: number; roadmap_total: number;
  training_completed: number; training_total: number; overdue: number; applications: number; offers: number; follow_up: string[];
}
export interface PlacementStudentsOut { items: PlacementStudentOut[]; total: number; page: number; page_size: number }
export interface PlacementDashboardOut { metrics: Record<string, number | null>; definitions: Record<string, string>; follow_up: PlacementStudentOut[] }
export interface PlacementFilter { q?: string; department?: string; batch?: string; section?: string; progress?: 'follow_up' | 'complete' | ''; cohort_id?: number }
export interface ReviewShareIn { workspace_id: number; version: number; admin_id: number; share_suggestions: boolean; consent: boolean }
export interface ReviewDecisionIn { status: 'changes_requested' | 'approved'; feedback: string }
export interface ReviewFeedbackOut { id: number; status: string; feedback: string; created_at: string }
export interface FacultyReviewOut {
  id: number; student_id: number; admin_id: number; workspace_id: number; version: number; text: string;
  status: 'submitted' | 'changes_requested' | 'approved'; shared: boolean; suggestions: ResumeAnalysisOut | null;
  feedback: ReviewFeedbackOut[]; created_at: string; disclaimer: string;
}
export interface ResumeRevisionOut { id: number; workspace_id: number; version: number; text: string; created_at: string }
export interface EligibilityIn { min_cgpa?: number | null; departments?: string[]; graduation_year?: number | null }
export interface EligibilityOut { status: 'eligible' | 'not_eligible' | 'needs_review'; reasons: string[] }
export interface DriveIn { cohort_id: number; company: string; role: string; description: string; deadline: string; eligibility: EligibilityIn; application_link: string }
export interface DriveUpdateIn extends DriveIn { version: number }
export interface DriveOut extends DriveIn { id: number; version: number; decision: EligibilityOut | null }
export type ApplicationStage = 'applied' | 'shortlisted' | 'interview' | 'offered' | 'rejected' | 'withdrawn';
export interface ApplicationUpdateIn { version: number; stage: ApplicationStage; note?: string; eligibility_override?: boolean; review_reason?: string }
export interface ApplicationEventOut { stage: ApplicationStage; note: string; created_at: string }
export interface ApplicationOut { id: number; drive_id: number; student_pk: number; stage: ApplicationStage; eligibility_override: boolean | null; review_reason: string | null; version: number; updated_at: string; history: ApplicationEventOut[] }
export interface TrainingIn { student_ids: number[]; cohort_id?: number; title: string; kind: 'resource' | 'course' | 'project' | 'assessment'; instructions: string; resource_url?: string; skill_id?: number; roadmap_item_id?: number; deadline: string }
export interface TrainingProgressIn { version: number; status: 'not_started' | 'in_progress' | 'completed'; evidence: string }
export interface TrainingOut { id: number; student_pk: number; title: string; kind: string; instructions: string; resource_url: string | null; skill_id: number | null; roadmap_item_id: number | null; deadline: string; status: string; evidence: string; version: number }
export interface AssessmentSummaryOut { id: number; skill_id: number; score: number; completed_at: string }
export interface PlacementDetailOut { profile: ProfileOut; summary: PlacementStudentOut; assessments: AssessmentSummaryOut[]; roadmap: RoadmapItemOut[]; training: TrainingOut[]; applications: ApplicationOut[]; reviews: FacultyReviewOut[] }
export interface BatchSkillOut {
  skill: SkillOut; required_level: number | null; common_gap_count: number; known_count: number; mean_proficiency: number | null;
  assessed_count: number; mean_assessed_proficiency: number | null; missing_assessment_count: number; unknown_count: number;
  gap_student_ids: number[]; unknown_student_ids: number[]; assessed_student_ids: number[]; missing_assessment_student_ids: number[];
}
export interface BatchGapOut { cohort_id: number; job: JobOut; student_count: number; skills: BatchSkillOut[]; source: string; disclaimer: string }

export type SourceType =
  | 'institutional_record' | 'resume' | 'project' | 'certification'
  | 'self_report' | 'github' | 'linkedin' | 'assessment' | 'demo';
export type RequirementType = 'required' | 'preferred';
export type Priority = 'high' | 'medium' | 'low';
export type ResourceProvenance = 'serpapi_live' | 'curated_fallback' | 'demo_fixture';
export type RoadmapStatus = 'not_started' | 'in_progress' | 'done';
export type SwotCategory = 'strength' | 'weakness' | 'opportunity' | 'threat';
export type ImportStatus =
  | 'uploaded' | 'previewed' | 'validated' | 'completed' | 'completed_with_errors' | 'failed';

export interface ErrorBody { code: string; message: string; retryable: boolean }
export interface AuthSessionOut {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  role: 'admin' | 'student';
  student_id: number | null;
}
export interface AccountOut { account_id: number; username: string; role: 'admin' | 'student'; student_id: number | null }
export interface LoginIn { username: string; password: string }
export interface SignupIn extends LoginIn { student_id: string; name: string; email: string; department: string }

export interface StudentIn {
  student_id: string; name: string; email: string;
  department?: string | null; program?: string | null; specialization?: string | null;
  semester?: number | null; cgpa?: number | null; graduation_year?: number | null;
}
export interface StudentOut extends StudentIn { id: number; is_synthetic: boolean }

export interface EvidenceIn {
  source_type: SourceType; source_ref?: string | null;
  extracted_summary: string; extraction_confidence?: number | null;
}
export interface EvidenceOut extends EvidenceIn { id: number; observed_at: string }

export interface SkillOut { id: number; canonical_name: string; category?: string | null }
export interface Competency { skill: SkillOut; level: Level; confidence: number; evidence_ids: number[] }
export interface ProfileOut { student: StudentOut; evidence: EvidenceOut[]; competencies: Competency[] }
export interface JourneyDetails { name?: string | null; department?: string | null; program?: string | null; specialization?: string | null; semester?: number | null; cgpa?: number | null; graduation_year?: number | null; skills: string[]; summary: string }
export interface JourneyPreviewOut { details: JourneyDetails; ignored_columns: string[]; profile_digest: string }
export interface JourneySaveIn { details: JourneyDetails; profile_digest: string; confirmed: boolean }

export interface JobAnalyzeIn { title?: string; description?: string; seeded_job_id?: number }
export interface JobSkillOut {
  skill: SkillOut; requirement_type: RequirementType; importance: number; expected_level: Level;
}
export interface JobOut { id: number; title: string; company?: string | null; skills: JobSkillOut[] }

export interface SkillGapOut {
  skill: SkillOut; current_level: Level; required_level: Level;
  gap: number | null; // null when current level is unknown
  priority: Priority; rationale: string; evidence_ids: number[];
}
export interface ReadinessOut {
  alignment: number; evidence_coverage: number; confidence: number; formula_version: string;
  drivers: string[]; label: string; disclaimer: string; // informational, never a placement probability
  measurable: boolean;
}
export interface SwotItemOut {
  category: SwotCategory; statement: string; evidence_refs: string[]; confidence_label: string;
}
export interface SkillGapAnalyzeIn { student_id: number; job_id: number }
export interface AnalysisOut {
  id: number; student_id: number; job: JobOut; readiness: ReadinessOut;
  strengths: Competency[]; gaps: SkillGapOut[]; swot: SwotItemOut[]; warnings: string[]; created_at: string;
}
export interface RoadmapAiPhaseOut { title: string; actions: string[] }
export interface RoadmapAiOut { status: 'available' | 'not_requested' | 'unavailable' | 'quota_limit' | 'timeout' | 'blocked' | 'invalid_output' | 'error'; message: string; model: string | null; summary: string | null; phases: RoadmapAiPhaseOut[] }

export interface ResourceLink {
  title: string; url: string; snippet?: string | null; source_domain?: string | null;
  provenance: ResourceProvenance;
}
export interface ResourceSearchIn {
  skill: string; kind?: 'learning_resource' | 'job_postings'; max_results?: number;
}
export interface ResourceSearchOut {
  query: string; results: ResourceLink[]; provenance: ResourceProvenance; warnings: string[];
}
export interface RoadmapItemOut {
  id: number; skill_id: number; task: string; objective?: string | null;
  resource_title?: string | null; resource_url?: string | null;
  resource_provenance?: ResourceProvenance | null; effort_hours?: number | null; week?: number | null;
  status: RoadmapStatus; completion_criteria?: string | null; completion_evidence?: string | null;
}

export interface AssessmentSubmitIn {
  student_id: number; skill_id: number; question_set_version: string; answers: Record<string, string>;
}
export interface AssessmentOut {
  id: number; skill_id: number; score: number; updated_level: Level; readiness?: ReadinessOut | null;
}
export interface DashboardOut {
  student: StudentOut; target_job?: JobOut | null; readiness?: ReadinessOut | null;
  top_gaps: SkillGapOut[]; roadmap_progress: Record<string, number>;
  next_action?: RoadmapItemOut | null; data_mode: 'live' | 'demo';
}

export interface ImportIssueOut {
  row_number: number; field?: string | null; issue_code: string; severity: 'error' | 'warning'; message: string;
}
export interface ImportJobOut {
  id: number; filename: string; source_type: string; status: ImportStatus;
  total_rows: number; valid_rows: number; imported_rows: number; duplicate_rows: number; error_rows: number;
  field_mapping: Record<string, string>; created_at: string; completed_at?: string | null;
}

export interface HealthOut {
  status: 'ok' | 'degraded'; version: string; database: string; serpapi_configured: boolean;
}

export interface JobSearchIn {
  role: string; location?: string; keywords?: string; level?: 'any' | 'entry_level' | 'internship';
  page?: number; next_page_token?: string | null;
}
export interface ObservedRequirement {
  name: string; requirement_type: 'required' | 'preferred' | 'mentioned'; expected_level: Level; excerpt: string;
}
export interface JobListingOut {
  stable_identity?: string | null;
  id: number; title: string; company: string | null; location: string | null;
  employment_type: string | null; experience_level: string | null; description: string;
  source_url: string | null; source_domain: string | null; retrieved_at: string;
  provenance: ResourceProvenance; active_status: 'not_verified'; skills: ObservedRequirement[];
  missing_fields: string[]; warnings: string[];
}
export interface JobSearchOut {
  search_id: string; scope: JobSearchIn; query: string; jobs: JobListingOut[]; retrieved_at: string;
  provenance: ResourceProvenance; cache_status: 'live' | 'fresh_cache' | 'stale_cache';
  next_page_token: string | null; warnings: string[];
}
export interface JobMatchOut {
  listing: JobListingOut; analysis: AnalysisOut; evidenced_skills: string[]; unknown_skills: string[]; explanation: string[];
}
export interface MarketSkillsOut {
  search_id: string; scope: JobSearchIn; sample_size: number; retrieved_at: string; provenance: ResourceProvenance;
  skills: { name: string; count: number; required_count: number; preferred_count: number; share: number }[];
  warnings: string[];
}

export interface MarketFilter { role?: string; location?: string; collected_after?: string; collected_before?: string }
export interface DemandSkillOut { name: string; distinct_job_count: number; demand_percentage: number | null; required_count: number; preferred_count: number; job_ids: number[] }
export interface MarketDemandOut {
  filters: MarketFilter; sample_size: number; collection_count: number;
  first_collected_at: string | null; last_collected_at: string | null;
  data_status: 'available' | 'insufficient' | 'empty'; skills: DemandSkillOut[]; jobs: JobListingOut[];
  warnings: string[]; formula: string;
}
export interface MarketScopeOut { roles: string[]; locations: string[]; collection_count: number }
export interface MarketCompareOut { roles: MarketDemandOut[]; rows: { name: string; percentages: Record<string, number | null> }[] }
export interface StudentDemandSkillOut extends DemandSkillOut {
  status: 'present' | 'missing' | 'unverified'; current_level: Level; competency_percentage: number | null;
  expected_level: Level; evidence_ids: number[]; action: 'learn' | 'assess' | 'maintain';
  priority_score: number; explanation: string; resources: ResourceLink[]; roadmap_items: RoadmapItemOut[];
}
export interface MarketMeOut {
  student_id: number; market: MarketDemandOut; skills: StudentDemandSkillOut[];
  evidenced_skill_count: number; observed_skill_count: number; coverage_percentage: number | null; coverage_definition: string;
}

export interface SourceClaimOut { source: string; kind: 'assessed_profile' | 'profile_evidence' | 'project_or_experience' | 'self_report'; excerpt: string; confirmed: boolean; claimed_level: Level }
export interface ResumeSuggestionOut { source: 'gemini'; factual_validation: 'equivalent_wording' | 'gemini_verified'; id: string; kind: 'replace'; original: string; proposed: string; reason: string; skill: string | null; requires_confirmation: boolean }
export interface GeminiRatingOut { value: number | null; reason: string; excerpts: string[] }
export interface GeminiScoresOut { overall: GeminiRatingOut; relevance: GeminiRatingOut; evidence: GeminiRatingOut; clarity: GeminiRatingOut; structure: GeminiRatingOut }
export interface GeminiFeedbackOut { summary: string; scores: GeminiScoresOut; strengths: { strength: string; excerpt: string }[]; gaps: string[]; improvements: string[]; rewrites: { original: string; proposed: string; reason: string }[]; questions: string[] }
export interface GeminiReviewOut { status: 'available' | 'not_requested' | 'unavailable' | 'quota_limit' | 'timeout' | 'blocked' | 'invalid_output' | 'error'; message: string; model: string | null; feedback: GeminiFeedbackOut | null; rejected_rewrites: number; rewrite_validation_status: 'not_needed' | 'available' | 'unavailable'; rewrite_message: string | null; validation_warnings: string[] }
export interface ResumeAnalysisOut {
  engine: 'gemini'; ai_review: GeminiReviewOut;
  target_title: string; target_source: 'serpapi_live' | 'user_provided'; source_url: string | null;
  suggestions: ResumeSuggestionOut[]; disclaimer: string;
}
export interface ExtractedFieldOut { value: string; source: string; excerpt: string; status: 'explicit' | 'uncertain'; confidence: number }
export interface CandidateExtractionOut { fields: Record<string, ExtractedFieldOut[]>; skills: { name: string; category: string | null; level: Level; sources: SourceClaimOut[] }[]; conflicts: string[]; missing_fields: string[]; analyzed_at: string | null; warnings: string[] }
export interface ResumeWorkspaceOut { extracted_profile: CandidateExtractionOut; id: number; filename: string; original_text: string; revised_text: string; target: { job_id?: number | null; title?: string; description?: string; source?: string }; analysis: ResumeAnalysisOut | null; decisions: Record<string, { decision: 'accepted' | 'rejected' | 'pending'; confirmation: string }>; version: number; created_at: string; updated_at: string }
export interface ResumeTargetIn { ai_consent?: boolean; version: number; job_id?: number; title?: string; description?: string }
export interface LinkedInIn { profile_url: string | null; profile_text: string; consent: boolean; confirmed: boolean; lookup_id?: string | null }
export type LinkedInTargetRole = 'Data Analyst' | 'Machine Learning Engineer' | 'Full Stack Developer' | 'Backend Developer' | 'Cloud / DevOps Engineer';
export interface ProfileRoleMatchOut { title: string; source: 'curated_role_template' | 'user_provided_job_description'; keyword_coverage: number | null; expected_skills: string[]; matched_skills: string[]; evidence_backed_skills: string[]; not_detected_skills: string[] }
export interface LinkedInAnalysisOut {
  engine: string; source: string; confirmed: boolean; data_scope: 'partial_public_search' | 'supplied_profile_text'; summary: string;
  profile_quality_score: number | null; quality_rubric: string; present_sections: string[]; missing_sections: string[];
  action_statement_count: number; quantified_statement_count: number;
  skills: { name: string; level: null; evidence_strength: 'mention_only' | 'project_context' | 'applied_example' | 'quantified_example'; excerpts: { section: string; excerpt: string; kind: string }[] }[];
  role_matches: ProfileRoleMatchOut[]; target: ProfileRoleMatchOut | null;
  improvements: { priority: 'high' | 'medium' | 'low'; title: string; reason: string; action: string; excerpt: string | null }[];
  headline_suggestion: string | null; wording_suggestions: { original: string; suggested: string; reason: string }[]; limitations: string[];
}
export interface LinkedInOut { extracted_profile: CandidateExtractionOut; analysis: LinkedInAnalysisOut; detected_skills: string[]; sections: Record<string, string[]>; profile_url: string | null; profile_text: string; import_method: string | null; confirmed: boolean; consent_at: string | null; updated_at: string | null; automatic_import_available: boolean; message: string }
export interface LinkedInAuthorizationOut { id: string; authorization_url: string; expires_at: string }
export interface LinkedInConnectionOut { id: string; status: 'pending' | 'exchanging' | 'connected' | 'failed'; name: string | null; message: string | null; source: 'linkedin_oidc' }
export interface LinkedInPublicSearchOut { id: string; profile_url: string; status: 'found' | 'not_found'; retrieved_at: string; provenance: 'serpapi_live' | 'demo_fixture'; cache_status: 'live' | 'cached'; sources: { title: string; url: string; snippet: string }[]; detected_skills: string[]; profile_text: string; warnings: string[] }
export interface RoadmapTaskIn { title: string; description?: string; priority?: Priority; due_date?: string | null; roadmap_milestone_id?: number | null; skill_id?: number | null }
export interface RoadmapTaskPatch extends Partial<RoadmapTaskIn> { version: number; status?: RoadmapStatus }
export interface RoadmapTaskOut { id: number; title: string; description: string; status: RoadmapStatus; priority: Priority; due_date: string | null; roadmap_milestone_id: number | null; skill_id: number | null; created_at: string; updated_at: string; completed_at: string | null; version: number }
export interface TaskListOut { tasks: RoadmapTaskOut[]; total: number; completed: number; remaining: number; completion_percentage: number | null; milestone_counts: Record<string, { total: number; completed: number }> }
