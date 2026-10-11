import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { jobsApi, marketApi, session } from '@/api/client';
import { Action, Card, Disclosure, ui } from '@/components/career-ui';
import { InsightActions, InsightViews, SkillCoverage, type InsightMode } from '@/components/market-controls';
import MarketRadar from '@/components/market-radar';
import { design as d } from '@/constants/design';
import { buildMarketFilters, demandCsv } from '@/utils/market-data';
import type { MarketDemandOut, MarketCompareOut, MarketMeOut, MarketScopeOut, StudentDemandSkillOut } from '@/types/contracts';

const time = (value: string | null) => value ? new Date(value).toLocaleString() : 'No collection yet';
const percentage = (value: number | null) => value === null ? 'Unavailable' : `${value}%`;

export default function MarketScreen() {
  const [role, setRole] = useState(''); const [location, setLocation] = useState('');
  const [after, setAfter] = useState(''); const [before, setBefore] = useState('');
  const [roles, setRoles] = useState<string[]>([]); const [mode, setMode] = useState<InsightMode>('ranking');
  const [scopes, setScopes] = useState<MarketScopeOut>({ roles: [], locations: [], collection_count: 0 });
  const [sample, setSample] = useState<MarketDemandOut | null>(null);
  const [comparison, setComparison] = useState<MarketCompareOut | null>(null); const [personal, setPersonal] = useState<MarketMeOut | null>(null);
  const [busy, setBusy] = useState(true); const guard = useRef(true); const [error, setError] = useState('');
  const [retry, setRetry] = useState<(() => void) | null>(null); const [showJobs, setShowJobs] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([marketApi.scopes(), marketApi.demand({})]).then(([available, result]) => {
      if (active) { setScopes(available); setSample(result); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Insights could not be loaded.'); })
      .finally(() => { if (active) { guard.current = false; setBusy(false); } });
    return () => { active = false; };
  }, []);

  const filters = () => buildMarketFilters(role, location, after, before);
  async function perform(action: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError(''); setRetry(() => () => void perform(action));
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { guard.current = false; setBusy(false); }
  }
  function load(nextMode = mode, selectedRoles = roles) {
    setMode(nextMode);
    void perform(async () => {
      const query = filters();
      if (nextMode === 'roles') {
        if (selectedRoles.length < 2) { setComparison(null); return; }
        setComparison(await marketApi.compare(selectedRoles, { ...query, role: '' }));
      } else if (nextMode === 'student') {
        const result = await marketApi.me(query); setPersonal(result); setSample(result.market);
      } else setSample(await marketApi.demand(query));
      setScopes(await marketApi.scopes());
    });
  }
  function reset() { setRole(''); setLocation(''); setAfter(''); setBefore(''); setRoles([]); setMode('ranking'); void perform(async () => { setSample(await marketApi.demand({})); setScopes(await marketApi.scopes()); }); }
  function toggleRole(value: string) { const next = roles.includes(value) ? roles.filter(item => item !== value) : [...roles, value].slice(-3); setRoles(next); load('roles', next); }
  function collect() { void perform(async () => { const query = filters(); if (!query.role) throw new Error('Enter a target role to collect a sample.'); await jobsApi.search({ role: query.role, location: query.location }); setScopes(await marketApi.scopes()); setSample(await marketApi.demand(query)); setMode('ranking'); }); }
  function exportCsv() { if (Platform.OS !== 'web' || !sample) return; const url = URL.createObjectURL(new Blob([demandCsv(sample)], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'skillup-skill-demand.csv'; link.click(); URL.revokeObjectURL(url); }
  function open(url: string) { void perform(async () => { if (!/^https?:\/\//i.test(url) || !(await Linking.canOpenURL(url))) throw new Error('This source link cannot be opened.'); await Linking.openURL(url); }); }

  return <SafeAreaView edges={['bottom']} style={ui.screen}><ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Text style={ui.kicker}>INDUSTRY SKILL DEMAND</Text><Text style={ui.title}>Turn job signals into a focused next step.</Text><Text style={ui.body}>Use collected listings as a small, transparent sample. Switch views to rank demand, compare roles, or connect the sample to your recorded evidence.</Text>
    <Card><Text style={ui.heading}>Choose a sample</Text><Text style={ui.label}>Role</Text><TextInput accessibilityLabel="Insights target role" editable={!busy} maxLength={120} value={role} onChangeText={setRole} style={ui.input} placeholder="All collected roles" placeholderTextColor={d.muted} />
      <View style={ui.row}>{scopes.roles.map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: role === item, disabled: busy }} disabled={busy} key={item} onPress={() => setRole(item)} style={[ui.chip, role === item && ui.selected]}><Text style={ui.body}>{item}</Text></Pressable>)}</View>
      <Text style={ui.label}>Location</Text><TextInput accessibilityLabel="Insights location" editable={!busy} maxLength={120} value={location} onChangeText={setLocation} style={ui.input} placeholder="All locations" placeholderTextColor={d.muted} />
      <View style={ui.row}>{scopes.locations.map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: location === item, disabled: busy }} disabled={busy} key={item} onPress={() => setLocation(item)} style={[ui.chip, location === item && ui.selected]}><Text style={ui.body}>{item}</Text></Pressable>)}</View>
      <View style={ui.row}><TextInput accessibilityLabel="Collection start date" editable={!busy} maxLength={10} placeholder="From YYYY-MM-DD" placeholderTextColor={d.muted} value={after} onChangeText={setAfter} style={[ui.input, { flex: 1, minWidth: 180 }]} /><TextInput accessibilityLabel="Collection end date" editable={!busy} maxLength={10} placeholder="To YYYY-MM-DD" placeholderTextColor={d.muted} value={before} onChangeText={setBefore} style={[ui.input, { flex: 1, minWidth: 180 }]} /></View>
      <View style={ui.row}><Action disabled={busy} onPress={() => load()}>Apply filters</Action><Action secondary disabled={busy || !role.trim()} onPress={collect}>Collect live jobs</Action></View><Text style={ui.muted}>Filters use retained data. Collecting requests SerpApi only when the discovery cache is not fresh.</Text>
    </Card>
    <InsightViews value={mode} disabled={busy} onChange={value => load(value)} /><InsightActions mode={mode} setMode={value => load(value)} disabled={busy} reset={reset} reload={() => load()} exportCsv={Platform.OS === 'web' && mode !== 'roles' && sample ? exportCsv : undefined} />
    {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.muted}>Loading collected data…</Text></View>}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Action secondary disabled={busy} onPress={retry ?? (() => load())}>Retry request</Action></Card>}
    {mode === 'roles' && <RoleComparison roles={roles} scopes={scopes} comparison={comparison} busy={busy} toggleRole={toggleRole} />}
    {mode !== 'roles' && sample && <>
      <SampleSummary sample={sample} />
      {!sample.sample_size && <Card><Text style={ui.heading}>No data for these filters</Text><Text style={ui.body}>Choose a collected scope, reset the filters, or collect a new role sample.</Text></Card>}
      {mode === 'ranking' && <Ranking sample={sample} />}
      {mode === 'student' && personal && <><Card><SkillCoverage value={personal.coverage_percentage} present={personal.evidenced_skill_count} total={personal.observed_skill_count} /><MarketRadar skills={personal.skills} /></Card><PriorityList skills={personal.skills} busy={busy} open={open} /><Action secondary disabled={busy} onPress={() => router.push('/')}>Continue my learning journey →</Action></>}
      <JobSources jobs={sample.jobs} busy={busy} show={showJobs} onToggle={() => setShowJobs(value => !value)} open={open} />
    </>}
    {!session.getStudentId() && <Text style={ui.muted}>Personal comparisons require a student login; admin browsing does not substitute another student&apos;s data.</Text>}
  </ScrollView></SafeAreaView>;
}

function SampleSummary({ sample }: { sample: MarketDemandOut }) { return <Card><Text style={ui.kicker}>COLLECTED SAMPLE · {sample.data_status.toUpperCase()}</Text><Text style={ui.score}>{sample.sample_size}</Text><Text style={ui.body}>Distinct jobs across {sample.collection_count} retained search pages</Text><Text style={ui.muted}>{sample.filters.role || 'All roles'} · {sample.filters.location || 'All locations'} · Latest collection {time(sample.last_collected_at)}</Text>{sample.warnings.map(item => <Text style={ui.muted} key={item}>{item}</Text>)}</Card>; }
function Ranking({ sample }: { sample: MarketDemandOut }) { return <Card><Text style={ui.heading}>Skill demand ranking</Text><Text style={ui.muted}>Each skill is counted once per distinct job. Select a row for the supporting counts.</Text>{sample.skills.length ? sample.skills.map((skill, index) => <DemandRow key={skill.name} rank={index + 1} skill={skill} total={sample.sample_size} />) : <Text style={ui.body}>No dictionary-supported skill mentions are available.</Text>}</Card>; }
function DemandRow({ rank, skill, total }: { rank: number; skill: MarketDemandOut['skills'][number]; total: number }) { const [open, setOpen] = useState(false); return <Disclosure title={`${rank}. ${skill.name} · ${percentage(skill.demand_percentage)}`} summary={`${skill.distinct_job_count} of ${total} collected jobs`} open={open} onToggle={() => setOpen(value => !value)}><View accessibilityRole="progressbar" accessibilityLabel={`${skill.name} demand`} accessibilityValue={{ min: 0, max: 100, now: skill.demand_percentage ?? 0 }} style={{ height: 8, backgroundColor: d.border, borderRadius: 4 }}><View style={{ width: `${skill.demand_percentage ?? 0}%`, height: 8, backgroundColor: d.accent, borderRadius: 4 }} /></View><Text style={ui.muted}>Required: {skill.required_count} · Preferred: {skill.preferred_count} · Other mentions: {skill.distinct_job_count - skill.required_count - skill.preferred_count}</Text></Disclosure>; }
function PriorityList({ skills, busy, open }: { skills: StudentDemandSkillOut[]; busy: boolean; open: (url: string) => void }) { return <Card><Text style={ui.heading}>Evidence & learning priorities</Text><Text style={ui.muted}>Select a skill for the recommended resource and existing roadmap context.</Text>{skills.map(skill => <PriorityRow key={skill.name} skill={skill} busy={busy} open={open} />)}</Card>; }
function PriorityRow({ skill, busy, open }: { skill: StudentDemandSkillOut; busy: boolean; open: (url: string) => void }) { const [openRow, setOpenRow] = useState(false); return <Disclosure title={`${skill.name} · ${skill.action}`} summary={`Demand ${percentage(skill.demand_percentage)} · Evidence ${percentage(skill.competency_percentage)} · ${skill.status}`} open={openRow} onToggle={() => setOpenRow(value => !value)}><Text style={ui.body}>{skill.explanation}</Text><Text style={ui.muted}>Explicit target: {skill.expected_level === null ? 'Unknown' : `${skill.expected_level}/5`} · Priority score: {skill.priority_score}</Text>{skill.resources.map(resource => <Action secondary disabled={busy} key={resource.url} onPress={() => open(resource.url)}>{resource.title} ↗</Action>)}{skill.roadmap_items.map(item => <View key={item.id} style={ui.divider}><Text style={ui.label}>EXISTING ROADMAP</Text><Text style={ui.muted}>{item.task} · {item.status.replaceAll('_', ' ')}</Text></View>)}</Disclosure>; }
function JobSources({ jobs, busy, show, onToggle, open }: { jobs: MarketDemandOut['jobs']; busy: boolean; show: boolean; onToggle: () => void; open: (url: string) => void }) { return <Card><Action secondary disabled={busy} onPress={onToggle}>{show ? 'Hide' : 'Show'} relevant job sources ({jobs.length})</Action>{show && jobs.map(job => <View style={ui.divider} key={job.id}><Text style={ui.body}>{job.title}</Text><Text style={ui.muted}>{job.company || 'Company unknown'} · {job.location || 'Location unknown'}</Text>{job.source_url && <Action secondary disabled={busy} onPress={() => open(job.source_url!)}>Open original listing ↗</Action>}</View>)}</Card>; }
function RoleComparison({ roles, scopes, comparison, busy, toggleRole }: { roles: string[]; scopes: MarketScopeOut; comparison: MarketCompareOut | null; busy: boolean; toggleRole: (role: string) => void }) { return <Card><Text style={ui.heading}>Compare two or three roles</Text><Text style={ui.muted}>Select roles to compare demand within their individual collected samples.</Text><View style={ui.row}>{scopes.roles.map(role => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: roles.includes(role), disabled: busy }} disabled={busy} key={role} onPress={() => toggleRole(role)} style={[ui.chip, roles.includes(role) && ui.selected]}><Text style={ui.body}>{roles.includes(role) ? '✓ ' : ''}{role}</Text></Pressable>)}</View>{roles.length < 2 && <Text style={ui.body}>Select at least two roles.</Text>}{comparison?.rows.map(row => <View key={row.name} style={ui.divider}><Text style={ui.body}>{row.name}</Text>{Object.entries(row.percentages).map(([role, value]) => <Text style={ui.muted} key={role}>{role}: {percentage(value)}</Text>)}</View>)}</Card>; }
