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
