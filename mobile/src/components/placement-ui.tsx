import { useState } from 'react';
import { Text, TextInput, View, Pressable, Linking } from 'react-native';
import { Action, Card, Details, ui } from './career-ui';
import { placementApi } from '@/api/placement';
import type { ApplicationOut, ApplicationStage, DriveIn, DriveOut, FacultyReviewOut, TrainingOut } from '@/types/contracts';

export function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} style={ui.input} autoCapitalize="none" /></View>;
}
export function Choices<T extends string | number>({ label, values, selected, onSelect }: { label: string; values: { value: T; label: string }[]; selected: T | null; onSelect: (value: T) => void }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text><View style={ui.row}>{values.map(x => <Pressable key={x.value} accessibilityRole="button" accessibilityState={{ selected: selected === x.value }} onPress={() => onSelect(x.value)} style={[ui.chip, selected === x.value && ui.selected]}><Text style={ui.muted}>{x.label}</Text></Pressable>)}</View></View>;
}
export function ReviewCard({ review, admin = false, onUpdated }: { review: FacultyReviewOut; admin?: boolean; onUpdated: () => Promise<void> }) {
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(status: 'approved' | 'changes_requested') {
    setBusy(true); setError('');
    try { await placementApi.review(review.id, { status, feedback }); await onUpdated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Review failed'); }
    finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true); setError('');
    try { await placementApi.revoke(review.id); await onUpdated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not revoke sharing'); }
    finally { setBusy(false); }
  }
  return <Card><Text style={ui.heading}>Revision {review.version} · {review.status.replace('_', ' ')}</Text><Text style={ui.muted}>Resume {review.workspace_id} · {new Date(review.created_at).toLocaleString()} · {review.shared ? 'Shared' : 'Sharing revoked'}</Text>
    <Text style={ui.muted}>{review.disclaimer}</Text><Details label="Read shared revision"><Text selectable style={ui.body}>{review.text}</Text></Details>
    {review.suggestions && <Details label="Student-shared stored Gemini feedback"><Text style={ui.body}>{review.suggestions.ai_review?.feedback?.summary}</Text>{review.suggestions.suggestions.map(x => <Text key={x.id} style={ui.body}>{x.original} → {x.proposed}</Text>)}<Text style={ui.muted}>Stored suggestions, subject to student review. No AI request is made here.</Text></Details>}
    {review.feedback.map(x => <View key={x.id}><Text style={ui.muted}>{x.status.replace('_', ' ')} · {new Date(x.created_at).toLocaleString()}</Text><Text selectable style={ui.body}>{x.feedback}</Text></View>)}
    {admin && review.status === 'submitted' && review.shared && <><Field label={`Feedback for review ${review.id}`} value={feedback} onChange={setFeedback} multiline /><View style={ui.row}><Action disabled={busy || !feedback.trim()} onPress={() => void decide('changes_requested')}>Request changes</Action><Action disabled={busy || !feedback.trim()} onPress={() => void decide('approved')}>Approve revision</Action></View></>}
    {!admin && review.shared && <Action secondary disabled={busy} onPress={() => void revoke()}>Revoke faculty sharing</Action>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </Card>;
}

export function ApplicationCard({ item, admin = false, onUpdated }: { item: ApplicationOut; admin?: boolean; onUpdated: () => Promise<void> }) {
  const [stage, setStage] = useState<ApplicationStage>(item.stage);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState<'unchanged' | 'eligible' | 'not_eligible'>('unchanged');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await placementApi.updateApplication(item.id, { version: item.version, stage, note, ...(override !== 'unchanged' ? { eligibility_override: override === 'eligible', review_reason: reason } : {}) }, admin); await onUpdated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Update failed'); }
    finally { setBusy(false); }
  }
  return <Card><Text style={ui.heading}>Application {item.id} · {item.stage}</Text><Text style={ui.muted}>Drive {item.drive_id} · Explicitly reported outcome</Text>
    <Details label="Application history">{item.history.map((x, i) => <Text style={ui.body} key={i}>{x.stage} · {new Date(x.created_at).toLocaleString()}{'\n'}{x.note}</Text>)}</Details>
    {item.eligibility_override !== null && <Text style={ui.body}>Faculty eligibility review: {item.eligibility_override ? 'eligible' : 'not eligible'} · {item.review_reason}</Text>}
    <Choices label={`Stage for application ${item.id}`} values={(['applied', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn'] as const).map(value => ({ value, label: value }))} selected={stage} onSelect={setStage} />
    <Field label={`Update note ${item.id}`} value={note} onChange={setNote} />
    {admin && <><Choices label="Faculty eligibility review" values={(['unchanged', 'eligible', 'not_eligible'] as const).map(value => ({ value, label: value.replace('_', ' ') }))} selected={override} onSelect={setOverride}/>{override !== 'unchanged' && <Field label="Eligibility review reason" value={reason} onChange={setReason} />}</>}
    <Action disabled={busy || (override !== 'unchanged' && !reason.trim())} onPress={() => void save()}>Save application update</Action>{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </Card>;
}

export function DriveEditor({ cohortId, initial, onSaved }: { cohortId: number; initial?: DriveOut; onSaved: () => Promise<void> }) {
  const [company, setCompany] = useState(initial?.company ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [link, setLink] = useState(initial?.application_link ?? '');
  const [cgpa, setCgpa] = useState(String(initial?.eligibility.min_cgpa ?? ''));
  const [department, setDepartment] = useState(initial?.eligibility.departments?.join(', ') ?? '');
  const [year, setYear] = useState(String(initial?.eligibility.graduation_year ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      const body: DriveIn = { cohort_id: cohortId, company, role, description, deadline, application_link: link,
        eligibility: { min_cgpa: cgpa ? Number(cgpa) : null, departments: department.split(',').map(x => x.trim()).filter(Boolean), graduation_year: year ? Number(year) : null } };
      if (initial) await placementApi.editDrive(initial.id, { ...body, version: initial.version }); else await placementApi.createDrive(body);
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Drive save failed'); }
    finally { setBusy(false); }
  }
  return <Card><Text style={ui.heading}>{initial ? `Edit drive ${initial.id}` : 'Create a placement drive'}</Text>
    <Field label="Company" value={company} onChange={setCompany}/><Field label="Drive role" value={role} onChange={setRole}/><Field label="Drive description" value={description} onChange={setDescription} multiline/>
    <Field label="Drive deadline (YYYY-MM-DD)" value={deadline} onChange={setDeadline}/><Field label="Application link" value={link} onChange={setLink}/>
    <Field label="Minimum CGPA (optional)" value={cgpa} onChange={setCgpa}/><Field label="Eligible departments (comma separated, optional)" value={department} onChange={setDepartment}/><Field label="Graduation year (optional)" value={year} onChange={setYear}/>
    <Action disabled={busy} onPress={() => void save()}>Save drive</Action>{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </Card>;
}

export function TrainingCard({ item, student = false, onUpdated, onAssessment }: { item: TrainingOut; student?: boolean; onUpdated: () => Promise<void>; onAssessment?: (id: number) => void }) {
  const [evidence, setEvidence] = useState(item.evidence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(status: 'in_progress' | 'completed') {
    setBusy(true); setError('');
    try { await placementApi.progress(item.id, { version: item.version, status, evidence }); await onUpdated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update training'); }
    finally { setBusy(false); }
  }
  async function open() { try { if (item.resource_url) await Linking.openURL(item.resource_url); } catch { setError('Could not open the resource URL'); } }
  return <Card><Text style={ui.heading}>{item.title}</Text><Text style={ui.muted}>{item.kind} · {item.status.replace('_', ' ')} · Due {item.deadline}</Text><Text style={ui.body}>{item.instructions}</Text>
    {item.resource_url && <Action secondary onPress={() => void open()}>Open learning resource</Action>}
    {student && item.kind === 'assessment' && item.skill_id && onAssessment && <Action secondary onPress={() => onAssessment(item.skill_id!)}>Take assigned assessment</Action>}
    {student ? <><Field label={`Evidence for assignment ${item.id}`} value={evidence} onChange={setEvidence} multiline/><View style={ui.row}><Action secondary disabled={busy} onPress={() => void save('in_progress')}>Mark in progress</Action><Action disabled={busy || !evidence.trim()} onPress={() => void save('completed')}>Submit completion evidence</Action></View></> : <Text selectable style={ui.body}>{item.evidence || 'No completion evidence submitted'}</Text>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </Card>;
}
