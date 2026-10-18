import type { CohortOut, PlacementFilter } from '@/types/contracts';

/** Human-readable context only; API filtering and faculty authorization remain server-owned. */
export function facultyScopeSummary(filter: PlacementFilter, cohorts: CohortOut[]) {
  const cohort = filter.cohort_id ? cohorts.find(item => item.id === filter.cohort_id) : undefined;
  const parts = [cohort ? `Cohort: ${cohort.name}` : 'All assigned students'];
  if (filter.q?.trim()) parts.push(`Search: ${filter.q.trim()}`);
  for (const key of ['department', 'batch', 'section', 'progress'] as const) if (filter[key]) parts.push(`${key.replace('_', ' ')}: ${filter[key]}`);
  return parts.join(' · ');
}
