import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { jobsApi, marketApi, session } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import { InsightViews, SkillCoverage, type InsightMode } from '@/components/market-controls';
import MarketRadar from '@/components/market-radar';
import DemandRanking from '@/components/demand-ranking';
import { BarChart, StatStrip } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { OpportunitiesHeader } from '@/components/opportunities-header';
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
  const [retry, setRetry] = useState<(() => void) | null>(null); const [showJobs, setShowJobs] = useState(false); const [advanced, setAdvanced] = useState(false);
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
    <OpportunitiesHeader title="Skill-Demand Insights" description="Explore skills observed in collected job listings and relate them to your saved evidence without treating the sample as complete market coverage." />
    <Card><Text style={ui.kicker}>COLLECTED LISTING DATA</Text><Text style={ui.heading}>Choose a sample to explore</Text><Text style={ui.muted}>Rankings use stored job-listing text and dictionary-supported skill terms. They are useful signals, not a complete labor-market census.</Text><Text style={ui.label}>Target role</Text><TextInput accessibilityLabel="Insights target role" editable={!busy} maxLength={120} value={role} onChangeText={setRole} onSubmitEditing={collect} placeholder="Role or all collected roles" placeholderTextColor={d.muted} style={ui.input} />

      <Text style={ui.label}>Location (optional)</Text><TextInput accessibilityLabel="Insights location" editable={!busy} maxLength={120} value={location} onChangeText={setLocation} placeholder="All locations" placeholderTextColor={d.muted} style={ui.input} />

      <Action disabled={busy} onPress={() => role.trim() ? collect() : load()}>Analyze Demand</Action>
      {!!scopes.roles.length && <View style={ui.row}>{scopes.roles.slice(0, 6).map(value => <Action key={value} secondary disabled={busy} onPress={() => { setRole(value); void perform(async () => { setSample(await marketApi.demand({ ...filters(), role: value })); setMode("ranking"); }); }}>{value}</Action>)}</View>}
      <Action secondary disabled={busy} onPress={() => setAdvanced(value => !value)}>{advanced ? 'Hide options' : 'More options'}</Action>
      {advanced && <View style={ui.divider}>
        <Text style={ui.muted}>Collected roles: {scopes.roles.join(', ') || 'None yet'}. Leave the role blank to see all stored jobs.</Text>
        <Text style={ui.label}>Collection dates (optional, YYYY-MM-DD)</Text><View style={ui.row}><TextInput accessibilityLabel="Collection start date YYYY-MM-DD" editable={!busy} maxLength={10} placeholder="Start date" placeholderTextColor={d.muted} value={after} onChangeText={setAfter} style={[ui.input, { flex: 1, minWidth: 180 }]} /><TextInput accessibilityLabel="Collection end date YYYY-MM-DD" editable={!busy} maxLength={10} placeholder="End date" placeholderTextColor={d.muted} value={before} onChangeText={setBefore} style={[ui.input, { flex: 1, minWidth: 180 }]} /></View>
        <View style={ui.row}><Action secondary disabled={busy || !role.trim()} onPress={collect}>Collect fresh jobs</Action><Action secondary disabled={busy} onPress={reset}>Reset filters</Action>{Platform.OS === 'web' && mode !== 'roles' && sample && <Action secondary disabled={busy} onPress={exportCsv}>Download CSV</Action>}</View>
        <Text style={ui.muted}>Collected sample · dates reflect collection time</Text>
      </View>}
    </Card>
    <InsightViews value={mode} disabled={busy} onChange={value => load(value)} />
    {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.muted}>Loading actual collected data…</Text></View>}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Action secondary disabled={busy} onPress={retry ?? (() => load())}>Retry</Action></Card>}
    {mode === 'roles' ? <Card><Text style={ui.kicker}>ROLE COMPARISON</Text><Text style={ui.heading}>Compare collected role samples</Text><Text style={ui.muted}>Choose two or three roles. Percentages show mentions in each selected sample, not universal role requirements.</Text><View style={ui.row}>{scopes.roles.map(r => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: roles.includes(r), disabled: busy }} disabled={busy} key={r} onPress={() => toggleRole(r)} style={[ui.chip, roles.includes(r) && ui.selected]}><Text style={ui.body}>{roles.includes(r) ? '✓ ' : ''}{r}</Text></Pressable>)}</View>
      {roles.length < 2 && <Text style={ui.body}>Select 2–3 collected roles to compare.</Text>}
      {comparison && <>{comparison.roles.map(r => <Text style={ui.muted} key={r.filters.role}>{r.filters.role}: {r.sample_size} distinct jobs / {r.filters.location || 'All location scopes'} / {time(r.last_collected_at)} / {r.data_status}</Text>)}<Text style={ui.muted}>0% = no mentions · unavailable = no sample</Text>
        {comparison.rows.length ? comparison.rows.map(row => <View key={row.name} style={ui.divider}><Text style={ui.body}>{row.name}</Text><BarChart rows={Object.entries(row.percentages).map(([label, value]) => ({ label, value }))} /></View>) : <Text style={ui.body}>No recognized skills in the selected samples.</Text>}
        {comparison.roles.flatMap(r => r.warnings).filter((w, i, all) => all.indexOf(w) === i).map(w => <Text style={ui.muted} key={w}>{w}</Text>)}</>}
    </Card> : sample && <>
      <StatStrip items={[{ label: 'Jobs analyzed', value: sample.sample_size }, { label: 'Skills', value: sample.skills.length }, { label: 'Search pages', value: sample.collection_count }]} />
      <Text style={ui.muted}>{sample.filters.role || 'All roles'} / {sample.filters.location || 'All locations'} / Last collected {time(sample.last_collected_at)} / {sample.data_status}</Text>
      {sample.warnings.map(w => <Text key={w} style={ui.muted}>{w}</Text>)}
      {!sample.sample_size && <Card><Text style={ui.heading}>No data for these filters</Text><Text style={ui.body}>Reset filters or collect a sample.</Text></Card>}
      {mode === 'ranking' && <DemandRanking sample={sample} busy={busy} open={open} />}
      {mode === 'student' && personal && <><Card><Text style={ui.kicker}>MY EVIDENCE AND SAMPLE DEMAND</Text><SkillCoverage value={personal.coverage_percentage} present={personal.evidenced_skill_count} total={personal.observed_skill_count} /><MarketRadar skills={personal.skills} /><Text style={ui.muted}>“Unverified” means the saved student evidence was insufficient for this comparison; it is not a judgment of your capability.</Text></Card>
        <Card><Text style={ui.heading}>Learning priorities from this sample</Text><Text style={ui.muted}>Use these as learning prompts alongside your Career Plan. They do not change your competencies or roadmap automatically.</Text>{personal.skills.map(s => <View style={ui.divider} key={s.name}><Text style={ui.heading}>{s.name} / {s.status}</Text><Text style={ui.body}>Sample demand: {percentage(s.demand_percentage)} / Evidenced proficiency: {percentage(s.competency_percentage)} / Explicit target: {s.expected_level === null ? 'Unknown' : `${s.expected_level}/5`}</Text><Text style={ui.body}>{s.action.toUpperCase()}: {s.explanation}</Text><Text style={ui.muted}>Priority score: {s.priority_score} / Listing IDs: {s.job_ids.join(', ')}</Text>{s.resources.map(r => <Action secondary disabled={busy} key={r.url} onPress={() => open(r.url)}>{r.title} ↗ ({r.provenance.replaceAll('_', ' ')})</Action>)}{s.roadmap_items.map(t => <Text style={ui.muted} key={t.id}>Existing roadmap: {t.task} / {t.status.replaceAll('_', ' ')}</Text>)}</View>)}<Action secondary disabled={busy} onPress={() => router.push('/')}>Continue in My Career Plan →</Action></Card></>}
      <Card><Text style={ui.heading}>Source listings in this sample</Text><Text style={ui.muted}>These sources support the displayed counts. Listings may be outdated or unavailable; verify the original posting before acting.</Text><Action secondary disabled={busy} onPress={() => setShowJobs(value => !value)}>{showJobs ? 'Hide' : 'Show'} relevant job sources ({sample.jobs.length})</Action>{showJobs && sample.jobs.map(j => <View style={ui.divider} key={j.id}><Text style={ui.body}>#{j.id} {j.title}</Text><Text style={ui.muted}>{j.company || 'Company unknown'} / {j.location || 'Location unknown'} / {j.source_domain || 'Source unavailable'} / {j.provenance} / not verified active</Text>{j.source_url && <Action secondary disabled={busy} onPress={() => open(j.source_url!)}>Open original listing ↗</Action>}</View>)}</Card>
    </>}
    {!session.getStudentId() && <Text style={ui.muted}>Student sign-in required for comparisons.</Text>}
  </ScrollView></SafeAreaView>;
}
