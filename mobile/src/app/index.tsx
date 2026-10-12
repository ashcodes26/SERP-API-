import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import CareerRoadmap from '@/components/career-roadmap';
import JourneyInput from '@/components/journey-input';
import { BarChart, ScoreRing, SkillGapChart } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { ApiError, careerApi, jobsApi, session, type QuestionSet } from '@/api/client';
import type { AnalysisOut, DashboardOut, JobOut, ProfileOut, RoadmapItemOut } from '@/types/contracts';

type Stage = 'welcome' | 'input' | 'profile' | 'analysis' | 'roadmap' | 'quiz' | 'result';
const pct = (v: number) => `${Math.round(v * 100)}%`;
const accent = d.accent;

function Action({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, secondary && s.buttonSecondary, (disabled || pressed) && { opacity: 0.58 }]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
}
function Panel({ children }: { children: React.ReactNode }) { return <View style={s.panel}>{children}</View>; }
function Heading({ children }: { children: React.ReactNode }) { return <Text style={s.heading}>{children}</Text>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.muted}>{label}</Text></View>; }
function readinessCard(readiness: NonNullable<DashboardOut['readiness']>) {
  return <Panel><Text style={s.eyebrow}>{readiness.label}</Text><ScoreRing value={readiness.measurable ? readiness.alignment * 100 : null} label="Role alignment" /><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(readiness.alignment * 100) }} style={s.track}><View style={[s.fill, { width: `${Math.max(0, Math.min(1, readiness.alignment)) * 100}%` }]} /></View><View style={s.metricRow}><Metric label="Evidence coverage" value={pct(readiness.evidence_coverage)}/><Metric label="Confidence" value={pct(readiness.confidence)}/></View>{readiness.drivers.map((v, i) => <Text style={s.note} key={i}>• {v}</Text>)}<Text style={s.disclaimer}>{readiness.disclaimer}</Text></Panel>;
}

export default function HomeScreen() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [ids, setIds] = useState<{ student_id: number; job_id: number } | null>(null);
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [role, setRole] = useState<JobOut | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisOut | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapItemOut[]>([]);
  const [quiz, setQuiz] = useState<QuestionSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<DashboardOut | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  const run = useCallback(async function execute(work: () => Promise<void>) {
    setBusy(true); setError(null); setRetry(null);
    try { await work(); }
    catch (e) {
      setError(e instanceof ApiError ? `${e.message} (${e.code})` : e instanceof Error ? e.message : 'Something went wrong.');
      setRetry(() => () => { void execute(work); });
    } finally { setBusy(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    const target = session.takeTarget();
    if (!target) return;
    let active = true;
    void run(async () => {
      const student = await careerApi.profile(target.student_id);
      if (!active) return;
      setIds({ student_id: target.student_id, job_id: target.job.id });
      setProfile(student); setRole(target.job); setAnalysis(target); setRoadmap([]);
      setQuiz(null); setDashboard(null); setLastScore(null); setStage('analysis');
    });
    return () => { active = false; };
  }, [run]));

  const start = () => void run(async () => {
    const selected = await careerApi.seed();
    if (!selected.synthetic) throw new Error('Expected a synthetic demo student.');
    const [student, job] = await Promise.all([careerApi.profile(selected.student_id), careerApi.role(selected.job_id)]);
    if (!student.student.is_synthetic) throw new Error('Non-demo student detected; refusing to enter demo.');
    setIds(selected); setProfile(student); setRole(job); setAnalysis(null); setRoadmap([]); setQuiz(null); setDashboard(null); setLastScore(null); setStage('profile');
  });
  const analyze = () => { if (!ids) return; void run(async () => {
    const result = await careerApi.analyze(ids.student_id, ids.job_id);
    setAnalysis(result); setStage('analysis');
  }); };
  const loadRoadmap = () => { if (!ids) return; void run(async () => {
    const tasks = analysis ? await jobsApi.roadmap(ids.student_id, analysis.id) : await careerApi.roadmap(ids.student_id);
    setRoadmap(tasks); setStage('roadmap');
  }); };
  const loadQuiz = (skillId: number) => void run(async () => {
    const result = await careerApi.questions(skillId);
    setQuiz(result); setAnswers({}); setStage('quiz');
  });
  const submit = () => { if (!ids || !quiz) return; void run(async () => {
    const result = await careerApi.submit({ student_id: ids.student_id, skill_id: quiz.skill_id, question_set_version: quiz.question_set_version, answers });
    const latest = await careerApi.dashboard(ids.student_id);
    setLastScore(result.score); setDashboard(latest); setStage('result');
  }); };
  const refresh = () => { if (!ids) return; void run(async () => { setDashboard(await careerApi.dashboard(ids.student_id)); setStage('result'); }); };
  const reset = () => { setError(null); setRetry(null); setStage('welcome'); setIds(null); setProfile(null); setRole(null); setAnalysis(null); setRoadmap([]); setQuiz(null); setDashboard(null); };
  const inputSaved = async (saved: ProfileOut) => {
    const selected = ids ?? await careerApi.seed();
    const targetRole = role ?? await careerApi.role(selected.job_id);
    setIds({ student_id: saved.student.id, job_id: selected.job_id }); setRole(targetRole); setProfile(saved);
    setAnalysis(null); setRoadmap([]); setQuiz(null); setDashboard(null); setLastScore(null); setStage('profile');
  };
  const quizSkills = analysis?.gaps.filter(g => ['SQL','Python','Docker'].includes(g.skill.canonical_name)) ?? [];

  return <SafeAreaView edges={['bottom']} style={s.root}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.top}><Text style={s.brand}>Skillup <Text style={s.brandDot}>●</Text></Text><Text style={s.mode}>SYNTHETIC WORKSPACE</Text></View>
    <View style={s.steps}>{(['profile', 'analysis', 'roadmap', 'quiz', 'result'] as const).map((step, index) => {
      const available = step === 'profile' ? !!profile : step === 'quiz' ? !!quiz : !!analysis;
      return <Pressable key={step} accessibilityRole="button" accessibilityState={{ selected: stage === step, disabled: busy || !available }} disabled={busy || !available} onPress={() => { if (step === 'roadmap') loadRoadmap(); else if (step === 'result') refresh(); else setStage(step); }} style={[s.step, stage === step && s.stepActive, !available && { opacity: 0.5 }]}><Text style={[s.stepText, stage === step && s.stepTextActive]}>{String(index + 1).padStart(2, '0')} / {step === 'result' ? 'Progress' : step === 'quiz' ? 'Practice' : step.charAt(0).toUpperCase() + step.slice(1)}</Text></Pressable>;
    })}</View>

    <Heading>{stage === 'input' ? 'Your details' : stage === 'welcome' ? 'Your journey' : stage === 'profile' ? 'Profile' : stage === 'analysis' ? 'Role alignment' : stage === 'roadmap' ? 'Roadmap' : stage === 'quiz' ? 'Practice' : 'Progress'}</Heading>

    {error && <Panel><Text style={s.errorTitle}>Request unsuccessful</Text><Text style={s.note}>{error}</Text>{retry && <Action title="Try again" secondary onPress={retry}/>}</Panel>}
    {busy && <View style={s.loading}><ActivityIndicator size="large" color={accent}/><Text style={s.muted}>Syncing with Skillup…</Text></View>}
    {stage === 'input' && <JourneyInput onSaved={inputSaved} onCancel={() => setStage(profile ? 'profile' : 'welcome')} />}
    {stage !== 'input' && stage !== 'roadmap' && session.getStudentId() && <Action title={profile ? 'Update details' : 'Add details'} onPress={() => setStage('input')} disabled={busy} />}
    {stage === 'welcome' && <><Panel><Text style={s.eyebrow}>YOUR LEARNING JOURNEY</Text><Text style={s.listText}>01   Profile</Text><Text style={s.listText}>02   Alignment</Text><Text style={s.listText}>03   Roadmap</Text><Text style={s.listText}>04   Practice</Text></Panel><Action title="Start demo →" onPress={start} disabled={busy}/></>}
    {stage === 'profile' && profile && role && <><Panel><Text style={s.eyebrow}>STUDENT · SYNTHETIC</Text><Text style={s.cardTitle}>{profile.student.name}</Text><Text style={s.note}>{profile.student.program} · {profile.student.specialization}</Text><Text style={s.note}>Student ID: {profile.student.student_id}</Text><Text style={s.note}>CGPA: {profile.student.cgpa ?? 'Not available'}</Text></Panel><Panel><Text style={s.eyebrow}>COMPETENCIES</Text><BarChart max={5} unit="/5" rows={profile.competencies.map(c => ({ label: c.skill.canonical_name, value: c.level }))} />{profile.competencies.length === 0 && <Text style={s.note}>No skill evidence yet.</Text>}</Panel><Panel><Text style={s.eyebrow}>TARGET ROLE</Text><Text style={s.cardTitle}>{role.title}</Text><Text style={s.note}>{role.skills.length} competencies in role profile</Text></Panel><Action title="Analyze gaps →" onPress={analyze} disabled={busy}/></>}
    {stage === 'analysis' && analysis && <>{readinessCard(analysis.readiness)}<Panel><Text style={s.eyebrow}>PRIORITY GAPS</Text>{analysis.gaps.length === 0 ? <Text style={s.note}>No gaps identified from current evidence.</Text> : <SkillGapChart gaps={analysis.gaps} />}</Panel>{analysis.warnings.length > 0 && <Panel>{analysis.warnings.map((w,i)=><Text style={s.note} key={i}>{w}</Text>)}</Panel>}<Action title="Build roadmap →" onPress={loadRoadmap} disabled={busy}/></>}
    {stage === 'roadmap' && <><CareerRoadmap items={roadmap} onChange={setRoadmap}/><Text style={s.eyebrow}>PRACTICE AN IDENTIFIED SKILL</Text>{quizSkills.length ? quizSkills.map(g => <Action key={g.skill.id} title={`Take ${g.skill.canonical_name} assessment →`} onPress={() => loadQuiz(g.skill.id)} disabled={busy} secondary/>) : <Text style={s.note}>No supported mini assessment matches these gaps. Current question sets: SQL, Python, Docker.</Text>}<Action title="Refresh dashboard" onPress={refresh} secondary disabled={busy}/></>}
    {stage === 'quiz' && quiz && <><Panel><Text style={s.eyebrow}>{quiz.question_set_version} · {quiz.questions.length} QUESTIONS</Text>{quiz.questions.map((q, index) => <View style={s.gap} key={q.id}><Text style={s.lineTitle}>{index+1}. {q.prompt}</Text>{q.options.map(option => <Pressable accessibilityRole="radio" disabled={busy} accessibilityState={{ checked: answers[q.id] === option, disabled: busy }} key={option} onPress={() => setAnswers(prev => ({ ...prev, [q.id]: option }))} style={[s.option, answers[q.id] === option && s.selected]}><Text style={[s.optionText, answers[q.id] === option && s.selectedText]}>{option}</Text></Pressable>)}</View>)}</Panel><Action title="Submit assessment" onPress={submit} disabled={busy || Object.keys(answers).length !== quiz.questions.length}/><Action title="Back to roadmap" onPress={() => setStage('roadmap')} secondary disabled={busy}/></>}
    {stage === 'result' && dashboard && <>{lastScore !== null && <Panel><Text style={s.eyebrow}>LATEST ASSESSMENT</Text><Text style={s.score}>{pct(lastScore)}</Text><Text style={s.note}>Question-set performance, not a certification.</Text></Panel>}{dashboard.readiness ? readinessCard(dashboard.readiness) : <Panel><Text style={s.note}>Analyze a role to see readiness.</Text></Panel>}<Panel><Text style={s.eyebrow}>ROADMAP STATUS</Text>{Object.entries(dashboard.roadmap_progress).map(([key,value]) => <View style={s.line} key={key}><Text style={s.note}>{key.replace(/_/g,' ')}</Text><Text style={s.value}>{value}</Text></View>)}<Text style={s.note}>Next step: {dashboard.next_action?.task ?? 'Review your learning plan'}</Text><Text style={s.disclaimer}>Mode: {dashboard.data_mode === 'demo' ? 'Synthetic demo' : 'Live student data'}</Text></Panel><Action title="Reanalyze target role" onPress={analyze} disabled={busy}/><Action title="Refresh dashboard" onPress={refresh} secondary disabled={busy}/></>}
    {stage !== 'welcome' && <Action title="Reset demo" onPress={reset} secondary disabled={busy}/>}

  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: d.canvas }, content: { padding: 24, paddingTop: 36, paddingBottom: 48, width: '100%', maxWidth: 1280, alignSelf: 'center', gap: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }, brand: { fontSize: 12, fontWeight: '500', letterSpacing: 2, color: d.muted }, brandDot: { fontSize: 10, color: d.muted }, mode: { fontSize: 10, letterSpacing: 1, color: d.muted, borderWidth: 1, borderColor: d.border, borderRadius: 4, padding: 8 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }, step: { padding: 10, borderBottomWidth: 1, borderBottomColor: d.border }, stepActive: { borderBottomColor: d.accent, backgroundColor: d.elevated }, stepText: { fontSize: 11, color: d.muted }, stepTextActive: { color: d.accent },
  kicker: { fontSize: 10, letterSpacing: 2, color: d.muted }, heading: { fontSize: 32, lineHeight: 36, fontWeight: '500', color: d.text, letterSpacing: -1 }, intro: { fontSize: 16, lineHeight: 25, color: d.muted, marginBottom: 16, maxWidth: 600 },
  panel: { backgroundColor: d.canvas, paddingVertical: 24, gap: 18, borderTopWidth: 1, borderColor: d.border }, eyebrow: { fontSize: 11, fontWeight: '500', letterSpacing: 1.4, color: d.muted }, cardTitle: { fontSize: 24, fontWeight: '500', color: d.text, letterSpacing: -0.3 }, muted: { color: d.muted, fontSize: 12 }, note: { color: d.body, fontSize: 14, lineHeight: 23 }, listText: { color: d.body, fontSize: 15, lineHeight: 26, paddingVertical: 8 },
  button: { backgroundColor: d.accent, paddingVertical: 16, paddingHorizontal: 18, borderRadius: d.controlRadius, alignItems: 'center', minHeight: 48 }, buttonSecondary: { backgroundColor: d.canvas, borderWidth: 1, borderColor: d.strongBorder }, buttonText: { fontWeight: '500', color: d.text, fontSize: 14, textAlign: 'center' }, secondaryText: { color: d.body },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flex: 1, minWidth: 120, backgroundColor: d.elevated, padding: 16, borderRadius: 6, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: d.border }, metricValue: { fontSize: 28, color: d.text, fontWeight: '500', letterSpacing: -0.6 }, score: { fontSize: 64, letterSpacing: -1.4, color: d.text, fontWeight: '500' }, scoreRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 }, scoreLabel: { color: d.muted, fontSize: 10, letterSpacing: 1.4 }, track: { height: 4, borderRadius: 2, backgroundColor: d.border, overflow: 'hidden' }, fill: { height: 4, backgroundColor: d.accent },
  disclaimer: { fontSize: 12, lineHeight: 19, color: d.muted }, line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, lineTitle: { fontSize: 16, fontWeight: '500', color: d.text, flex: 1 }, value: { color: d.body, fontWeight: '500' }, gap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: d.border, paddingTop: 20, gap: 12 }, tag: { fontSize: 10, fontWeight: '500', color: d.body, backgroundColor: d.elevated, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: d.strongBorder },
  option: { padding: 16, minHeight: 48, borderWidth: 1, borderColor: d.border, borderRadius: 6, backgroundColor: d.elevated }, optionText: { color: d.body, fontSize: 14, lineHeight: 22 }, selected: { backgroundColor: d.border, borderColor: d.body }, selectedText: { color: d.text, fontWeight: '500' }, loading: { alignItems: 'center', padding: 24, gap: 12 }, errorTitle: { fontSize: 17, fontWeight: '500', color: d.error }, footer: { textAlign: 'center', fontSize: 11, color: d.muted, marginTop: 24 },
});
