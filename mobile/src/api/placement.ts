import { request } from './client';
import type * as C from '@/types/contracts';
const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
export function placementQuery(filter: C.PlacementFilter) {
  const query = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => { if (value !== '' && value !== undefined) query.set(key, String(value)); });
  return query.toString();
}
export const placementApi = {
  cohorts: () => request<C.CohortOut[]>('/api/admin/cohorts'),
  createCohort: (body: C.CohortIn) => post<C.CohortOut>('/api/admin/cohorts', body),
  dashboard: (filter: C.PlacementFilter) => request<C.PlacementDashboardOut>(`/api/admin/dashboard?${placementQuery(filter)}`),
  students: (filter: C.PlacementFilter, page = 1) => request<C.PlacementStudentsOut>(`/api/admin/students?${placementQuery(filter)}&page=${page}`),
  detail: (id: number) => request<C.PlacementDetailOut>(`/api/admin/students/${id}`),
  roles: () => request<C.JobOut[]>('/api/admin/roles'),
  gaps: (cohort: number, role: number) => request<C.BatchGapOut>(`/api/admin/skill-gaps?cohort_id=${cohort}&job_id=${role}`),
  report: (filter: C.PlacementFilter, role?: number) => request<ArrayBuffer>(`/api/admin/report?${placementQuery(filter)}${role ? `&job_id=${role}` : ''}`, {}, 30000, true),
  review: (id: number, body: C.ReviewDecisionIn) => post<C.FacultyReviewOut>(`/api/admin/resume-reviews/${id}`, body),
  faculty: () => request<C.AccountOut[]>('/api/placement/faculty'),
  reviews: () => request<C.FacultyReviewOut[]>('/api/placement/resume-reviews'),
  revisions: (id: number) => request<C.ResumeRevisionOut[]>(`/api/placement/resume-revisions/${id}`),
  share: (body: C.ReviewShareIn) => post<C.FacultyReviewOut>('/api/placement/resume-reviews', body),
  revoke: (id: number) => request<{ revoked: boolean }>(`/api/placement/resume-reviews/${id}`, { method: 'DELETE' }),
  drives: () => request<C.DriveOut[]>('/api/placement/drives'),
  adminDrives: () => request<C.DriveOut[]>('/api/admin/drives'),
  createDrive: (body: C.DriveIn) => post<C.DriveOut>('/api/admin/drives', body),
  editDrive: (id: number, body: C.DriveUpdateIn) => request<C.DriveOut>(`/api/admin/drives/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  apply: (id: number) => post<C.ApplicationOut>(`/api/placement/drives/${id}/apply`, {}),
  applications: () => request<C.ApplicationOut[]>('/api/placement/applications'),
  updateApplication: (id: number, body: C.ApplicationUpdateIn, admin = false) => request<C.ApplicationOut>(`/api/${admin ? 'admin' : 'placement'}/applications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  assign: (body: C.TrainingIn) => post<C.TrainingOut[]>('/api/admin/training', body),
  training: () => request<C.TrainingOut[]>('/api/placement/training'),
  progress: (id: number, body: C.TrainingProgressIn) => request<C.TrainingOut>(`/api/placement/training/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};
