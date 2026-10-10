import { API_BASE_URL, API_TIMEOUT_MS } from '@/config';
import type { ErrorBody, HealthOut, ProfileOut, JobOut, AnalysisOut, RoadmapItemOut, DashboardOut, AssessmentOut, AssessmentSubmitIn } from '@/types/contracts';

let sessionToken: string | null = null;
export const session = { setToken(token: string | null) { sessionToken = token; }, clear() { sessionToken = null; } };
export interface LoginResponse { access_token: string; token_type: string; expires_in: number; role: "admin" | "student"; student_id: number | null }

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
export async function request<T>(path: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...init.headers },
    });
    if (!res.ok) {
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
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('timeout', 'The server took too long to respond.', true);
    }
    throw new ApiError('network_error', `Cannot reach the AIMORA backend at ${API_BASE_URL}.`, true);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  login: (username: string, password: string) => request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  health: () => request<HealthOut>('/api/health', {}, 5000),
};

const jsonPost = <T>(path: string, payload: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(payload) });
export const careerApi = {
  seed: () => jsonPost<{ student_id: number; job_id: number; synthetic: boolean }>('/api/demo/seed', {}),
  profile: (id: number) => request<ProfileOut>(`/api/profile/${id}`),
  role: (id: number) => jsonPost<JobOut>('/api/job/analyze', { seeded_job_id: id }),
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
  async upload(asset: { uri: string; name: string; mimeType?: string }): Promise<ImportUpload> {
    const form = new FormData();
    form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? (asset.name.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') } as unknown as Blob);
    // No JSON Content-Type: fetch must add the multipart boundary itself.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_BASE_URL}/api/import/upload`, { method: 'POST', body: form, signal: controller.signal, headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {} });
      const data = await response.json();
      if (!response.ok) throw new ApiError(data.detail?.code ?? 'upload_failed', data.detail?.message ?? 'Upload failed', response.status >= 500, response.status);
      return data as ImportUpload;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new ApiError('upload_timeout', 'Upload timed out. Try a smaller file or check the connection.', true);
      throw new ApiError('upload_network_error', 'Could not upload to the AIMORA backend.', true);
    } finally { clearTimeout(timer); }
  },
  preview: (job_id: number, mapping: Record<string, string>) => jsonPost<ImportSummary>('/api/import/preview', { job_id, mapping }),
  confirm: (job_id: number, update_duplicates = false) => jsonPost<ImportSummary>('/api/import/confirm', { job_id, update_duplicates }),
  retry: (job_id: number) => request<ImportSummary>(`/api/import/${job_id}/retry`, { method: 'POST' }),
  status: (job_id: number) => request<ImportSummary>(`/api/import/${job_id}`),
};
