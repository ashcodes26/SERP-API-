import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { Action, Card, ui } from '@/components/career-ui';
import { ApplicationCard, Choices, ReviewCard, TrainingCard } from '@/components/placement-ui';
import { careerApi, resumeApi, session, type QuestionSet } from '@/api/client';
import { placementApi } from '@/api/placement';
import type * as C from '@/types/contracts';

export default function Placement() {
  const [faculty, setFaculty] = useState<C.AccountOut[]>([]);
  const [resumes, setResumes] = useState<C.ResumeWorkspaceOut[]>([]);
  const [reviews, setReviews] = useState<C.FacultyReviewOut[]>([]);
  const [drives, setDrives] = useState<C.DriveOut[]>([]);
  const [applications, setApplications] = useState<C.ApplicationOut[]>([]);
  const [training, setTraining] = useState<C.TrainingOut[]>([]);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [facultyId, setFacultyId] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [shareAi, setShareAi] = useState(false);
  const [history, setHistory] = useState<C.ResumeRevisionOut[]>([]);
  const [quiz, setQuiz] = useState<QuestionSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setBusy(false); }
  }, []);
  const load = useCallback(async () => {
    const [f, r, rv, d, a, t] = await Promise.all([placementApi.faculty(), resumeApi.list(), placementApi.reviews(), placementApi.drives(), placementApi.applications(), placementApi.training()]);
    setFaculty(f); setResumes(r); setReviews(rv); setDrives(d); setApplications(a); setTraining(t);
  }, []);
  useFocusEffect(useCallback(() => { void run(load); }, [load, run]));
  const selected = resumes.find(x => x.id === resumeId);
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled"><Text style={ui.kicker}>YOUR PLACEMENT WORKSPACE</Text><Text style={ui.title}>Opportunities and faculty support</Text>
    <Text style={ui.muted}>Your saved evidence stays private until you explicitly share a resume revision. Faculty approval is separate from factual verification. Placement stages are explicit updates, separate from readiness.</Text>
    {busy && <ActivityIndicator/>}{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{!!message && <Text style={ui.body}>{message}</Text>}<Action secondary disabled={busy} onPress={() => void run(load)}>Refresh placement workspace</Action>
    <Card><Text style={ui.heading}>Share a saved resume revision</Text><Link href="/resume" style={ui.body}>Open Resume workspace to save or revise your resume</Link>
      {!faculty.length && <Text style={ui.body}>No faculty member is assigned to you yet. Contact your placement coordinator.</Text>}
      <Choices label="Saved resume" values={resumes.map(x => ({ value: x.id, label: `${x.filename} · revision ${x.version}` }))} selected={resumeId} onSelect={id => { setResumeId(id); setConsent(false); setHistory([]); }}/>
      <Choices label="Assigned faculty" values={faculty.map(x => ({ value: x.account_id, label: x.username }))} selected={facultyId} onSelect={setFacultyId}/>
      {selected && <><Text selectable style={ui.body}>{selected.revised_text}</Text><Action secondary disabled={busy} onPress={() => void run(async () => setHistory(await placementApi.revisions(selected.id)))}>View saved revision history</Action>{history.map(x => <Card key={x.id}><Text style={ui.muted}>Saved revision {x.version} · {new Date(x.created_at).toLocaleString()}</Text><Text selectable style={ui.body}>{x.text}</Text></Card>)}</>}
      <Choices label="Sharing consent" values={[{ value: 'no', label: 'Keep private' }, { value: 'yes', label: 'Share this saved revision with selected faculty' }]} selected={consent ? 'yes' : 'no'} onSelect={v => setConsent(v === 'yes')}/>
      <Choices label="Stored Gemini feedback sharing" values={[{ value: 'no', label: 'Do not share suggestions' }, { value: 'yes', label: 'Also share stored suggestions' }]} selected={shareAi ? 'yes' : 'no'} onSelect={v => setShareAi(v === 'yes')}/>
      <Action disabled={busy || !selected || !facultyId || !consent} onPress={() => void run(async () => { await placementApi.share({ workspace_id: selected!.id, version: selected!.version, admin_id: facultyId!, consent, share_suggestions: shareAi }); await load(); setConsent(false); setMessage('Saved revision shared with your selected faculty member.'); })}>Submit saved revision for review</Action>
    </Card>
    <Text style={ui.heading}>Faculty resume feedback</Text>{reviews.length ? reviews.map(x => <ReviewCard key={x.id} review={x} onUpdated={load}/>) : <Text style={ui.body}>No revisions submitted for faculty review.</Text>}
    <Text style={ui.heading}>Placement drives</Text>{drives.length ? drives.map(x => <Card key={x.id}><Text style={ui.heading}>{x.company} · {x.role}</Text><Text style={ui.body}>{x.description}</Text><Text style={ui.muted}>Deadline {x.deadline} · Eligibility {x.decision?.status.replace('_', ' ')}</Text>{x.decision?.reasons.map((reason, i) => <Text key={i} style={ui.body}>{reason}</Text>)}
      <Action secondary onPress={() => void run(async () => { await Linking.openURL(x.application_link); })}>Open application link</Action><Text style={ui.muted}>Apply using the company link, then record your application below. Missing or unmet eligibility is visible to faculty for review.</Text>
      <Action disabled={busy || applications.some(a => a.drive_id === x.id)} onPress={() => void run(async () => { await placementApi.apply(x.id); await load(); })}>{applications.some(a => a.drive_id === x.id) ? 'Application tracked' : 'Record that I applied'}</Action></Card>) : <Text style={ui.body}>No opportunities have been assigned to your cohort.</Text>}
    <Text style={ui.heading}>Your applications</Text>{applications.length ? applications.map(x => <ApplicationCard key={`${x.id}-${x.version}`} item={x} onUpdated={load}/>) : <Text style={ui.body}>No applications recorded.</Text>}
    <Text style={ui.heading}>Faculty training assignments</Text>{training.length ? training.map(x => <TrainingCard key={`${x.id}-${x.version}`} item={x} student onUpdated={load} onAssessment={id => void run(async () => { setQuiz(await careerApi.questions(id)); setAnswers({}); })}/>) : <Text style={ui.body}>No training assignments yet.</Text>}
    {quiz && <Card><Text style={ui.heading}>{quiz.skill} assessment</Text>{quiz.questions.map(q => <View key={q.id} style={{ gap: 12 }}><Text style={ui.body}>{q.prompt}</Text><Choices label={`Answer ${q.id}`} values={q.options.map(value => ({ value, label: value }))} selected={answers[q.id] ?? null} onSelect={value => setAnswers(x => ({ ...x, [q.id]: value }))}/></View>)}
      <Action disabled={busy || quiz.questions.some(q => !answers[q.id])} onPress={() => void run(async () => { const result = await careerApi.submit({ student_id: session.getStudentId()!, skill_id: quiz.skill_id, question_set_version: quiz.question_set_version, answers }); setQuiz(null); await load(); setMessage(`Assessment saved: ${Math.round(result.score*100)}%. You can now submit training evidence.`); })}>Submit assigned assessment</Action><Action secondary onPress={() => setQuiz(null)}>Close assessment</Action>
    </Card>}
  </ScrollView>;
}
