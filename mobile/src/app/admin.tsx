import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Action, Card, Details, ui } from '@/components/career-ui';
import { ApplicationCard, Choices, DriveEditor, Field, ReviewCard, TrainingCard } from '@/components/placement-ui';
import { placementApi } from '@/api/placement';
import { downloadResume } from '@/utils/resume-download';
import type * as C from '@/types/contracts';

type Tab = 'Overview' | 'Students' | 'Skill gaps' | 'Drives' | 'Training';
export default function Admin() {
  const params = useLocalSearchParams<{ student?: string }>();
  const [tab, setTab] = useState<Tab>('Overview');
  const [cohorts, setCohorts] = useState<C.CohortOut[]>([]);
  const [roles, setRoles] = useState<C.JobOut[]>([]);
  const [dashboard, setDashboard] = useState<C.PlacementDashboardOut | null>(null);
  const [students, setStudents] = useState<C.PlacementStudentsOut | null>(null);
  const [detail, setDetail] = useState<C.PlacementDetailOut | null>(null);
  const [drives, setDrives] = useState<C.DriveOut[]>([]);
  const [editDrive, setEditDrive] = useState<C.DriveOut | null>(null);
  const [filter, setFilter] = useState<C.PlacementFilter>({});
  const [applied, setApplied] = useState<C.PlacementFilter>({});
  const [page, setPage] = useState(1);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [gaps, setGaps] = useState<C.BatchGapOut | null>(null);
  const [drill, setDrill] = useState<number[] | null>(null);
  const [cohortForm, setCohortForm] = useState<C.CohortIn>({ name: '', department: '', batch: '', section: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [training, setTraining] = useState({ title: '', kind: 'project' as C.TrainingIn['kind'], instructions: '', resource_url: '', deadline: '', skill_id: null as number | null, roadmap_item_id: null as number | null });
  const [assignee, setAssignee] = useState<'cohort' | 'student'>('cohort');
  const selectedStudent = Number(params.student) || null;
  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (err) { setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setBusy(false); }
  }, []);
  const load = useCallback(async () => {
    const [c, r, d, list, opportunities] = await Promise.all([placementApi.cohorts(), placementApi.roles(), placementApi.dashboard(applied), placementApi.students(applied, page), placementApi.adminDrives()]);
    setCohorts(c); setRoles(r); setDashboard(d); setStudents(list); setDrives(opportunities);
    if (selectedStudent) setDetail(await placementApi.detail(selectedStudent)); else setDetail(null);
  }, [applied, page, selectedStudent]);
  useFocusEffect(useCallback(() => { void run(load); }, [run, load]));
  const openStudent = (id: number) => { setDetail(null); router.setParams({ student: String(id) }); setTab('Students'); };
  async function createCohort() { await placementApi.createCohort(cohortForm); await load(); setMessage('Cohort saved. Import students into it, or grant existing students with the local setup command.'); }
  async function assign() {
    if (assignee === 'cohort' && !filter.cohort_id) throw new Error('Select a cohort first');
    if (assignee === 'student' && !selectedStudent) throw new Error('Open a student first');
    await placementApi.assign({ student_ids: assignee === 'student' && selectedStudent ? [selectedStudent] : [], ...(assignee === 'cohort' ? { cohort_id: filter.cohort_id } : {}),
      title: training.title, kind: training.kind, instructions: training.instructions, deadline: training.deadline,
      ...(training.resource_url ? { resource_url: training.resource_url } : {}), ...(training.skill_id ? { skill_id: training.skill_id } : {}), ...(training.roadmap_item_id ? { roadmap_item_id: training.roadmap_item_id } : {}) });
    await load(); setMessage('Training assignments saved for the selected assignees.');
  }
  const skills = [...new Map(roles.flatMap(x => x.skills).map(x => [x.skill.id, x.skill])).values()];
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Text style={ui.kicker}>PLACEMENT FACULTY</Text><Text style={ui.title}>Your assigned students</Text><Text style={ui.muted}>Faculty access is limited to explicitly assigned students. Readiness is informational; offers come from explicit application updates.</Text>
    <Choices label="Faculty views" values={(['Overview', 'Students', 'Skill gaps', 'Drives', 'Training'] as const).map(value => ({ value, label: value }))} selected={tab} onSelect={setTab}/>
    {busy && <ActivityIndicator accessibilityLabel="Loading faculty data"/>}{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{!!message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}
    <Choices label="Cohort" values={[{ value: 0, label: 'All assigned students' }, ...cohorts.map(x => ({ value: x.id, label: `${x.name} (${x.students})` }))]} selected={filter.cohort_id ?? 0} onSelect={id => { setFilter(x => ({ ...x, cohort_id: id || undefined })); setGaps(null); setDrill(null); }}/>
    <Details label="Search and cohort filters"><Field label="Search name or student ID" value={filter.q ?? ''} onChange={q => setFilter(x => ({ ...x, q }))}/><View style={{ gap: 12 }}>{(['department', 'batch', 'section'] as const).map(key => <Field key={key} label={`Filter ${key}`} value={filter[key] ?? ''} onChange={value => setFilter(x => ({ ...x, [key]: value }))}/>)}</View>
      <Choices label="Progress filter" values={[{ value: '', label: 'All progress' }, { value: 'follow_up', label: 'Needs follow-up' }, { value: 'complete', label: 'No follow-up flags' }]} selected={filter.progress ?? ''} onSelect={progress => setFilter(x => ({ ...x, progress: progress as C.PlacementFilter['progress'] }))}/>
    </Details><View style={ui.row}><Action disabled={busy} onPress={() => { setPage(1); setApplied({ ...filter }); }}>Apply filters</Action><Action secondary disabled={busy} onPress={() => void run(load)}>Refresh</Action>
      <Action secondary disabled={busy} onPress={() => void run(async () => { const bytes = await placementApi.report(applied, roleId ?? undefined); await downloadResume(bytes, 'aimora-cohort.csv', 'text/csv'); })}>Export filtered CSV</Action></View><Text style={ui.muted}>Overview, student list and export use the applied filters. Skill gaps and new drives/training use the selected cohort. Select a target role to include gaps in the export.</Text>
    {cohorts.length === 0 && <Card><Text style={ui.heading}>No assigned cohorts yet</Text><Text style={ui.body}>Create an empty cohort below for imports. A local operator can grant existing students through the documented setup command.</Text></Card>}
    {tab === 'Overview' && dashboard && <><View style={ui.row}>{Object.entries(dashboard.metrics).map(([key, value]) => <View key={key} style={{ width: 230, gap: 8, padding: 16 }}><Text style={ui.score}>{value ?? '—'}</Text><Text style={ui.body}>{key.replaceAll('_', ' ')}</Text><Text style={ui.muted}>{dashboard.definitions[key]}</Text></View>)}</View>
      <Card><Text style={ui.heading}>Students needing follow-up</Text>{dashboard.follow_up.length ? dashboard.follow_up.map(x => <View key={x.id} style={{ gap: 8 }}><Text style={ui.body}>{x.name} · {x.student_id}</Text><Text style={ui.muted}>{x.follow_up.join(' · ')}</Text><Action secondary onPress={() => openStudent(x.id)}>Open {x.name}</Action></View>) : <Text style={ui.body}>No follow-up flags in this assigned scope.</Text>}</Card>
      <Details label="Create an empty cohort">{(['name', 'department', 'batch', 'section'] as const).map(key => <Field key={key} label={`Cohort ${key}`} value={cohortForm[key]} onChange={value => setCohortForm(x => ({ ...x, [key]: value }))}/>)}<Action disabled={busy} onPress={() => void run(createCohort)}>Create cohort</Action></Details>
    </>}
    {tab === 'Students' && <>{selectedStudent && <Action secondary onPress={() => { router.setParams({ student: '' }); setDetail(null); }}>Back to student list</Action>}
      {detail ? <><Card><Text style={ui.heading}>{detail.profile.student.name}</Text><Text style={ui.body}>{detail.profile.student.student_id} · {detail.profile.student.department ?? 'Department unknown'} · {detail.summary.batch ?? 'Batch unknown'} · {detail.summary.section ?? 'Section unknown'}</Text><Text style={ui.muted}>Profile completion {detail.summary.profile_completion}% · CGPA {detail.profile.student.cgpa ?? 'Unknown'} · {detail.profile.student.program ?? 'Program unknown'} · Semester {detail.profile.student.semester ?? 'Unknown'} · Graduation {detail.profile.student.graduation_year ?? 'Unknown'}</Text>
        <Text style={ui.heading}>Skills and supporting evidence</Text>{detail.profile.competencies.map(x => <Text key={x.skill.id} style={ui.body}>{x.skill.canonical_name}: {x.level === null ? 'Unknown' : `${x.level}/5`} · Evidence {x.evidence_ids.join(', ') || 'None attached'}</Text>)}{detail.profile.evidence.map(x => <Text key={x.id} selectable style={ui.muted}>Evidence {x.id} · {x.source_type}: {x.extracted_summary}</Text>)}</Card>
        <Card><Text style={ui.heading}>Assessment attempts</Text>{detail.assessments.length ? detail.assessments.map(x => <Text key={x.id} style={ui.body}>Skill {x.skill_id} · {Math.round(x.score*100)}% · {new Date(x.completed_at).toLocaleString()}</Text>) : <Text style={ui.body}>No assessments completed.</Text>}</Card>
        <Card><Text style={ui.heading}>Roadmap</Text>{detail.roadmap.map(x => <Text key={x.id} style={ui.body}>{x.task} · {x.status}</Text>)}{!detail.roadmap.length && <Text style={ui.body}>No roadmap saved.</Text>}</Card>
        <Text style={ui.heading}>Shared resume reviews</Text>{detail.reviews.length ? detail.reviews.map(x => <ReviewCard key={x.id} review={x} admin onUpdated={load}/>) : <Text style={ui.body}>The student has not shared a revision with you.</Text>}
        <Text style={ui.heading}>Assigned training</Text>{detail.training.length ? detail.training.map(x => <TrainingCard key={`${x.id}-${x.version}`} item={x} onUpdated={load}/>) : <Text style={ui.body}>No faculty training assigned.</Text>}
        <Text style={ui.heading}>Application history</Text>{detail.applications.length ? detail.applications.map(x => <ApplicationCard key={`${x.id}-${x.version}`} item={x} admin onUpdated={load}/>) : <Text style={ui.body}>No applications to your drives.</Text>}
        <Action onPress={() => { setAssignee('student'); setTab('Training'); }}>Assign training to this student</Action>
      </> : students && <>{students.items.length ? students.items.map(x => <Card key={x.id}><Text style={ui.heading}>{x.name} · {x.student_id}</Text><Text style={ui.muted}>{x.department ?? 'Unknown department'} · {x.batch ?? 'Unknown batch'} · {x.section ?? 'Unknown section'}</Text><Text style={ui.body}>Profile {x.profile_completion}% · Resume {x.resume_status.replaceAll('_', ' ')} · Assessments {x.assessments_completed} · Training {x.training_completed}/{x.training_total} · Applications {x.applications} · Offers {x.offers}</Text><Action secondary onPress={() => openStudent(x.id)}>Open student detail</Action></Card>) : <Text style={ui.body}>No assigned students match these filters.</Text>}
        <View style={ui.row}><Action secondary disabled={busy || page === 1} onPress={() => setPage(x => x-1)}>Previous page</Action><Text style={ui.muted}>Page {page} · {students.total} students</Text><Action secondary disabled={busy || page*students.page_size >= students.total} onPress={() => setPage(x => x+1)}>Next page</Action></View></>}
    </>}
    {tab === 'Skill gaps' && <><Choices label="Target role" values={roles.map(x => ({ value: x.id, label: x.title }))} selected={roleId} onSelect={id => { setRoleId(id); setGaps(null); setDrill(null); }}/><Action disabled={busy || !filter.cohort_id || !roleId} onPress={() => void run(async () => { setGaps(await placementApi.gaps(filter.cohort_id!, roleId!)); setDrill(null); })}>Analyze selected cohort</Action>
      {!roles.length && <Text style={ui.body}>No target roles with stored requirements. Students can analyze an existing role through the career journey.</Text>}
      {gaps && <><Text style={ui.body}>{gaps.student_count} assigned cohort members · {gaps.job.title}</Text><Text style={ui.muted}>{gaps.source}</Text><Text style={ui.muted}>{gaps.disclaimer}</Text>{gaps.skills.map(x => <Card key={x.skill.id}><Text style={ui.heading}>{x.skill.canonical_name}</Text><Text style={ui.body}>Expected {x.required_level ?? 'Unknown'}/5 · Known gaps {x.common_gap_count} · Unknown proficiency {x.unknown_count}</Text><Text style={ui.body}>Known mean {x.mean_proficiency ?? 'Unavailable'}/5 ({x.known_count}) · Assessed mean {x.mean_assessed_proficiency ?? 'Unavailable'}/5 ({x.assessed_count}) · Missing assessment {x.missing_assessment_count}</Text><View style={ui.row}><Action secondary onPress={() => setDrill(x.gap_student_ids)}>Students with known gaps</Action><Action secondary onPress={() => setDrill(x.unknown_student_ids)}>Unknown proficiency</Action><Action secondary onPress={() => setDrill(x.assessed_student_ids)}>Assessed students</Action><Action secondary onPress={() => setDrill(x.missing_assessment_student_ids)}>Missing assessments</Action></View></Card>)}</>}
      {drill && <Card><Text style={ui.heading}>Students behind this aggregate</Text>{drill.length ? drill.map(id => <Action secondary key={id} onPress={() => openStudent(id)}>Open student {id}</Action>) : <Text style={ui.body}>No students in this category.</Text>}</Card>}
    </>}
    {tab === 'Drives' && <>{drives.map(x => <Card key={x.id}><Text style={ui.heading}>{x.company} · {x.role}</Text><Text style={ui.body}>{x.description}</Text><Text style={ui.muted}>Deadline {x.deadline} · Cohort {x.cohort_id}</Text><Action secondary onPress={() => setEditDrive(x)}>Edit drive</Action></Card>)}{!drives.length && <Text style={ui.body}>No placement drives created.</Text>}
      {editDrive ? <><Action secondary onPress={() => setEditDrive(null)}>Cancel edit</Action><DriveEditor key={`${editDrive.id}-${editDrive.version}`} cohortId={editDrive.cohort_id} initial={editDrive} onSaved={async () => { await load(); setEditDrive(null); }}/></> : filter.cohort_id ? <DriveEditor key={filter.cohort_id} cohortId={filter.cohort_id} onSaved={async () => { await load(); setMessage('Drive created.'); }}/>: <Text style={ui.body}>Select a cohort to create a drive.</Text>}
    </>}
    {tab === 'Training' && <Card><Text style={ui.heading}>Assign training</Text><Choices label="Assignee" values={[{ value: 'cohort', label: 'Selected cohort' }, { value: 'student', label: 'Open student' }]} selected={assignee} onSelect={value => setAssignee(value as 'cohort' | 'student')}/><Text style={ui.muted}>{assignee === 'student' ? `Student: ${detail?.profile.student.name ?? 'Open a student detail first'}` : `Cohort: ${cohorts.find(x => x.id === filter.cohort_id)?.name ?? 'Select a cohort first'}`}</Text>
      <Choices label="Training kind" values={(['resource', 'course', 'project', 'assessment'] as const).map(value => ({ value, label: value }))} selected={training.kind} onSelect={kind => setTraining(x => ({ ...x, kind }))}/>
      {(['title', 'instructions', 'resource_url', 'deadline'] as const).map(key => <Field key={key} label={`Training ${key === 'deadline' ? 'deadline (YYYY-MM-DD)' : key.replace('_', ' ')}`} value={training[key]} onChange={value => setTraining(x => ({ ...x, [key]: value }))} multiline={key === 'instructions'}/>)}
      <Choices label="Existing skill (assessment supports SQL, Python, Docker)" values={[{ value: 0, label: 'None' }, ...skills.map(x => ({ value: x.id, label: x.canonical_name }))]} selected={training.skill_id ?? 0} onSelect={skill_id => setTraining(x => ({ ...x, skill_id: skill_id || null }))}/>
      {assignee === 'student' && detail?.roadmap.length ? <Choices label="Reuse student roadmap resource" values={[{ value: 0, label: 'No roadmap link' }, ...detail.roadmap.map(x => ({ value: x.id, label: x.resource_title ?? x.task }))]} selected={training.roadmap_item_id ?? 0} onSelect={roadmap_item_id => setTraining(x => ({ ...x, roadmap_item_id: roadmap_item_id || null }))}/> : null}
      <Action disabled={busy} onPress={() => void run(assign)}>Save training assignments</Action><Text style={ui.muted}>Completion requires student-submitted evidence. Assigned assessments use the existing quiz and scoring service.</Text>
    </Card>}
  </ScrollView>;
}
