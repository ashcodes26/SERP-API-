import { API_BASE_URL, API_TIMEOUT_MS } from '@/config';
import type { DocumentPickerAsset } from 'expo-document-picker';
import type { ResumeWorkspaceOut, ResumeTargetIn, LinkedInIn, LinkedInOut, LinkedInAnalysisOut, LinkedInTargetRole, RoadmapTaskIn, RoadmapTaskPatch, RoadmapTaskOut, TaskListOut, MarketFilter, MarketDemandOut, MarketMeOut, MarketCompareOut, MarketScopeOut, ErrorBody, HealthOut, ProfileOut, JobOut, AnalysisOut, RoadmapItemOut, DashboardOut, AssessmentOut, AssessmentSubmitIn, JobSearchIn, JobSearchOut, JobListingOut, JobMatchOut, MarketSkillsOut, RoadmapStatus } from '@/types/contracts';

let sessionToken: string | null = null;
let sessionStudentId: number | null = null;
let selectedTarget: AnalysisOut | null = null;
let onUnauthorized: (() => void) | null = null;
export const session = {
  onUnauthorized(handler: (() => void) | null) { onUnauthorized = handler; },
  setToken(token: string | null) { sessionToken = token; },
  setStudentId(id: number | null) { sessionStudentId = id; },
  getStudentId() { return sessionStudentId; },
  setTarget(analysis: AnalysisOut) { selectedTarget = analysis; },
  takeTarget() { const target = selectedTarget; selectedTarget = null; return target; },
  clear() { sessionToken = null; sessionStudentId = null; selectedTarget = null; },
};
export type LoginResponse = import('@/types/contracts').AuthSessionOut;

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Typed JSON request with timeout; maps network, timeout and structured backend errors to ApiError. */
export async function request<T>(path: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS, binary = false): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...init.headers },
    });
    if (!res.ok) {
      if (res.status === 401 && sessionToken) onUnauthorized?.();
      let body: Partial<ErrorBody> | undefined;
      try {
        const json = await res.json();
        body = (json?.detail && typeof json.detail === 'object' ? json.detail : json) as Partial<ErrorBody>;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(
        body?.code ?? `http_${res.status}`,
        body?.message ?? `Request failed (${res.status})`,
        body?.retryable ?? res.status >= 500,
        res.status,
      );
    }
    return (binary ? await res.arrayBuffer() : await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('timeout', 'The server took too long to respond.', true);
    }
    throw new ApiError('network_error', `Cannot reach the Skillup backend at ${API_BASE_URL}.`, true);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  me: () => request<import('@/types/contracts').AccountOut>('/api/auth/me'),
  signup: (body: import('@/types/contracts').SignupIn) => request<LoginResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ signed_out: boolean }>('/api/auth/logout', { method: 'POST' }),
  demoSession: () => request<LoginResponse>('/api/auth/demo-session', { method: 'POST' }),
  login: (username: string, password: string) => request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  health: () => request<HealthOut>('/api/health', {}, 5000),
};

const jsonPost = <T>(path: string, payload: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(payload) });
export function fileForm(asset: DocumentPickerAsset, fields: Record<string, string>) {
  const form = new FormData();
  Object.entries(fields).forEach(([name, value]) => form.append(name, value));
  if (asset.file) form.append('file', asset.file, asset.name);
  else form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : asset.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain') } as unknown as Blob);
  return form;
}
export const resumeApi = {
  candidate: (id: number) => request<import('@/types/contracts').CandidateExtractionOut>(`/api/resumes/${id}/candidate-profile`),
  list: () => request<ResumeWorkspaceOut[]>('/api/resumes'),
  get: (id: number) => request<ResumeWorkspaceOut>(`/api/resumes/${id}`),
  create: (text: string, storage_consent: boolean) => jsonPost<ResumeWorkspaceOut>('/api/resumes', { text, storage_consent }),
  upload: (asset: DocumentPickerAsset, consent: boolean) => request<ResumeWorkspaceOut>('/api/resumes/upload', { method: 'POST', body: fileForm(asset, { storage_consent: String(consent) }) }),
  analyze: (id: number, body: ResumeTargetIn) => request<ResumeWorkspaceOut>(`/api/resumes/${id}/analyze`, { method: 'POST', body: JSON.stringify(body) }, 75000),
  decide: (id: number, suggestion: string, version: number, decision: 'accepted' | 'rejected' | 'pending', confirmation: string) => request<ResumeWorkspaceOut>(`/api/resumes/${id}/suggestions/${suggestion}`, { method: 'PATCH', body: JSON.stringify({ version, decision, confirmation }) }),
  apply: (id: number, version: number) => jsonPost<ResumeWorkspaceOut>(`/api/resumes/${id}/apply`, { version }),
  save: (id: number, version: number, text: string, factual_confirmation: boolean) => request<ResumeWorkspaceOut>(`/api/resumes/${id}/revision`, { method: 'PUT', body: JSON.stringify({ version, text, factual_confirmation }) }),
  restore: (id: number, version: number) => jsonPost<ResumeWorkspaceOut>(`/api/resumes/${id}/restore`, { version }),
  remove: (id: number, version: number) => request<{ deleted: boolean }>(`/api/resumes/${id}?version=${version}`, { method: 'DELETE' }),
  export: (id: number, version: number, format: 'docx' | 'txt', final_review_confirmed: boolean) => request<ArrayBuffer>(`/api/resumes/${id}/export`, { method: 'POST', body: JSON.stringify({ version, format, final_review_confirmed }) }, API_TIMEOUT_MS, true),
};
export const linkedinApi = {
  analyze: (target_role: LinkedInTargetRole, job_description: string) => request<LinkedInAnalysisOut>('/api/profile/linkedin/analyze', { method: 'POST', body: JSON.stringify({ target_role, job_description }) }),
  publicSearch: (profile_url: string, consent: boolean) => request<import('@/types/contracts').LinkedInPublicSearchOut>('/api/profile/linkedin/public-search', { method: 'POST', body: JSON.stringify({ profile_url, consent }) }, 60000),
  latestPublicSearch: () => request<import('@/types/contracts').LinkedInPublicSearchOut | null>('/api/profile/linkedin/public-search'),
  get: () => request<LinkedInOut>('/api/profile/linkedin'),
  save: (body: LinkedInIn) => request<LinkedInOut>('/api/profile/linkedin', { method: 'PUT', body: JSON.stringify(body) }),
  upload: (asset: DocumentPickerAsset, body: LinkedInIn) => request<LinkedInOut>('/api/profile/linkedin/upload', { method: 'POST', body: fileForm(asset, { consent: String(body.consent), confirmed: String(body.confirmed), ...(body.profile_url ? { profile_url: body.profile_url } : {}) }) }),
  automatic: (body: LinkedInIn) => jsonPost<import('@/types/contracts').LinkedInAuthorizationOut>('/api/profile/linkedin/automatic', body),
  connection: (id: string) => request<import('@/types/contracts').LinkedInConnectionOut>(`/api/profile/linkedin/connection/${encodeURIComponent(id)}`),
  latestConnection: () => request<import('@/types/contracts').LinkedInConnectionOut | null>('/api/profile/linkedin/connection'),
  cancel: (id: string) => request<{ deleted: boolean }>(`/api/profile/linkedin/connection/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  remove: () => request<{ deleted: boolean; message: string }>('/api/profile/linkedin', { method: 'DELETE' }),
};
export type TaskView = 'all' | 'today' | 'upcoming' | 'completed';
export type TaskSort = 'due_date' | 'priority' | 'updated' | 'title';
export const tasksApi = {
  skills: () => request<import('@/types/contracts').SkillOut[]>('/api/roadmap/skills'),
  milestone: (id: number) => request<RoadmapItemOut>(`/api/roadmap/milestones/${id}`),
  list: (view: TaskView = 'all', sort: TaskSort = 'due_date') => request<TaskListOut>(`/api/roadmap/tasks?view=${view}&sort=${sort}`),
  create: (body: RoadmapTaskIn) => jsonPost<RoadmapTaskOut>('/api/roadmap/tasks', body),
  update: (id: number, body: RoadmapTaskPatch) => request<RoadmapTaskOut>(`/api/roadmap/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: number, version: number) => request<{ deleted: boolean }>(`/api/roadmap/tasks/${id}?version=${version}`, { method: 'DELETE' }),
};
export const jobsApi = {
  search: (query: JobSearchIn) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => { if (value !== null && value !== undefined && value !== '') params.set(key, String(value)); });
    return request<JobSearchOut>(`/api/jobs/search?${params.toString()}`, {}, 60000);
  },
  detail: (id: number) => request<JobListingOut>(`/api/jobs/${id}`),
  match: (id: number, student_id: number) => jsonPost<JobMatchOut>(`/api/jobs/${id}/match`, { student_id }),
  market: (search_id: string) => request<MarketSkillsOut>(`/api/market/skills?search_id=${search_id}`),
  roadmap: (student_id: number, analysis_id: number) => request<RoadmapItemOut[]>(`/api/roadmap/${student_id}/analysis/${analysis_id}`, {}, 120000),
  aiRoadmap: (student_id: number, analysis_id: number, description: string, consent: boolean) => jsonPost<import('@/types/contracts').RoadmapAiOut>(`/api/roadmap/${student_id}/analysis/${analysis_id}/ai`, { description, consent }),
  progress: (item_id: number, status: RoadmapStatus, completion_evidence?: string) => request<RoadmapItemOut>(`/api/roadmap/items/${item_id}`, { method: 'PATCH', body: JSON.stringify({ status, completion_evidence }) }),
};

const marketQuery = (filters: MarketFilter) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  return query;
};
export const marketApi = {
  scopes: () => request<MarketScopeOut>('/api/market/scopes'),
  demand: (filters: MarketFilter) => request<MarketDemandOut>(`/api/market/skills?${marketQuery(filters)}`),
  me: (filters: MarketFilter) => request<MarketMeOut>(`/api/market/skills/me?${marketQuery(filters)}`),
  compare: (roles: string[], filters: MarketFilter) => {
    const query = marketQuery(filters); query.set('roles', roles.join(','));
    return request<MarketCompareOut>(`/api/market/skills/compare?${query}`);
  },
};
export const careerApi = {
  journey: () => request<{ student_id: number; job_id: number; synthetic: boolean }>('/api/placement/journey'),
  previewInput: (asset: DocumentPickerAsset) => request<import('@/types/contracts').JourneyPreviewOut>('/api/journey/input/preview', { method: 'POST', body: fileForm(asset, {}) }),
  saveInput: (body: import('@/types/contracts').JourneySaveIn) => jsonPost<ProfileOut>('/api/journey/input/save', body),
  seed: () => jsonPost<{ student_id: number; job_id: number; synthetic: boolean }>('/api/demo/seed', {}),
  profile: (id: number) => request<ProfileOut>(`/api/profile/${id}`),
  role: (id: number) => jsonPost<JobOut>('/api/job/analyze', { seeded_job_id: id }),
  customRole: (title: string, description: string) => jsonPost<JobOut>('/api/job/analyze', { title, description }),
  analyze: (student_id: number, job_id: number) => jsonPost<AnalysisOut>('/api/skill-gap/analyze', { student_id, job_id }),
  roadmap: (id: number) => request<RoadmapItemOut[]>(`/api/roadmap/${id}`, {}, 30000),
  questions: (id: number) => request<QuestionSet>(`/api/assessment/questions/${id}`),
  submit: (data: AssessmentSubmitIn) => jsonPost<AssessmentOut>('/api/assessment/submit', data),
  dashboard: (id: number) => request<DashboardOut>(`/api/dashboard/${id}`),
};
export interface Question { id: string; prompt: string; options: string[] }
export interface QuestionSet { skill_id: number; skill: string; question_set_version: string; questions: Question[] }

export interface ImportIssue { row_number: number; field: string | null; issue_code: string; severity: string; message: string }
export interface ImportSummary { job: { id: number; filename: string; status: string; total_rows: number; valid_rows: number; error_rows: number; duplicate_rows: number; imported_rows: number; field_mapping: Record<string, string> }; issues: ImportIssue[] }
export interface ImportUpload { job_id: number; headers: string[]; suggested_mapping: Record<string, string>; total_rows: number }
export const importApi = {
  async upload(asset: DocumentPickerAsset, cohortId: number): Promise<ImportUpload> {
    const form = fileForm(asset, {});
    // No JSON Content-Type: fetch must add the multipart boundary itself.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE_URL}/api/import/upload?cohort_id=${cohortId}`, { method: 'POST', body: form, signal: controller.signal, headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new ApiError(data.detail?.code ?? 'upload_failed', data.detail?.message ?? 'Upload failed', response.status >= 500, response.status);
      return data as ImportUpload;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new ApiError('upload_timeout', 'Upload timed out. Try a smaller file or check the connection.', true);
      throw new ApiError('upload_network_error', 'Could not upload to the Skillup backend.', true);
    } finally { clearTimeout(timer); }
  },
  preview: (job_id: number, mapping: Record<string, string>) => jsonPost<ImportSummary>('/api/import/preview', { job_id, mapping }),
  confirm: (job_id: number, update_duplicates = false) => jsonPost<ImportSummary>('/api/import/confirm', { job_id, update_duplicates }),
  retry: (job_id: number) => request<ImportSummary>(`/api/import/${job_id}/retry`, { method: 'POST' }),
  status: (job_id: number) => request<ImportSummary>(`/api/import/${job_id}`),
};
