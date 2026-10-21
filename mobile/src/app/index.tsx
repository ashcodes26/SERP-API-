import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import CareerRoadmap from '@/components/career-roadmap';
import JourneyInput from '@/components/journey-input';
import DocumentReview from '@/components/document-review';
import AiExplanation from '@/components/ai-explanation';
import { Action, Card, ui } from '@/components/career-ui';
import { AlignmentPanel, EvidencePanel } from '@/components/career-plan-panels';
import { PersonalTasks } from '@/components/personal-tasks';
import { CareerPlanPage, cp, PlanIcon, PlanAction, PlanDetails, PlanField, PlanHeading, PlanSection, PlanTag, PlanTitle } from '@/components/career-plan-design';
import { design as d } from '@/constants/design';
import { ApiError, careerApi, jobsApi, session } from '@/api/client';
import type { AnalysisOut, DashboardOut, JobOut, ProfileOut, RoadmapItemOut } from '@/types/contracts';
import { createLatestRequestGate } from '@/utils/latest-request';
import type { JourneyStage } from '@/utils/journey-stage';

export default function HomeScreen() {
  const [stage, setStage] = useState<JourneyStage>('profile');
  const [ids, setIds] = useState<{ student_id: number; job_id: number } | null>(null);
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [role, setRole] = useState<JobOut | null>(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetRequirements, setTargetRequirements] = useState('');
  const [savedTarget, setSavedTarget] = useState<string | null>(null);
  const targetSignature = JSON.stringify([targetTitle.trim(), targetRequirements.trim()]);
  const targetSaved = savedTarget === targetSignature;
  const [analysis, setAnalysis] = useState<AnalysisOut | null>(null);
  const [snapshot, setSnapshot] = useState<DashboardOut | null>(null);
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
    const currentStudent = session.getStudentId();
    const selected = currentStudent ? { student_id: currentStudent } : await careerApi.journey();
    const [student, saved] = await Promise.all([careerApi.profile(selected.student_id), careerApi.dashboard(selected.student_id)]);
    const job = saved.target_job ?? await careerApi.journey().then(journey => careerApi.role(journey.job_id));
    if (!job) throw new Error('No saved target role was returned. Reload your journey to retry.');
    setIds({ student_id: selected.student_id, job_id: job.id }); setProfile(student); setRole(job); setTargetTitle(job.title); setTargetRequirements(''); setSavedTarget(saved.target_job ? JSON.stringify([job.title.trim(), '']) : null); setAnalysis(null); setSnapshot(saved); setRoadmap([]); setStage('profile');
  }), [run]);

  useFocusEffect(useCallback(() => {
    const target = session.takeTarget();
    if (!target) { start(); return; }
    let active = true;
    void run(async () => {
      const student = await careerApi.profile(target.student_id);
      if (!active) return;
      setIds({ student_id: target.student_id, job_id: target.job.id }); setProfile(student); setRole(target.job); setTargetTitle(target.job.title); setTargetRequirements(''); setSavedTarget(JSON.stringify([target.job.title.trim(), ''])); setAnalysis(target); setSnapshot(null); setRoadmap([]); setStage('analysis');
    });
    return () => { active = false; };
  }, [run, start]));

  const analyze = () => { if (!ids || !targetSaved || busy) return; void run(async () => { const result = await careerApi.analyze(ids.student_id, ids.job_id); setAnalysis(result); setSnapshot(null); setRoadmap([]); setStage('analysis'); }); };
  const loadRoadmap = () => { if (!ids) return; void run(async () => { const tasks = analysis ? await jobsApi.roadmap(ids.student_id, analysis.id) : await careerApi.roadmap(ids.student_id); setRoadmap(tasks); setStage('roadmap'); }); };
  const saveTargetRole = () => { if (!ids || !targetTitle.trim() || busy) return; setSavedTarget(null); void run(async () => { const selected = await careerApi.customRole(targetTitle.trim(), targetRequirements.trim()); setRole(selected); setIds({ ...ids, job_id: selected.id }); setSavedTarget(targetSignature); setAnalysis(null); setSnapshot(null); setRoadmap([]); setStage('profile'); }); };
  const reset = () => { setError(null); setRetry(null); setIds(null); setProfile(null); setRole(null); setSavedTarget(null); setAnalysis(null); setSnapshot(null); setRoadmap([]); start(); };
  const inputSaved = async (saved: ProfileOut) => {
    const selected = ids ?? await careerApi.journey(); const targetRole = role ?? await careerApi.role(selected.job_id);
    setIds({ student_id: saved.student.id, job_id: selected.job_id }); setRole(targetRole); setTargetTitle(targetRole.title); setSavedTarget(null); setProfile(saved); setAnalysis(null); setRoadmap([]); setStage('profile');
  };
  return <CareerPlanPage>
    <View style={{ gap: 12 }}><View style={cp.spread}><View style={{ flex: 1, minWidth: 220, gap: 6 }}><PlanTitle>My Career Plan</PlanTitle><Text style={[cp.body, { color: d.muted }]}>Map your saved evidence and competencies to target industry roles, evaluate skill gaps, and execute your deterministic roadmap.</Text></View><PlanTag tone={profile?.student.is_synthetic ? 'warning' : 'neutral'}>{profile ? profile.student.is_synthetic ? '● Synthetic profile · editable workspace' : 'Saved student workspace' : 'Loading workspace…'}</PlanTag></View>
    <View style={cp.notice}><PlanIcon name="info" size={16} /><Text style={[cp.small, { flex: 1 }]}><Text style={{ color: d.body, fontWeight: '600' }}>Audit Notice: </Text>Readiness is informational guidance based on saved profile evidence and role requirements, not an automated placement guarantee or ATS certification. Your private documents require explicit sharing.</Text></View></View>
    {error && <Card><Text accessibilityRole="alert" style={ui.error}>We could not complete that request</Text><Text style={ui.body}>{error}</Text>{retry && <Action secondary onPress={retry}>Try again</Action>}</Card>}
    {busy && <View style={cp.row}><ActivityIndicator color={d.accent} /><Text style={cp.small}>Working on your request…</Text></View>}
    {stage === 'input' ? <JourneyInput onSaved={inputSaved} onCancel={() => setStage('profile')} /> : <>
      {profile && <EvidencePanel profile={profile} busy={busy} onUpdate={() => setStage('input')}><DocumentReview onApplied={saved => { setProfile(saved); setAnalysis(null); setRoadmap([]); }} /></EvidencePanel>}
      {!profile && !busy && <PlanSection><Text style={cp.body}>Load your saved journey to view your profile and competencies.</Text>{!!session.getStudentId() && <PlanAction secondary onPress={() => setStage('input')}>Add profile details</PlanAction>}</PlanSection>}
      {profile && role && <PlanSection>
        <PlanHeading title="Target Role Specification" description="Define or update the role target for deterministic alignment analysis." aside={<PlanTag tone={targetSaved ? 'success' : 'warning'}>● Target status: {targetSaved ? 'Saved' : 'Save required'}</PlanTag>} />
        <PlanField label="Role Title & Track" value={targetTitle} onChange={value => { setTargetTitle(value); setSavedTarget(null); }} disabled={busy} maxLength={200} placeholder="Enter your desired role" />
        <View style={{ gap: 6 }}><Text style={cp.label}>Parsed Role Requirements & Stack Requirements</Text><View style={{ backgroundColor: d.canvas, borderWidth: 1, borderColor: d.border, borderRadius: 4, padding: 12, gap: 6, minHeight: 76 }}>{(['required', 'preferred'] as const).map(kind => {
          const skills = role.skills.filter(item => item.requirement_type === kind);
          return skills.length > 0 ? <Text key={kind} style={cp.small}><Text style={{ color: kind === 'required' ? d.highlight : d.body }}>{kind === 'required' ? 'CORE REQUIREMENTS: ' : 'PREFERRED: '}</Text>{skills.map(item => `${item.skill.canonical_name} (${item.expected_level === null ? 'unknown requirement' : `${item.expected_level}/5`})`).join(', ')}</Text> : null;
        })}{role.skills.length === 0 && <Text style={cp.small}>No recognized requirements. Add relevant skills below before saving.</Text>}<PlanDetails label={targetRequirements ? 'Edit custom role requirements · unsaved changes' : 'Edit custom role requirements (optional)'}><PlanField label="Role requirements (optional)" value={targetRequirements} onChange={value => { setTargetRequirements(value); setSavedTarget(null); }} disabled={busy} multiline placeholder="Add relevant skills or role requirements." /></PlanDetails></View></View>
        <View style={cp.spread}><Text accessibilityLiveRegion="polite" style={[cp.small, { flex: 1, minWidth: 180, color: targetSaved ? d.successText : d.muted }]}>{targetSaved ? '⊙ Target saved in current workspace' : 'Save this target before running alignment.'}</Text><View style={[cp.row, { gap: 12 }]}><PlanAction secondary onPress={reset} disabled={busy}>Reload saved journey</PlanAction><PlanAction secondary onPress={saveTargetRole} disabled={busy || !targetTitle.trim() || targetSaved}>Save target role</PlanAction><PlanAction icon="chart" onPress={analyze} disabled={busy || !targetSaved}>Analyze alignment</PlanAction></View></View>
      </PlanSection>}
      <AlignmentPanel analysis={targetSaved ? analysis : null} snapshot={targetSaved ? snapshot : null}>{analysis && targetSaved && <PlanDetails label="Request or view a grounded explanation"><AiExplanation key={`readiness:${analysis.id}`} path={`/api/ai/readiness/${analysis.id}`} label="Explain role readiness" notice="Sends saved role requirements, deterministic gaps, skill levels and approved evidence references." /></PlanDetails>}</AlignmentPanel>
      <PlanSection>
        <PlanHeading title={`Target Roadmap${role ? `: ${role.title}` : ''}`} description={!roadmap.length && snapshot?.next_action && targetSaved ? `Saved progress: ${snapshot.roadmap_progress.done ?? 0} completed · ${snapshot.roadmap_progress.in_progress ?? 0} in progress · ${snapshot.roadmap_progress.not_started ?? 0} not started` : roadmap.length ? `${roadmap.filter(item => item.status === 'done').length} of ${roadmap.length} milestones completed · ${roadmap.filter(item => item.status === 'in_progress').length} in progress` : 'A resource-backed learning timeline based on your saved role analysis.'} aside={<PlanAction disabled={busy || (!analysis && !snapshot?.readiness) || !targetSaved} onPress={loadRoadmap}>{roadmap.length ? 'Reload roadmap' : 'Build learning roadmap'}</PlanAction>} />
        {targetSaved && stage === 'roadmap' ? <CareerRoadmap compact items={roadmap} onChange={setRoadmap} analysisId={analysis?.id} /> : snapshot?.next_action && targetSaved ? <><Text style={cp.small}>Next saved milestone. Use Build learning roadmap to load the full timeline; this may retrieve learning resources.</Text><CareerRoadmap compact items={[snapshot.next_action]} onChange={() => { if (ids) void run(async () => setSnapshot(await careerApi.dashboard(ids.student_id))); }} /></> : <View style={[cp.divider, { minHeight: 110 }]}><Text style={cp.body}>{analysis && targetSaved ? 'Your role analysis is ready. Build the learning roadmap to create milestones and find resources.' : 'Analyze your saved target role to build a roadmap. No milestones have been loaded.'}</Text><Text style={cp.small}>Progress is self-recorded. Completing a milestone does not change assessed competency scores.</Text></View>}
      </PlanSection>
    </>}
    {profile && stage !== 'input' && <PersonalTasks compact />}
    {stage === 'input' && <PlanAction onPress={reset} secondary disabled={busy}>Reload saved journey</PlanAction>}
  </CareerPlanPage>;
}
