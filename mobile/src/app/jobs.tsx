import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { careerApi, jobsApi, session } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import CareerRoadmap from '@/components/career-roadmap';
import { ScoreRing, StatStrip } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { OpportunitiesHeader } from '@/components/opportunities-header';
import type { JobListingOut, JobMatchOut, JobSearchIn, JobSearchOut, MarketSkillsOut, RoadmapItemOut } from '@/types/contracts';

const pct = (value: number) => `${Math.round(value * 100)}%`;
const date = (value: string) => new Date(value).toLocaleString();
export default function JobsScreen() {
  const [role, setRole] = useState('Machine Learning Engineer');
  const [location, setLocation] = useState('');
  const [keywords, setKeywords] = useState('');
  const [level, setLevel] = useState<NonNullable<JobSearchIn['level']>>('any');
  const [sample, setSample] = useState<JobSearchOut | null>(null);
  const [detail, setDetail] = useState<JobListingOut | null>(null);
  const [match, setMatch] = useState<JobMatchOut | null>(null);
  const [market, setMarket] = useState<MarketSkillsOut | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItemOut[] | null>(null);
  const [studentId, setStudentId] = useState<number | null>(() => session.getStudentId());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<(() => void) | null>(null);

  async function perform(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setRetry(null);
    try { await work(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Request unsuccessful.'); setRetry(() => () => { void perform(work); }); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function search(next = false) {
    if (!role.trim()) { setError('Enter a target role.'); return; }
    const query: JobSearchIn = next && sample ? { ...sample.scope, page: (sample.scope.page ?? 1) + 1, next_page_token: sample.next_page_token } : { role: role.trim(), location: location.trim(), keywords: keywords.trim(), level };
    void perform(async () => {
      setSample(null); setDetail(null); setMatch(null); setMarket(null); setRoadmap(null);
      setSample(await jobsApi.search(query));
    });
  }
  function select(id: number) { void perform(async () => { setDetail(null); setMatch(null); setRoadmap(null);   setDetail(await jobsApi.detail(id)); }); }
  function analyze() { if (!detail || !studentId) return; void perform(async () => { setMatch(null); setRoadmap(null);  setMatch(await jobsApi.match(detail.id, studentId)); }); }
  function open(url: string) { void perform(async () => { if (!/^https?:\/\//i.test(url) || !await Linking.canOpenURL(url)) throw new Error('This source link cannot be opened.'); await Linking.openURL(url); }); }
  return <SafeAreaView edges={['bottom']} style={ui.screen}><ScrollView contentContainerStyle={[ui.content, { maxWidth: 1200 }]} keyboardShouldPersistTaps="handled">
    <OpportunitiesHeader title="Job Search & Matching" description="Search collected openings, inspect their source, then compare a listing with your saved student evidence." />
    <Card><Text style={ui.kicker}>SEARCH OPENINGS</Text><Text style={ui.heading}>Describe the opportunity you want</Text><Text style={ui.muted}>Results come from an external search provider. Listings, requirements, and availability can change after collection.</Text><Text style={ui.label}>Target role</Text><TextInput accessibilityLabel="Target role" editable={!busy} maxLength={120} value={role} onChangeText={setRole} style={ui.input} placeholderTextColor={d.muted} placeholder="Job title" />
      <Text style={ui.label}>Location (optional)</Text><TextInput accessibilityLabel="Job search location" editable={!busy} maxLength={120} value={location} onChangeText={setLocation} style={ui.input} placeholderTextColor={d.muted} placeholder="City, country" />
      <Text style={ui.label}>Keywords (optional)</Text><TextInput accessibilityLabel="Job search keywords" editable={!busy} maxLength={160} value={keywords} onChangeText={setKeywords} style={ui.input} placeholderTextColor={d.muted} placeholder="Python, graduate, remote…" />
      <Text style={ui.label}>Add career-stage terms to the query</Text><View style={ui.row}>{([['any', 'Any stage'], ['entry_level', 'Entry level'], ['internship', 'Internship']] as const).map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === level, disabled: busy }} disabled={busy} key={value} onPress={() => setLevel(value)} style={[ui.chip, value === level && ui.selected]}><Text style={ui.body}>{label}</Text></Pressable>)}</View>
      <Action onPress={() => search()} disabled={busy || !role.trim()}>Search openings →</Action><Text style={ui.muted}>Opening availability is not verified by SkillUp. Confirm details on the original source before applying.</Text>
    </Card>
    {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.muted}>Working on your request…</Text></View>}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text>{retry && <Action secondary disabled={busy} onPress={retry}>Retry request</Action>}</Card>}
    {sample && <><StatStrip items={[{ label: "Listings", value: sample.jobs.length }, { label: "With requirements", value: sample.jobs.filter(job => job.skills.some(skill => skill.requirement_type !== "mentioned")).length }]} />
      <View style={ui.row}><Text style={ui.heading}>{sample.jobs.length} retrieved listings</Text><Text style={ui.muted}>{sample.cache_status === 'live' ? 'Live retrieval' : sample.cache_status === 'fresh_cache' ? 'Cached retrieval' : 'Older cache · live search unavailable'}</Text></View><Text style={ui.muted}>{sample.query}{sample.scope.location ? ` / ${sample.scope.location}` : ''} / Page {sample.scope.page ?? 1} / Collected {date(sample.retrieved_at)}</Text>
      {sample.warnings.map(w => <Text style={ui.muted} key={w}>{w}</Text>)}
      {sample.jobs.length === 0 && <Card><Text style={ui.heading}>No listings found.</Text><Text style={ui.body}>Try a broader role, another location, or fewer keywords.</Text></Card>}
      {sample.jobs.map(job => <Card key={job.id}><Text style={ui.kicker}>OPENING / NOT VERIFIED ACTIVE</Text><Text style={ui.heading}>{job.title}</Text><Text style={ui.body}>{job.company ?? 'Company not supplied'} / {job.location ?? 'Location not supplied'}</Text><Text style={ui.muted}>{job.employment_type ?? 'Employment type not supplied'} / Source: {job.source_domain ?? 'Not supplied'}</Text><Text numberOfLines={2} style={ui.muted}>Observed requirements: {job.skills.slice(0, 6).map(skill => skill.name).join(" / ") || "No dictionary-supported skills"}</Text><Action secondary disabled={busy} onPress={() => select(job.id)}>Inspect requirements and match →</Action></Card>)}
      {sample.next_page_token && <Action secondary disabled={busy} onPress={() => search(true)}>Next result page →</Action>}
      <Action secondary disabled={busy} onPress={() => void perform(async () => setMarket(await jobsApi.market(sample.search_id)))}>View sample skills</Action>
    </>}
    {market && <Card><Text style={ui.kicker}>OBSERVED SKILLS / THIS SEARCH SAMPLE</Text><Text style={ui.heading}>{market.sample_size} unique listings</Text><Text style={ui.muted}>{market.scope.role} / {market.scope.location || 'Location not specified'} / Collected {date(market.retrieved_at)}. Counts reflect this sample only, not the full job market.</Text>{market.skills.length ? market.skills.map(skill => <View style={ui.divider} key={skill.name}><Text style={ui.body}>{skill.name} / {skill.count} listings ({pct(skill.share)})</Text><Text style={ui.muted}>Required: {skill.required_count} / Preferred: {skill.preferred_count} / Other mentions: {skill.count - skill.required_count - skill.preferred_count}</Text></View>) : <Text style={ui.body}>No dictionary-supported skills found in this sample.</Text>}{market.warnings.map(w => <Text style={ui.muted} key={w}>{w}</Text>)}</Card>}
    {detail && <Card><Text style={ui.kicker}>SELECTED LISTING / NOT VERIFIED ACTIVE</Text><Text style={ui.heading}>{detail.title}</Text><Text style={ui.body}>{detail.company ?? 'Company not supplied'} / {detail.location ?? 'Location not supplied'}</Text><Text style={ui.muted}>Retrieved {date(detail.retrieved_at)} / Source: {detail.source_domain ?? 'Unavailable'}</Text>
      {detail.source_url && <Action secondary disabled={busy} onPress={() => open(detail.source_url!)}>Open original source to verify and apply ↗</Action>}
      <Action secondary disabled={busy || !studentId} onPress={() => router.push({ pathname: "/resume", params: { job_id: detail.id } })}>Enhance my resume for this job →</Action>
      <Text selectable style={ui.body}>{detail.description || 'Description not supplied.'}</Text><Text style={ui.heading}>Observed skills</Text>
      {detail.skills.map(skill => <View style={ui.divider} key={skill.name}><Text style={ui.body}>{skill.name} / {skill.requirement_type}{skill.expected_level !== null ? ` / ${skill.expected_level}/5` : ' / Proficiency not stated'}</Text><Text style={ui.muted}>{skill.excerpt}</Text></View>)}
      {detail.warnings.map(w => <Text style={ui.muted} key={w}>{w}</Text>)}
      {!!detail.missing_fields.length && <Text style={ui.muted}>Not supplied: {detail.missing_fields.join(', ')}</Text>}
      {!studentId ? <Action secondary disabled={busy} onPress={() => void perform(async () => { const ids = await careerApi.seed(); setStudentId(ids.student_id); })}>Load synthetic student profile for comparison</Action> : <Action disabled={busy || !detail.skills.some(s => s.requirement_type !== 'mentioned')} onPress={analyze}>Compare with my student evidence →</Action>}
    </Card>}
    {match && <>
      <Card><Text style={ui.kicker}>YOUR RECORDED EVIDENCE / {match.analysis.readiness.formula_version}</Text><Text style={ui.heading}>How this listing aligns with your evidence</Text><ScoreRing value={match.analysis.readiness.measurable ? match.analysis.readiness.alignment * 100 : null} label="Role alignment" /><Text style={ui.body}>{match.analysis.readiness.label}</Text><Text style={ui.muted}>Measured evidence coverage: {pct(match.analysis.readiness.evidence_coverage)} / Confidence: {pct(match.analysis.readiness.confidence)}. This compares recorded student evidence with observed listing terms; it is not an eligibility decision or hiring prediction.</Text>
        <Text style={ui.heading}>Recorded evidence</Text><Text style={ui.body}>{match.evidenced_skills.join(', ') || 'No matching skill evidence recorded.'}</Text>
        <Text style={ui.heading}>Unknown evidence or proficiency</Text><Text style={ui.body}>{match.unknown_skills.join(', ') || 'No additional unknown competencies identified.'}</Text>
        {match.analysis.strengths.map(c => <Text style={ui.body} key={c.skill.id}>Matched: {c.skill.canonical_name} / {c.level}/5</Text>)}
        {match.analysis.gaps.map(g => <View style={ui.divider} key={g.skill.id}><Text style={ui.body}>{g.skill.canonical_name} / {g.priority} priority</Text><Text style={ui.muted}>Current: {g.current_level ?? 'Unknown'} / Required: {g.required_level ?? 'Unknown'} / {g.rationale}</Text></View>)}
        {match.explanation.map((w, i) => <Text style={ui.muted} key={i}>{w}</Text>)}<Text style={ui.muted}>{match.analysis.readiness.disclaimer}</Text>
        <Action disabled={busy} onPress={() => void perform(async () => setRoadmap(await jobsApi.roadmap(match.analysis.student_id, match.analysis.id)))}>Build this role’s learning roadmap →</Action>
        <Action secondary disabled={busy} onPress={() => { session.setTarget(match.analysis); router.push('/'); }}>Continue in My journey →</Action>
      </Card>
      <Card><Text style={ui.heading}>Prepare your application document</Text><Text style={ui.muted}>The Resume Analyzer keeps your document, consent, and edits private. This handoff only selects the listing as its target.</Text><Action secondary disabled={busy} onPress={() => router.push({ pathname: '/resume', params: { job_id: match.listing.id } })}>Open Resume Analyzer for this listing</Action></Card>
    </>}
    {roadmap && <CareerRoadmap items={roadmap} onChange={setRoadmap} />}

  </ScrollView></SafeAreaView>;
}
