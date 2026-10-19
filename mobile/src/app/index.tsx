import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import CareerRoadmap from '@/components/career-roadmap';
import JourneyInput from '@/components/journey-input';
import DocumentReview from '@/components/document-review';
import { BarChart, ScoreRing, SkillGapChart } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { ApiError, careerApi, jobsApi, session } from '@/api/client';
import type { AnalysisOut, DashboardOut, JobOut, ProfileOut, RoadmapItemOut } from '@/types/contracts';
import { createLatestRequestGate } from '@/utils/latest-request';
import { canOpenJourneyStep, journeySteps, journeyStepState, type JourneyStage, type JourneyStep } from '@/utils/journey-stage';

const pct = (value: number) => `${Math.round(value * 100)}%`;

function Action({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, secondary && s.buttonSecondary, (disabled || pressed) && { opacity: 0.58 }]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{title}</Text></Pressable>;
}
function Panel({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'raised' | 'notice' }) { return <View style={[s.panel, tone === 'raised' && s.panelRaised, tone === 'notice' && s.panelNotice]}>{children}</View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.muted}>{label}</Text></View>; }

function JourneyProgress({ stage, hasProfile, hasAnalysis, busy, onOpen }: { stage: JourneyStage; hasProfile: boolean; hasAnalysis: boolean; busy: boolean; onOpen: (step: JourneyStep) => void }) {
  return <View style={s.steps}>{journeySteps.map((step, index) => {
    const status = journeyStepState(step.id, stage, hasProfile, hasAnalysis);
    const available = canOpenJourneyStep(step.id, hasProfile, hasAnalysis);
    return <Pressable key={step.id} accessibilityRole="button" accessibilityLabel={`${step.label}: ${status}`} accessibilityState={{ selected: status === 'current', disabled: busy || !available }} disabled={busy || !available} onPress={() => onOpen(step.id)} style={[s.step, status === 'current' && s.stepCurrent, status === 'complete' && s.stepComplete, status === 'locked' && s.stepLocked]}>
      <Text style={[s.stepNumber, status === 'current' && s.stepTextCurrent]}>{status === 'complete' ? '✓' : String(index + 1).padStart(2, '0')}</Text><View style={{ flex: 1, gap: 2 }}><Text style={[s.stepText, status === 'current' && s.stepTextCurrent]}>{step.label}</Text><Text style={s.stepDescription}>{status === 'complete' ? 'Complete — revisit anytime' : step.description}</Text></View>
    </Pressable>;
  })}</View>;
}

function ReadinessSummary({ readiness }: { readiness: NonNullable<DashboardOut['readiness']> }) {
  return <Panel tone="raised"><Text style={s.eyebrow}>DETERMINISTIC ROLE ALIGNMENT</Text><Text style={s.cardTitle}>Evidence-based readiness</Text><Text style={s.note}>This is an informational measure of recorded evidence against the selected role. It is not an employment probability.</Text><View style={s.readinessLayout}><ScoreRing value={readiness.measurable ? readiness.alignment * 100 : null} label="Role alignment" /><View style={s.readinessDetails}><Text style={s.note}>{readiness.label}</Text><View accessibilityRole="progressbar" accessibilityLabel="Role alignment" accessibilityValue={readiness.measurable ? { min: 0, max: 100, now: Math.round(readiness.alignment * 100) } : { text: 'Not yet measurable' }} style={s.track}><View style={[s.fill, { width: `${Math.max(0, Math.min(1, readiness.alignment)) * 100}%` }]} /></View><View style={s.metricRow}><Metric label="Evidence coverage" value={pct(readiness.evidence_coverage)} /><Metric label="Confidence" value={pct(readiness.confidence)} /></View></View></View><View style={s.driverList}>{readiness.drivers.map((driver, index) => <Text style={s.note} key={index}>• {driver}</Text>)}</View><Text style={s.disclaimer}>{readiness.disclaimer}</Text></Panel>;
}

export default function HomeScreen() {
  const [stage, setStage] = useState<JourneyStage>('profile');
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
    try { await work(); if (requestGate.current.isCurrent(requestId)) setError(null); }
    catch (cause) {
      if (!requestGate.current.isCurrent(requestId)) return;
      setError(cause instanceof ApiError ? `${cause.message} (${cause.code})` : cause instanceof Error ? cause.message : 'Something went wrong.');
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
      setIds({ student_id: target.student_id, job_id: target.job.id }); setProfile(student); setRole(target.job); setTargetTitle(target.job.title); setTargetRequirements(''); setAnalysis(target); setRoadmap([]); setStage('analysis');
    });
    return () => { active = false; };
  }, [run, start]));

  const analyze = () => { if (!ids) return; void run(async () => { const result = await careerApi.analyze(ids.student_id, ids.job_id); setAnalysis(result); setStage('analysis'); }); };
  const loadRoadmap = () => { if (!ids) return; void run(async () => { const tasks = analysis ? await jobsApi.roadmap(ids.student_id, analysis.id) : await careerApi.roadmap(ids.student_id); setRoadmap(tasks); setStage('roadmap'); }); };
  const saveTargetRole = () => { if (!ids || !targetTitle.trim()) return; void run(async () => { const selected = await careerApi.customRole(targetTitle.trim(), targetRequirements.trim()); setRole(selected); setIds({ ...ids, job_id: selected.id }); setAnalysis(null); setRoadmap([]); setStage('profile'); }); };
  const reset = () => { setError(null); setRetry(null); setIds(null); setProfile(null); setRole(null); setAnalysis(null); setRoadmap([]); start(); };
  const inputSaved = async (saved: ProfileOut) => {
    const selected = ids ?? await careerApi.journey(); const targetRole = role ?? await careerApi.role(selected.job_id);
    setIds({ student_id: saved.student.id, job_id: selected.job_id }); setRole(targetRole); setTargetTitle(targetRole.title); setProfile(saved); setAnalysis(null); setRoadmap([]); setStage('profile');
  };
  const openStep = (step: JourneyStep) => { if (step === 'roadmap') loadRoadmap(); else setStage(step); };
  const stageTitle = stage === 'input' ? 'Update your profile' : stage === 'profile' ? 'Build your career foundation' : stage === 'analysis' ? 'Understand your role alignment' : 'Turn gaps into a learning plan';
  const stageDescription = stage === 'input' ? 'Upload a text-based PDF or DOCX, review what was detected, then save only the details you confirm.' : stage === 'profile' ? 'Confirm your evidence and set the target role you want to work toward.' : stage === 'analysis' ? 'Review the deterministic evidence comparison, then focus on the most important gaps.' : 'Use the deterministic roadmap first. Add an optional AI plan only with your consent.';

  return <SafeAreaView edges={['bottom']} style={s.root}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.top}><View style={{ gap: 6 }}><Text style={s.brand}>MY CAREER PLAN</Text><Text style={s.pageTitle}>Your journey, in one place</Text></View><Text style={s.mode}>STUDENT WORKSPACE</Text></View>
    <JourneyProgress stage={stage} hasProfile={!!profile} hasAnalysis={!!analysis} busy={busy} onOpen={openStep} />
    <View style={s.intro}><Text style={s.eyebrow}>{stage === 'analysis' ? '02 / ROLE ALIGNMENT' : stage === 'roadmap' ? '03 / LEARNING ROADMAP' : '01 / PROFILE'}</Text><Text style={s.heading}>{stageTitle}</Text><Text style={s.note}>{stageDescription}</Text></View>
    {error && <Panel tone="notice"><Text accessibilityRole="alert" style={s.errorTitle}>We could not complete that request</Text><Text style={s.note}>{error}</Text>{retry && <Action title="Try again" secondary onPress={retry} />}</Panel>}
    {busy && <View style={s.loading}><ActivityIndicator size="large" color={d.accent} /><Text style={s.muted}>Saving your progress safely…</Text></View>}
    {stage === 'input' && <JourneyInput onSaved={inputSaved} onCancel={() => setStage('profile')} />}
    {stage !== 'input' && stage !== 'roadmap' && session.getStudentId() && <Action title={profile ? 'Update profile details' : 'Add profile details'} secondary onPress={() => setStage('input')} disabled={busy} />}
    {stage === 'profile' && profile && <DocumentReview onApplied={saved => { setProfile(saved); setAnalysis(null); }} />}
    {stage === 'profile' && profile && role && <>
      <Panel tone="raised"><Text style={s.eyebrow}>{profile.student.is_synthetic ? 'SYNTHETIC STUDENT PROFILE' : 'CONFIRMED PROFILE'}</Text><Text style={s.cardTitle}>{profile.student.name}</Text><Text style={s.note}>{profile.student.program || 'Program not recorded'} · {profile.student.specialization || 'Specialization not recorded'}</Text><View style={s.profileFacts}><Metric label="Student ID" value={profile.student.student_id} /><Metric label="CGPA" value={profile.student.cgpa?.toString() ?? 'Not recorded'} /><Metric label="Evidence records" value={String(profile.evidence.length)} /></View></Panel>
      <Panel><Text style={s.eyebrow}>SAVED SKILL EVIDENCE</Text><Text style={s.cardTitle}>Confirmed competencies</Text><Text style={s.note}>These competencies are saved to your profile. Levels without sufficient evidence remain unknown rather than assumed.</Text>{profile.competencies.length ? <BarChart max={5} unit="/5" rows={profile.competencies.map(item => ({ label: item.skill.canonical_name, value: item.level }))} /> : <View style={s.empty}><Text style={s.note}>No confirmed skill evidence yet. Upload a document to review detected skills before saving.</Text></View>}</Panel>
      <Panel><Text style={s.eyebrow}>TARGET ROLE</Text><Text style={s.cardTitle}>Choose what to align toward</Text><Text style={s.note}>Use an existing role title or describe a new one. Requirements are optional, but help make a custom role more specific.</Text><Text style={s.fieldLabel}>Desired role</Text><TextInput accessibilityLabel="Desired role" value={targetTitle} onChangeText={setTargetTitle} maxLength={200} placeholder="Enter your desired role" placeholderTextColor={d.muted} style={s.roleInput} /><Text style={s.fieldLabel}>Role requirements (optional)</Text><TextInput accessibilityLabel="Role requirements" value={targetRequirements} onChangeText={setTargetRequirements} maxLength={20000} multiline placeholder="For a custom role, add relevant skills or role requirements." placeholderTextColor={d.muted} style={[s.roleInput, s.requirementsInput]} /><Text style={s.muted}>{role.skills.length} competencies in the selected role profile</Text><Action title="Save target role" onPress={saveTargetRole} disabled={busy || !targetTitle.trim()} /></Panel>
      <Panel tone="raised"><Text style={s.cardTitle}>Ready to check alignment?</Text><Text style={s.note}>SkillUp compares confirmed evidence with your selected role and keeps unknown levels distinct from missing skills.</Text><Action title="Analyze role alignment" onPress={analyze} disabled={busy} /></Panel>
    </>}
    {stage === 'analysis' && analysis && <>
      <ReadinessSummary readiness={analysis.readiness} />
      <Panel><Text style={s.eyebrow}>PRIORITY GAPS</Text><Text style={s.cardTitle}>What to work on next</Text><Text style={s.note}>Priorities reflect the selected role requirements and the evidence currently saved in your profile.</Text>{analysis.gaps.length === 0 ? <View style={s.empty}><Text style={s.note}>No measurable gaps were identified from current evidence. You can revisit your profile if more skills or evidence should be recorded.</Text></View> : <SkillGapChart gaps={analysis.gaps} />}</Panel>
      {analysis.warnings.length > 0 && <Panel tone="notice"><Text style={s.eyebrow}>ANALYSIS NOTES</Text>{analysis.warnings.map((warning, index) => <Text style={s.note} key={index}>• {warning}</Text>)}</Panel>}
      <Panel tone="raised"><Text style={s.cardTitle}>Create your learning roadmap</Text><Text style={s.note}>Build a deterministic roadmap from this alignment, then decide whether you want optional Gemini guidance.</Text><Action title="Build learning roadmap" onPress={loadRoadmap} disabled={busy} /></Panel>
    </>}
    {stage === 'roadmap' && <CareerRoadmap items={roadmap} onChange={setRoadmap} analysisId={analysis?.id} />}
    <Action title="Reset demo" onPress={reset} secondary disabled={busy} />
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: d.canvas }, content: { padding: 24, paddingTop: 36, paddingBottom: 48, width: '100%', maxWidth: 960, alignSelf: 'center', gap: 20 }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }, brand: { fontSize: 11, fontWeight: '600', letterSpacing: 1.7, color: d.muted }, pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '500', color: d.text, letterSpacing: -0.5 }, mode: { fontSize: 10, letterSpacing: 1, color: d.muted, borderWidth: 1, borderColor: d.border, borderRadius: 4, padding: 8 },
  steps: { gap: 8 }, step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 56, padding: 12, borderWidth: 1, borderColor: d.border, borderRadius: 8, backgroundColor: d.canvas }, stepCurrent: { borderColor: d.accent, backgroundColor: d.elevated }, stepComplete: { borderColor: d.strongBorder }, stepLocked: { opacity: 0.52 }, stepNumber: { width: 28, color: d.muted, fontSize: 12, fontWeight: '600', lineHeight: 20 }, stepText: { color: d.body, fontSize: 14, fontWeight: '600', lineHeight: 20 }, stepTextCurrent: { color: d.text }, stepDescription: { color: d.muted, fontSize: 12, lineHeight: 17 },
  intro: { gap: 8, paddingTop: 8 }, heading: { fontSize: 34, lineHeight: 40, fontWeight: '500', color: d.text, letterSpacing: -0.8 }, panel: { backgroundColor: d.canvas, padding: 20, gap: 14, borderWidth: 1, borderColor: d.border, borderRadius: 10 }, panelRaised: { backgroundColor: d.elevated }, panelNotice: { borderColor: d.strongBorder }, eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 1.35, color: d.muted }, cardTitle: { fontSize: 22, lineHeight: 28, fontWeight: '500', color: d.text, letterSpacing: -0.25 }, muted: { color: d.muted, fontSize: 12, lineHeight: 19 }, note: { color: d.body, fontSize: 14, lineHeight: 22 }, fieldLabel: { color: d.body, fontSize: 12, fontWeight: '600' },
  button: { backgroundColor: d.accent, paddingVertical: 14, paddingHorizontal: 18, borderRadius: d.controlRadius, alignItems: 'center', minHeight: 48, justifyContent: 'center' }, buttonSecondary: { backgroundColor: d.canvas, borderWidth: 1, borderColor: d.strongBorder }, buttonText: { fontWeight: '600', color: d.text, fontSize: 14, textAlign: 'center' }, secondaryText: { color: d.body }, profileFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { flexGrow: 1, flexBasis: 120, backgroundColor: d.canvas, padding: 12, borderRadius: 6, gap: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: d.border }, metricValue: { fontSize: 20, color: d.text, fontWeight: '500', letterSpacing: -0.3 },
  readinessLayout: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, alignItems: 'center' }, readinessDetails: { flex: 1, minWidth: 220, gap: 12 }, track: { height: 6, borderRadius: 3, backgroundColor: d.border, overflow: 'hidden' }, fill: { height: 6, backgroundColor: d.accent }, driverList: { gap: 5 }, disclaimer: { fontSize: 12, lineHeight: 19, color: d.muted }, empty: { padding: 14, borderRadius: 6, backgroundColor: d.elevated }, loading: { alignItems: 'center', padding: 16, gap: 10 }, errorTitle: { fontSize: 17, fontWeight: '600', color: d.error }, roleInput: { minHeight: 48, borderWidth: 1, borderColor: d.strongBorder, borderRadius: 6, color: d.text, backgroundColor: d.elevated, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 }, requirementsInput: { minHeight: 112, textAlignVertical: 'top' },
});
