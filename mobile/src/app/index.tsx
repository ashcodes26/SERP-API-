import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import CareerRoadmap from '@/components/career-roadmap';
import JourneyInput from '@/components/journey-input';
import { BarChart, ScoreRing, SkillGapChart } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { ApiError, careerApi, jobsApi, session } from '@/api/client';
import type { AnalysisOut, DashboardOut, JobOut, ProfileOut, RoadmapItemOut } from '@/types/contracts';
import { createLatestRequestGate } from '@/utils/latest-request';

type Stage = 'input' | 'profile' | 'analysis' | 'roadmap';
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Action({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, secondary && s.buttonSecondary, (disabled || pressed) && { opacity: 0.58 }]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
}
function Panel({ children }: { children: React.ReactNode }) { return <View style={s.panel}>{children}</View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.muted}>{label}</Text></View>; }
function readinessCard(readiness: NonNullable<DashboardOut['readiness']>) {
  return <Panel><Text style={s.eyebrow}>{readiness.label}</Text><ScoreRing value={readiness.measurable ? readiness.alignment * 100 : null} label="Role alignment" /><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(readiness.alignment * 100) }} style={s.track}><View style={[s.fill, { width: `${Math.max(0, Math.min(1, readiness.alignment)) * 100}%` }]} /></View><View style={s.metricRow}><Metric label="Evidence coverage" value={pct(readiness.evidence_coverage)}/><Metric label="Confidence" value={pct(readiness.confidence)}/></View>{readiness.drivers.map((v, i) => <Text style={s.note} key={i}>• {v}</Text>)}<Text style={s.disclaimer}>{readiness.disclaimer}</Text></Panel>;
}

export default function HomeScreen() {
  const [stage, setStage] = useState<Stage>('profile');
  const [ids, setIds] = useState<{ student_id: number; job_id: number } | null>(null);
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [role, setRole] = useState<JobOut | null>(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetRequirements, setTargetRequirements] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisOut | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItemOut[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const requestGate = useRef(createLatestRequestGate());

  const run = useCallback(async function execute(work: () => Promise<void>) {
    const requestId = requestGate.current.begin();
    setBusy(true); setError(null); setRetry(null);
    try {
      await work();
      if (requestGate.current.isCurrent(requestId)) setError(null);
    }
    catch (e) {
      if (!requestGate.current.isCurrent(requestId)) return;
      setError(e instanceof ApiError ? `${e.message} (${e.code})` : e instanceof Error ? e.message : 'Something went wrong.');
      setRetry(() => () => { void execute(work); });
    } finally { if (requestGate.current.isCurrent(requestId)) setBusy(false); }
  }, []);

  const start = useCallback(() => void run(async () => {
    const selected = await careerApi.journey();
    const [student, job] = await Promise.all([careerApi.profile(selected.student_id), careerApi.role(selected.job_id)]);
    setIds(selected); setProfile(student); setRole(job); setTargetTitle(job.title); setTargetRequirements(''); setAnalysis(null); setRoadmap([]); setStage('profile');
  }), [run]);

  useFocusEffect(useCallback(() => {
    const target = session.takeTarget();
    if (!target) { start(); return; }
    let active = true;
    void run(async () => {
      const student = await careerApi.profile(target.student_id);
      if (!active) return;
      setIds({ student_id: target.student_id, job_id: target.job.id });
      setProfile(student); setRole(target.job); setTargetTitle(target.job.title); setTargetRequirements(''); setAnalysis(target); setRoadmap([]); setStage('analysis');
    });
    return () => { active = false; };
  }, [run, start]));

  const analyze = () => { if (!ids) return; void run(async () => {
    const result = await careerApi.analyze(ids.student_id, ids.job_id);
    setAnalysis(result); setStage('analysis');
  }); };
  const loadRoadmap = () => { if (!ids) return; void run(async () => {
    const tasks = analysis ? await jobsApi.roadmap(ids.student_id, analysis.id) : await careerApi.roadmap(ids.student_id);
    setRoadmap(tasks); setStage('roadmap');
  }); };
  const saveTargetRole = () => { if (!ids || !targetTitle.trim()) return; void run(async () => {
    const selected = await careerApi.customRole(targetTitle.trim(), targetRequirements.trim());
    setRole(selected); setIds({ ...ids, job_id: selected.id }); setAnalysis(null); setRoadmap([]); setStage('profile');
  }); };
  const reset = () => { setError(null); setRetry(null); setIds(null); setProfile(null); setRole(null); setAnalysis(null); setRoadmap([]); start(); };
  const inputSaved = async (saved: ProfileOut) => {
    const selected = ids ?? await careerApi.journey();
    const targetRole = role ?? await careerApi.role(selected.job_id);
    setIds({ student_id: saved.student.id, job_id: selected.job_id }); setRole(targetRole); setTargetTitle(targetRole.title); setProfile(saved);
    setAnalysis(null); setRoadmap([]); setStage('profile');
  };

  return <SafeAreaView edges={['bottom']} style={s.root}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.top}><Text style={s.brand}>Skillup <Text style={s.brandDot}>●</Text></Text><Text style={s.mode}>STUDENT WORKSPACE</Text></View>
    <View style={s.steps}>{(['profile', 'analysis', 'roadmap'] as const).map((step, index) => {
      const available = step === 'profile' ? !!profile : !!analysis;
      return <Pressable key={step} accessibilityRole="button" accessibilityState={{ selected: stage === step, disabled: busy || !available }} disabled={busy || !available} onPress={() => { if (step === 'roadmap') loadRoadmap(); else setStage(step); }} style={[s.step, stage === step && s.stepActive, !available && { opacity: 0.5 }]}><Text style={[s.stepText, stage === step && s.stepTextActive]}>{String(index + 1).padStart(2, '0')} / {step === 'analysis' ? 'Alignment' : step.charAt(0).toUpperCase() + step.slice(1)}</Text></Pressable>;
    })}</View>
    <Text style={s.heading}>{stage === 'input' ? 'Your details' : stage === 'profile' ? 'Profile' : stage === 'analysis' ? 'Role alignment' : 'Roadmap'}</Text>
    {error && <Panel><Text style={s.errorTitle}>Request unsuccessful</Text><Text style={s.note}>{error}</Text>{retry && <Action title="Try again" secondary onPress={retry}/>}</Panel>}
    {busy && <View style={s.loading}><ActivityIndicator size="large" color={d.accent}/><Text style={s.muted}>Syncing with Skillup…</Text></View>}
    {stage === 'input' && <JourneyInput onSaved={inputSaved} onCancel={() => setStage('profile')} />}
    {stage !== 'input' && stage !== 'roadmap' && session.getStudentId() && <Action title={profile ? 'Update details' : 'Add details'} onPress={() => setStage('input')} disabled={busy} />}
    {stage === 'profile' && profile && role && <><Panel><Text style={s.eyebrow}>{profile.student.is_synthetic ? 'STUDENT · SYNTHETIC' : 'STUDENT PROFILE'}</Text><Text style={s.cardTitle}>{profile.student.name}</Text><Text style={s.note}>{profile.student.program} · {profile.student.specialization}</Text><Text style={s.note}>Student ID: {profile.student.student_id}</Text><Text style={s.note}>CGPA: {profile.student.cgpa ?? 'Not available'}</Text></Panel><Panel><Text style={s.eyebrow}>COMPETENCIES</Text><BarChart max={5} unit="/5" rows={profile.competencies.map(c => ({ label: c.skill.canonical_name, value: c.level }))} />{profile.competencies.length === 0 && <Text style={s.note}>No skill evidence yet.</Text>}</Panel><Panel><Text style={s.eyebrow}>TARGET ROLE</Text><TextInput accessibilityLabel="Desired role" value={targetTitle} onChangeText={setTargetTitle} maxLength={200} placeholder="Enter your desired role" placeholderTextColor={d.muted} style={s.roleInput}/><TextInput accessibilityLabel="Role requirements" value={targetRequirements} onChangeText={setTargetRequirements} maxLength={20000} multiline placeholder="Optional for the demo role. For a new role, add skills or requirements to analyze." placeholderTextColor={d.muted} style={[s.roleInput, s.requirementsInput]}/><Text style={s.note}>{role.skills.length} competencies in the current role profile</Text><Action title="Save target role" onPress={saveTargetRole} disabled={busy || !targetTitle.trim()}/></Panel><Action title="Analyze gaps →" onPress={analyze} disabled={busy}/></>}
    {stage === 'analysis' && analysis && <>{readinessCard(analysis.readiness)}<Panel><Text style={s.eyebrow}>PRIORITY GAPS</Text>{analysis.gaps.length === 0 ? <Text style={s.note}>No gaps identified from current evidence.</Text> : <SkillGapChart gaps={analysis.gaps} />}</Panel>{analysis.warnings.length > 0 && <Panel>{analysis.warnings.map((w, i) => <Text style={s.note} key={i}>{w}</Text>)}</Panel>}<Action title="Build roadmap →" onPress={loadRoadmap} disabled={busy}/></>}
    {stage === 'roadmap' && (
      <CareerRoadmap items={roadmap} onChange={setRoadmap} analysisId={analysis?.id} />
    )}
    <Action title="Reset demo" onPress={reset} secondary disabled={busy}/>
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: d.canvas }, content: { padding: 24, paddingTop: 36, paddingBottom: 48, width: '100%', maxWidth: 1280, alignSelf: 'center', gap: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }, brand: { fontSize: 12, fontWeight: '500', letterSpacing: 2, color: d.muted }, brandDot: { fontSize: 10, color: d.muted }, mode: { fontSize: 10, letterSpacing: 1, color: d.muted, borderWidth: 1, borderColor: d.border, borderRadius: 4, padding: 8 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }, step: { padding: 10, borderBottomWidth: 1, borderBottomColor: d.border }, stepActive: { borderBottomColor: d.accent, backgroundColor: d.elevated }, stepText: { fontSize: 11, color: d.muted }, stepTextActive: { color: d.accent },
  heading: { fontSize: 32, lineHeight: 36, fontWeight: '500', color: d.text, letterSpacing: -1 }, panel: { backgroundColor: d.canvas, paddingVertical: 24, gap: 18, borderTopWidth: 1, borderColor: d.border }, eyebrow: { fontSize: 11, fontWeight: '500', letterSpacing: 1.4, color: d.muted }, cardTitle: { fontSize: 24, fontWeight: '500', color: d.text, letterSpacing: -0.3 }, muted: { color: d.muted, fontSize: 12 }, note: { color: d.body, fontSize: 14, lineHeight: 23 },
  button: { backgroundColor: d.accent, paddingVertical: 16, paddingHorizontal: 18, borderRadius: d.controlRadius, alignItems: 'center', minHeight: 48 }, buttonSecondary: { backgroundColor: d.canvas, borderWidth: 1, borderColor: d.strongBorder }, buttonText: { fontWeight: '500', color: d.text, fontSize: 14, textAlign: 'center' }, secondaryText: { color: d.body },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flex: 1, minWidth: 120, backgroundColor: d.elevated, padding: 16, borderRadius: 6, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: d.border }, metricValue: { fontSize: 28, color: d.text, fontWeight: '500', letterSpacing: -0.6 }, track: { height: 4, borderRadius: 2, backgroundColor: d.border, overflow: 'hidden' }, fill: { height: 4, backgroundColor: d.accent },
  disclaimer: { fontSize: 12, lineHeight: 19, color: d.muted }, loading: { alignItems: 'center', padding: 24, gap: 12 }, errorTitle: { fontSize: 17, fontWeight: '500', color: d.error },
  roleInput: { minHeight: 48, borderWidth: 1, borderColor: d.strongBorder, borderRadius: 6, color: d.text, backgroundColor: d.elevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 }, requirementsInput: { minHeight: 100, textAlignVertical: 'top' },
});
