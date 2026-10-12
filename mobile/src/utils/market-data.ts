import type { DemandSkillOut, MarketDemandOut, MarketFilter, StudentDemandSkillOut } from '@/types/contracts';

export function filterDemandSkills(skills: DemandSkillOut[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return skills.map((skill, index) => ({ skill, rank: index + 1 }))
    .filter(({ skill }) => skill.name.toLocaleLowerCase().includes(normalized));
}

export function radarData(skills: StudentDemandSkillOut[]) {
  return skills.filter(s => s.competency_percentage !== null && s.demand_percentage !== null)
    .sort((a, b) => (b.demand_percentage ?? 0) - (a.demand_percentage ?? 0)).slice(0, 6)
    .map(s => ({ subject: s.name, student: s.competency_percentage, demand: s.demand_percentage }));
}
export function buildMarketFilters(role: string, location: string, after: string, before: string): MarketFilter {
  const dates: MarketFilter = {};
  for (const [input, key] of [[after, 'collected_after'], [before, 'collected_before']] as const) {
    const value = input.trim();
    if (!value) continue;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Collection dates must use valid YYYY-MM-DD dates.');
    dates[key] = `${value}T${key === 'collected_before' ? '23:59:59.999' : '00:00:00'}Z`;
  }
  if (dates.collected_after && dates.collected_before && dates.collected_after > dates.collected_before) throw new Error('Collection start must precede collection end.');
  return { role: role.trim(), location: location.trim(), ...dates };
}
export function demandCsv(sample: MarketDemandOut): string {
  const cell = (value: unknown) => { const text = String(value ?? ''); return `"${text.replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`; };
  const rows = [['skill', 'distinct_jobs', 'demand_percentage', 'sample_jobs', 'search_role', 'search_location', 'last_collected_at'],
    ...sample.skills.map(s => [s.name, s.distinct_job_count, s.demand_percentage, sample.sample_size, sample.filters.role, sample.filters.location, sample.last_collected_at])];
  return rows.map(r => r.map(cell).join(',')).join('\r\n');
}
