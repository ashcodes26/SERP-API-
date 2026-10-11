import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { careerApi, jobsApi, session } from '@/api/client';
import { Action, Card, Disclosure, ui } from '@/components/career-ui';
import CareerRoadmap from '@/components/career-roadmap';
import ResumeUpload from '@/components/resume-upload';
import { design as d } from '@/constants/design';
import type { JobListingOut, JobMatchOut, JobSearchIn, JobSearchOut, MarketSkillsOut, ResumeAdviceOut, RoadmapItemOut } from '@/types/contracts';

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
  const [advice, setAdvice] = useState<ResumeAdviceOut | null>(null);
  const [resume, setResume] = useState('');
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
      setSample(null); setDetail(null); setMatch(null); setMarket(null); setRoadmap(null); setAdvice(null); setResume('');
      setSample(await jobsApi.search(query));
    });
  }
  function select(id: number) { void perform(async () => { setDetail(null); setMatch(null); setRoadmap(null); setAdvice(null); setResume(''); setDetail(await jobsApi.detail(id)); }); }
  function analyze() { if (!detail || !studentId) return; void perform(async () => { setMatch(null); setRoadmap(null); setAdvice(null); setMatch(await jobsApi.match(detail.id, studentId)); }); }
  function open(url: string) { void perform(async () => { if (!/^https?:\/\//i.test(url) || !await Linking.canOpenURL(url)) throw new Error('This source link cannot be opened.'); await Linking.openURL(url); }); }
  return <SafeAreaView edges={['bottom']} style={ui.screen}><ScrollView contentContainerStyle={[ui.content, { maxWidth: 1200 }]} keyboardShouldPersistTaps="handled">
    <Text style={ui.kicker}>DISCOVER / COMPARE / PREPARE</Text><Text style={ui.title}>Find a role. Find your focus.</Text><Text style={ui.body}>Explore retrieved listings, compare explicit requirements with your evidence, and turn the next step into a learning plan.</Text>
    <Card><Text style={ui.label}>Target role</Text><TextInput accessibilityLabel="Target role" editable={!busy} maxLength={120} value={role} onChangeText={setRole} style={ui.input} placeholderTextColor={d.muted} placeholder="Job title" />
      <Text style={ui.label}>Location (optional)</Text><TextInput accessibilityLabel="Job search location" editable={!busy} maxLength={120} value={location} onChangeText={setLocation} style={ui.input} placeholderTextColor={d.muted} placeholder="City, country" />
      <Text style={ui.label}>Keywords (optional)</Text><TextInput accessibilityLabel="Job search keywords" editable={!busy} maxLength={160} value={keywords} onChangeText={setKeywords} style={ui.input} placeholderTextColor={d.muted} placeholder="Python, graduate, remote…" />
      <Text style={ui.label}>Add career-stage terms to the query</Text><View style={ui.row}>{([['any', 'Any stage'], ['entry_level', 'Entry level'], ['internship', 'Internship']] as const).map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === level, disabled: busy }} disabled={busy} key={value} onPress={() => setLevel(value)} style={[ui.chip, value === level && ui.selected]}><Text style={ui.body}>{label}</Text></Pressable>)}</View>
      <Action onPress={() => search()} disabled={busy || !role.trim()}>Search job listings →</Action><Text style={ui.muted}>Listings may be stale or incomplete. Skillup does not verify that an opening is still active.</Text>
    </Card>
    {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.muted}>Working on your request…</Text></View>}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text>{retry && <Action secondary disabled={busy} onPress={retry}>Retry request</Action>}<Text style={ui.muted}>Your existing profile, seeded-role journey, and learning tools remain available in My journey.</Text></Card>}
    {sample && <>
      <View style={ui.row}><Text style={ui.heading}>{sample.jobs.length} retrieved listings</Text><Text style={ui.muted}>{sample.cache_status === 'live' ? 'Live retrieval' : sample.cache_status === 'fresh_cache' ? 'Cached retrieval' : 'Older cache · live search unavailable'}</Text></View><Text style={ui.muted}>{sample.query}{sample.scope.location ? ` / ${sample.scope.location}` : ''} / Page {sample.scope.page ?? 1} / {date(sample.retrieved_at)}</Text>
      {sample.warnings.map(w => <Text style={ui.muted} key={w}>{w}</Text>)}
      {sample.jobs.length === 0 && <Card><Text style={ui.heading}>No listings found.</Text><Text style={ui.body}>Try a broader role, another location, or fewer keywords.</Text></Card>}
      {sample.jobs.map(job => <Card key={job.id}><Text style={ui.heading}>{job.title}</Text><Text style={ui.body}>{job.company ?? 'Company not supplied'} / {job.location ?? 'Location not supplied'}</Text><Text style={ui.muted}>{job.employment_type ?? 'Employment type not supplied'} / {job.source_domain ?? 'Source link not supplied'}</Text><Text numberOfLines={3} style={ui.body}>{job.description || 'Description not supplied.'}</Text><Action secondary disabled={busy} onPress={() => select(job.id)}>View details & compare →</Action></Card>)}
      {sample.next_page_token && <Action secondary disabled={busy} onPress={() => search(true)}>Next result page →</Action>}
      <Action secondary disabled={busy} onPress={() => void perform(async () => setMarket(await jobsApi.market(sample.search_id)))}>Inspect skills in this result sample</Action>
    </>}
    {market && <JobSampleSkills market={market} />}
    {detail && <Card><Text style={ui.kicker}>SELECTED LISTING / NOT VERIFIED ACTIVE</Text><Text style={ui.heading}>{detail.title}</Text><Text style={ui.body}>{detail.company ?? 'Company not supplied'} / {detail.location ?? 'Location not supplied'}</Text><Text style={ui.muted}>Retrieved {date(detail.retrieved_at)} / Source: {detail.source_domain ?? 'Unavailable'}</Text>
      {detail.source_url && <Action secondary disabled={busy} onPress={() => open(detail.source_url!)}>Open original source ↗</Action>}
      <Action secondary disabled={busy || !studentId} onPress={() => router.push({ pathname: "/resume", params: { job_id: detail.id } })}>Enhance my resume for this job →</Action>
      <Text selectable style={ui.body}>{detail.description || 'Description not supplied.'}</Text><Text style={ui.heading}>Observed skills</Text>
      {detail.skills.map(skill => <View style={ui.divider} key={skill.name}><Text style={ui.body}>{skill.name} / {skill.requirement_type}{skill.expected_level !== null ? ` / ${skill.expected_level}/5` : ' / Proficiency not stated'}</Text><Text style={ui.muted}>{skill.excerpt}</Text></View>)}
      {detail.warnings.map(w => <Text style={ui.muted} key={w}>{w}</Text>)}
      {!!detail.missing_fields.length && <Text style={ui.muted}>Not supplied: {detail.missing_fields.join(', ')}</Text>}
      {!studentId ? <Action secondary disabled={busy} onPress={() => void perform(async () => { const ids = await careerApi.seed(); setStudentId(ids.student_id); })}>Load synthetic student profile for comparison</Action> : <Action disabled={busy || !detail.skills.some(s => s.requirement_type !== 'mentioned')} onPress={analyze}>Compare with my student evidence →</Action>}
    </Card>}
    {match && <>
      <Card><Text style={ui.kicker}>YOUR EVIDENCE / {match.analysis.readiness.formula_version}</Text><Text style={ui.score}>{match.analysis.readiness.measurable ? pct(match.analysis.readiness.alignment) : 'Not measurable'}</Text><Text style={ui.body}>{match.analysis.readiness.label}</Text><Text style={ui.muted}>Measured evidence coverage: {pct(match.analysis.readiness.evidence_coverage)} / Confidence: {pct(match.analysis.readiness.confidence)}</Text>
        <Text style={ui.heading}>Recorded evidence</Text><Text style={ui.body}>{match.evidenced_skills.join(', ') || 'No matching skill evidence recorded.'}</Text>
        <Text style={ui.heading}>Unknown evidence or proficiency</Text><Text style={ui.body}>{match.unknown_skills.join(', ') || 'No additional unknown competencies identified.'}</Text>
        {match.analysis.strengths.map(c => <Text style={ui.body} key={c.skill.id}>Matched: {c.skill.canonical_name} / {c.level}/5</Text>)}
        {match.analysis.gaps.map(g => <View style={ui.divider} key={g.skill.id}><Text style={ui.body}>{g.skill.canonical_name} / {g.priority} priority</Text><Text style={ui.muted}>Current: {g.current_level ?? 'Unknown'} / Required: {g.required_level ?? 'Unknown'} / {g.rationale}</Text></View>)}
        {match.explanation.map((w, i) => <Text style={ui.muted} key={i}>{w}</Text>)}<Text style={ui.muted}>{match.analysis.readiness.disclaimer}</Text>
        <Action disabled={busy} onPress={() => void perform(async () => setRoadmap(await jobsApi.roadmap(match.analysis.student_id, match.analysis.id)))}>Build this role’s learning roadmap →</Action>
        <Action secondary disabled={busy} onPress={() => { session.setTarget(match.analysis); router.push('/'); }}>Continue in My journey →</Action>
      </Card>
      <Card><Text style={ui.heading}>Prepare an honest resume</Text><Text style={ui.muted}>Paste resume text for job-specific suggestions. It is not stored or sent to SerpApi.</Text><TextInput accessibilityLabel="Resume text for selected job" value={resume} onChangeText={setResume} multiline maxLength={20000} editable={!busy} style={[ui.input, { minHeight: 160, textAlignVertical: 'top' }]} placeholder="Paste the relevant resume sections…" placeholderTextColor={d.muted} />
        <Action secondary disabled={busy || resume.trim().length < 30} onPress={() => void perform(async () => setAdvice(await jobsApi.advice(match.listing.id, match.analysis.student_id, resume)))}>Review job-specific resume suggestions</Action>
        {advice && <View style={ui.divider}>{advice.suggestions.map((v, i) => <Text style={ui.body} key={i}>{v}</Text>)}{advice.limitations.map(v => <Text style={ui.muted} key={v}>{v}</Text>)}</View>}
        <ResumeUpload key={match.listing.id} jobId={match.listing.id} studentId={match.analysis.student_id} disabled={busy} />
      </Card>
    </>}
    {roadmap && <CareerRoadmap items={roadmap} onChange={setRoadmap} />}
    <Text style={ui.muted}>Skillup / Retrieved data. Transparent evidence. Deliberate progress.</Text>
  </ScrollView></SafeAreaView>;
}

function JobSampleSkills({ market }: { market: MarketSkillsOut }) {
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  return <Card><Text style={ui.kicker}>OBSERVED SKILLS / SEARCH SAMPLE</Text><Text style={ui.heading}>{market.sample_size} unique listings</Text><Text style={ui.muted}>{market.scope.role} · {market.scope.location || 'Location not specified'} · {date(market.retrieved_at)}</Text>
    <Text style={ui.muted}>Select a skill to see how it appeared in this retrieved page.</Text>
    {market.skills.length ? market.skills.map(skill => <Disclosure key={skill.name} title={skill.name} summary={`${skill.count} listing${skill.count === 1 ? '' : 's'} · ${pct(skill.share)}`} open={openSkill === skill.name} onToggle={() => setOpenSkill(current => current === skill.name ? null : skill.name)}>
      <Text style={ui.body}>Required in {skill.required_count} · Preferred in {skill.preferred_count} · Other mentions in {skill.count - skill.required_count - skill.preferred_count}</Text>
    </Disclosure>) : <Text style={ui.body}>No dictionary-supported skills found in this sample.</Text>}
    {market.warnings.map(warning => <Text style={ui.muted} key={warning}>{warning}</Text>)}
  </Card>;
}
