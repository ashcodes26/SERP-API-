/**
 * API contracts mirrored from backend/app/schemas.py.
 * Conventions: proficiency 0-5 where `null` means unknown (never zero); alignment/coverage/confidence are 0-1.
 */
export type Level = number | null;

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
export interface ResumeAdviceOut {
  supported_keywords: string[]; unsubstantiated_keywords: string[]; suggestions: string[]; limitations: string[];
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
export interface ResumeUploadOut { filename: string; extracted_character_count: number; advice: ResumeAdviceOut }

export interface SourceClaimOut { source: string; kind: 'assessed_profile' | 'profile_evidence' | 'project_or_experience' | 'self_report'; excerpt: string; confirmed: boolean; claimed_level: Level }
export interface UnifiedSkillOut { name: string; sources: SourceClaimOut[]; profile_level: Level; proficiency_assessed: boolean; conflict: boolean; requires_confirmation: boolean }
export interface ResumeSuggestionOut { id: string; kind: 'replace' | 'append' | 'review'; original: string; proposed: string; reason: string; skill: string | null; requires_confirmation: boolean }
export interface ResumeAnalysisOut {
  target_title: string; target_source: 'serpapi_live' | 'user_provided'; source_url: string | null;
  requirements: ObservedRequirement[]; resume_skills: string[]; matching_skills: string[]; not_detected_skills: string[]; stronger_evidence_skills: string[];
  unified_skills: UnifiedSkillOut[]; sections: Record<string, string[]>; profile_sections: Record<string, string[]>; relevant_excerpts: string[]; structure_feedback: string[];
  score: number | null; score_components: Record<string, number | null>; rubric_version: string; rubric: string;
  suggestions: ResumeSuggestionOut[]; career_recommendations: string[]; warnings: string[];
}
export interface ResumeStatisticsOut {
  strength_score: number; section_coverage: number; present_sections: string[]; missing_sections: string[];
  word_count: number; character_count: number; bullet_count: number; action_statement_count: number;
  quantified_statement_count: number; detected_skills: string[]; feedback: string[]; rubric_version: string; rubric: string;
}
export interface ResumeWorkspaceOut { original_statistics: ResumeStatisticsOut; revised_statistics: ResumeStatisticsOut; id: number; filename: string; original_text: string; revised_text: string; target: { job_id?: number | null; title?: string; description?: string; source?: string }; analysis: ResumeAnalysisOut | null; decisions: Record<string, { decision: 'accepted' | 'rejected' | 'pending'; confirmation: string }>; version: number; created_at: string; updated_at: string }
export interface ResumeTargetIn { version: number; job_id?: number; title?: string; description?: string }
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
export interface LinkedInOut { analysis: LinkedInAnalysisOut; detected_skills: string[]; sections: Record<string, string[]>; profile_url: string | null; profile_text: string; import_method: string | null; confirmed: boolean; consent_at: string | null; updated_at: string | null; automatic_import_available: boolean; message: string }
export interface LinkedInAuthorizationOut { id: string; authorization_url: string; expires_at: string }
export interface LinkedInConnectionOut { id: string; status: 'pending' | 'exchanging' | 'connected' | 'failed'; name: string | null; message: string | null; source: 'linkedin_oidc' }
export interface LinkedInPublicSearchOut { id: string; profile_url: string; status: 'found' | 'not_found'; retrieved_at: string; provenance: 'serpapi_live' | 'demo_fixture'; cache_status: 'live' | 'cached'; sources: { title: string; url: string; snippet: string }[]; detected_skills: string[]; profile_text: string; warnings: string[] }
export interface RoadmapTaskIn { title: string; description?: string; priority?: Priority; due_date?: string | null; roadmap_milestone_id?: number | null; skill_id?: number | null }
export interface RoadmapTaskPatch extends Partial<RoadmapTaskIn> { version: number; status?: RoadmapStatus }
export interface RoadmapTaskOut { id: number; title: string; description: string; status: RoadmapStatus; priority: Priority; due_date: string | null; roadmap_milestone_id: number | null; skill_id: number | null; created_at: string; updated_at: string; completed_at: string | null; version: number }
export interface TaskListOut { tasks: RoadmapTaskOut[]; total: number; completed: number; remaining: number; completion_percentage: number | null; milestone_counts: Record<string, { total: number; completed: number }> }
