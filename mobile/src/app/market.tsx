import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { jobsApi, marketApi, session } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import { InsightActions, InsightViews, SkillCoverage, type InsightMode } from '@/components/market-controls';
import MarketRadar from '@/components/market-radar';
import { design as d } from '@/constants/design';
import { buildMarketFilters, demandCsv } from '@/utils/market-data';
import type { MarketFilter, MarketDemandOut, MarketCompareOut, MarketMeOut, MarketScopeOut } from '@/types/contracts';

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
  function load(nextMode = mode, selectedRoles = roles, explicit?: MarketFilter) {
    setMode(nextMode);
    void perform(async () => {
      const query = explicit ?? filters();
      if (nextMode === 'roles') {
        if (selectedRoles.length < 2) { setComparison(null); return; }
        setComparison(await marketApi.compare(selectedRoles, { ...query, role: '' }));
      } else if (nextMode === 'student') {
        const result = await marketApi.me(query); setPersonal(result); setSample(result.market);
      } else setSample(await marketApi.demand(query));
      setScopes(await marketApi.scopes());
    });
  }
  function reset() { setRole(''); setLocation(''); setAfter(''); setBefore(''); setRoles([]); load('ranking', [], {}); }
  function toggleRole(value: string) {
    const next = roles.includes(value) ? roles.filter(r => r !== value) : [...roles, value].slice(-3);
    setRoles(next); load('roles', next);
  }
  function collect() {
    void perform(async () => {
      const query = filters();
      if (!query.role) throw new Error('Enter a target role to collect a sample.');
      await jobsApi.search({ role: query.role, location: query.location });
      setScopes(await marketApi.scopes()); setSample(await marketApi.demand(query)); setMode('ranking');
    });
  }
  function exportCsv() {
    if (Platform.OS !== 'web' || !sample) return;
    const url = URL.createObjectURL(new Blob([demandCsv(sample)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'skillup-skill-demand.csv'; link.click(); URL.revokeObjectURL(url);
  }
  function open(url: string) { void perform(async () => { if (!/^https?:\/\//i.test(url) || !(await Linking.canOpenURL(url))) throw new Error('This source link cannot be opened.'); await Linking.openURL(url); }); }
  return <SafeAreaView edges={['bottom']} style={ui.screen}><ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Text style={ui.kicker}>Skillup / INDUSTRY SKILL DEMAND</Text><Text style={ui.title}>See the sample. Choose your next skill.</Text><Text style={ui.body}>Explore skills mentioned in collected jobs. Compare roles and your recorded evidence without treating the sample as the whole market.</Text>
    <Card><Text style={ui.heading}>Filter collected search scopes</Text><Text style={ui.label}>Target role (blank = all collected roles)</Text><TextInput accessibilityLabel="Insights target role" editable={!busy} maxLength={120} value={role} onChangeText={setRole} style={ui.input} />
      <View style={ui.row}>{scopes.roles.map(r => <Pressable accessibilityRole="button" accessibilityState={{ selected: role === r, disabled: busy }} disabled={busy} key={r} onPress={() => setRole(r)} style={[ui.chip, role === r && ui.selected]}><Text style={ui.body}>{r}</Text></Pressable>)}</View>
      <Text style={ui.label}>Location scope (blank = all)</Text><TextInput accessibilityLabel="Insights location" editable={!busy} maxLength={120} value={location} onChangeText={setLocation} style={ui.input} />
      <View style={ui.row}>{scopes.locations.map(l => <Pressable accessibilityRole="button" accessibilityState={{ selected: location === l, disabled: busy }} disabled={busy} key={l} onPress={() => setLocation(l)} style={[ui.chip, location === l && ui.selected]}><Text style={ui.body}>{l}</Text></Pressable>)}</View>
      <Text style={ui.label}>Collected from / through (UTC dates; optional)</Text><View style={ui.row}><TextInput accessibilityLabel="Collection start date YYYY-MM-DD" editable={!busy} maxLength={10} placeholder="YYYY-MM-DD" placeholderTextColor={d.muted} value={after} onChangeText={setAfter} style={[ui.input, { flex: 1, minWidth: 180 }]} /><TextInput accessibilityLabel="Collection end date YYYY-MM-DD" editable={!busy} maxLength={10} placeholder="YYYY-MM-DD" placeholderTextColor={d.muted} value={before} onChangeText={setBefore} style={[ui.input, { flex: 1, minWidth: 180 }]} /></View>
      <Action disabled={busy} onPress={() => load()}>Apply filters</Action><Action secondary disabled={busy || !role.trim()} onPress={collect}>Collect jobs for this role & location</Action><Text style={ui.muted}>Applying filters and switching views use stored data. Collecting a sample requests SerpApi only when the discovery cache is not fresh. Dates filter collection time, not posting dates.</Text>
    </Card>
    <InsightViews value={mode} disabled={busy} onChange={value => load(value)} /><InsightActions mode={mode} setMode={value => load(value)} disabled={busy} reset={reset} reload={() => load()} exportCsv={Platform.OS === 'web' && mode !== 'roles' && sample ? exportCsv : undefined} />
    {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.muted}>Loading actual collected data…</Text></View>}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Action secondary disabled={busy} onPress={retry ?? (() => load())}>Retry request</Action></Card>}
    {mode === 'roles' ? <Card><Text style={ui.heading}>Compare two or three collected roles</Text><View style={ui.row}>{scopes.roles.map(r => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: roles.includes(r), disabled: busy }} disabled={busy} key={r} onPress={() => toggleRole(r)} style={[ui.chip, roles.includes(r) && ui.selected]}><Text style={ui.body}>{roles.includes(r) ? '✓ ' : ''}{r}</Text></Pressable>)}</View>
      {roles.length < 2 && <Text style={ui.body}>Select at least two roles. Collect another role sample if needed.</Text>}
      {comparison && <>{comparison.roles.map(r => <Text style={ui.muted} key={r.filters.role}>{r.filters.role}: {r.sample_size} distinct jobs / {r.filters.location || 'All location scopes'} / {time(r.last_collected_at)} / {r.data_status}</Text>)}<Text style={ui.muted}>0% means no recognized mention in a nonempty sample. Unavailable means no sample; it is not zero demand. Collection scopes can overlap.</Text>
        {comparison.rows.length ? comparison.rows.map(row => <View key={row.name} style={ui.divider}><Text style={ui.body}>{row.name}</Text>{Object.entries(row.percentages).map(([r, value]) => <Text style={ui.muted} key={r}>{r}: {percentage(value)}</Text>)}</View>) : <Text style={ui.body}>No recognized skills in the selected samples.</Text>}
        {comparison.roles.flatMap(r => r.warnings).filter((w, i, all) => all.indexOf(w) === i).map(w => <Text style={ui.muted} key={w}>{w}</Text>)}</>}
    </Card> : sample && <>
      <Card><Text style={ui.kicker}>COLLECTED DATA / {sample.data_status.toUpperCase()}</Text><Text style={ui.score}>{sample.sample_size}</Text><Text style={ui.body}>Distinct jobs analyzed across {sample.collection_count} retained search pages</Text><Text style={ui.muted}>Active role: {sample.filters.role || 'All collected roles'} / Location: {sample.filters.location || 'All scopes'}</Text><Text style={ui.muted}>Collection window: {sample.filters.collected_after || 'Any start'} → {sample.filters.collected_before || 'Any end'}</Text><Text style={ui.muted}>First: {time(sample.first_collected_at)} / Latest: {time(sample.last_collected_at)}</Text>{sample.warnings.map(w => <Text style={ui.muted} key={w}>{w}</Text>)}</Card>
      {!sample.sample_size && <Card><Text style={ui.heading}>No data for these filters</Text><Text style={ui.body}>Choose a collected scope, reset the filters, or collect a new role sample. No data is unavailable demand, not 0%.</Text></Card>}
      {mode === 'ranking' && <Card><Text style={ui.heading}>Skill demand ranking</Text><Text style={ui.muted}>Formula: {sample.formula}. Each skill is counted once per distinct job.</Text>{sample.skills.length ? sample.skills.map((s, index) => <View style={ui.divider} key={s.name}><Text style={ui.body}>{index + 1}. {s.name} / {s.distinct_job_count} of {sample.sample_size} jobs / {percentage(s.demand_percentage)}</Text><View accessibilityRole="progressbar" accessibilityLabel={`${s.name} demand in collected sample`} accessibilityValue={{ min: 0, max: 100, now: s.demand_percentage ?? 0 }} style={{ height: 6, backgroundColor: d.border, borderRadius: 3 }}><View style={{ width: `${s.demand_percentage ?? 0}%`, height: 6, backgroundColor: d.accent, borderRadius: 3 }} /></View><Text style={ui.muted}>Required: {s.required_count} / Preferred: {s.preferred_count} / Other mentions: {s.distinct_job_count - s.required_count - s.preferred_count}</Text><Text style={ui.muted}>Listing IDs: {s.job_ids.join(', ')}</Text></View>) : <Text style={ui.body}>No dictionary-supported skill mentions are available.</Text>}</Card>}
      {mode === 'student' && personal && <><Card><SkillCoverage value={personal.coverage_percentage} present={personal.evidenced_skill_count} total={personal.observed_skill_count} /><MarketRadar skills={personal.skills} /><Text style={ui.muted}>Present = evidence with known level above zero. Missing = recorded level zero with evidence. Unverified = absent, unknown, or unsupported proficiency; this does not mean you lack the skill.</Text></Card>
        <Card><Text style={ui.heading}>Your evidence & learning priorities</Text><Text style={ui.muted}>Priority = sample demand fraction × (1 + 0.5 × required-mention fraction) × action weight: learn 2, assess 1.5, maintain 0.25. Ordering is informational.</Text>{personal.skills.map(s => <View style={ui.divider} key={s.name}><Text style={ui.heading}>{s.name} / {s.status}</Text><Text style={ui.body}>Sample demand: {percentage(s.demand_percentage)} / Evidenced proficiency: {percentage(s.competency_percentage)} / Explicit target: {s.expected_level === null ? 'Unknown' : `${s.expected_level}/5`}</Text><Text style={ui.body}>{s.action.toUpperCase()}: {s.explanation}</Text><Text style={ui.muted}>Priority score: {s.priority_score} / Listing IDs: {s.job_ids.join(', ')}</Text>{s.resources.map(r => <Action secondary disabled={busy} key={r.url} onPress={() => open(r.url)}>{r.title} ↗ ({r.provenance.replaceAll('_', ' ')})</Action>)}{s.roadmap_items.map(t => <Text style={ui.muted} key={t.id}>Existing roadmap: {t.task} / {t.status.replaceAll('_', ' ')}</Text>)}</View>)}<Action secondary disabled={busy} onPress={() => router.push('/')}>Continue my learning journey →</Action></Card></>}
      <Card><Action secondary disabled={busy} onPress={() => setShowJobs(value => !value)}>{showJobs ? 'Hide' : 'Show'} relevant job sources ({sample.jobs.length})</Action>{showJobs && sample.jobs.map(j => <View style={ui.divider} key={j.id}><Text style={ui.body}>#{j.id} {j.title}</Text><Text style={ui.muted}>{j.company || 'Company unknown'} / {j.location || 'Location unknown'} / {j.source_domain || 'Source unavailable'} / {j.provenance} / not verified active</Text>{j.source_url && <Action secondary disabled={busy} onPress={() => open(j.source_url!)}>Open original listing ↗</Action>}</View>)}</Card>
    </>}
    {!session.getStudentId() && <Text style={ui.muted}>Personal comparisons require a student login; admin browsing does not substitute another student’s data.</Text>}
  </ScrollView></SafeAreaView>;
}
