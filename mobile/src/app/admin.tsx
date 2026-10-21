import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Action, Card, Details, ui } from '@/components/career-ui';
import { ApplicationCard, Choices, DriveEditor, Field, ReviewCard, TrainingCard } from '@/components/placement-ui';
import { placementApi } from '@/api/placement';
import { downloadResume } from '@/utils/resume-download';
import { resolveFacultySection } from '@/utils/faculty-navigation';
import { facultyScopeSummary } from '@/utils/faculty-scope';
import type * as C from '@/types/contracts';

type Tab = 'Overview' | 'Students' | 'Skill gaps' | 'Drives' | 'Training' | 'Reports';
const sectionToTab: Record<string, Tab> = { overview: 'Overview', students: 'Students', analytics: 'Skill gaps', placement: 'Drives', 'reviews-training': 'Training', reports: 'Reports' };
const tabToSection: Record<Tab, string> = { Overview: 'overview', Students: 'students', 'Skill gaps': 'analytics', Drives: 'placement', Training: 'reviews-training', Reports: 'reports' };
const tabCopy: Record<Tab, { title: string; description: string }> = {
  Overview: { title: 'Faculty overview', description: 'Use the assigned-student scope below to review summary signals and choose a next action.' },
  Students: { title: 'Students & cohorts', description: 'Search only students assigned to your faculty scope. Student evidence remains visible only within this authorized workspace.' },
  'Skill gaps': { title: 'Skill analytics', description: 'Compare an assigned cohort with a stored target role. Aggregates distinguish known gaps from unknown or unassessed evidence.' },
  Drives: { title: 'Placement management', description: 'Create and edit cohort drives. Eligibility and application information stays governed by the existing placement rules.' },
  Training: { title: 'Reviews & training', description: 'Resume reviews remain on each student detail. Use this workspace to assign preparation without duplicating review records.' },
  Reports: { title: 'Reports', description: 'Export the same faculty-scoped filters used by the overview and student list.' },
};
export default function Admin() {
  const params = useLocalSearchParams<{ student?: string; section?: string }>();
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
  const demoLock = useRef(false);
  const selectedStudent = Number(params.student) || null;
  const tab = sectionToTab[resolveFacultySection(params.section, params.student)];
  const scopeSummary = facultyScopeSummary(applied, cohorts);
  const selectView = (next: Tab) => { router.setParams({ section: tabToSection[next] }); };
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
  async function loadDemo() {
    if (busy || demoLock.current) return;
    demoLock.current = true;
    try {
      await run(async () => {
        const demo = await placementApi.loadDemo();
        const scope: C.PlacementFilter = { cohort_id: demo.cohort_id };
        const [c, r, stats, list, opportunities, skillGaps] = await Promise.all([
          placementApi.cohorts(), placementApi.roles(), placementApi.dashboard(scope),
          placementApi.students(scope), placementApi.adminDrives(),
          placementApi.gaps(demo.cohort_id, demo.job_id),
        ]);
        setCohorts(c); setRoles(r); setDashboard(stats); setStudents(list); setDrives(opportunities);
        setFilter(scope); setApplied(scope); setPage(1); setRoleId(demo.job_id);
        setGaps(skillGaps); setDrill(null); setEditDrive(null);
        setDetail(null); setAssignee('cohort');
        router.setParams({ student: '' });
        setMessage(demo.message);
      });
    } finally { demoLock.current = false; }
  }
  useFocusEffect(useCallback(() => { void run(load); }, [run, load]));
  const openStudent = (id: number) => { setDetail(null); router.setParams({ student: String(id), section: 'students' }); };
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
  const demoActive = cohorts.some(x => x.id === applied.cohort_id && x.name === 'Demo fixtures - placement workspace');
  const visibleDrives = applied.cohort_id ? drives.filter(x => x.cohort_id === applied.cohort_id) : drives;
  const demoMetrics: Record<Tab, string[]> = {
    Overview: [], Students: ['assigned_students', 'profile_complete', 'students_assessed'],
    'Skill gaps': ['assigned_students', 'students_assessed', 'assessment_attempts'],
    Drives: ['applications', 'offers', 'students_offered'],
    Training: ['training_total', 'training_completed', 'resumes_submitted', 'resumes_approved'],
    Reports: ['assigned_students', 'assessment_attempts', 'training_completed', 'applications', 'offers'],
  };
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Text style={ui.kicker}>FACULTY WORKSPACE / {tabToSection[tab].toUpperCase()}</Text><Text style={ui.title}>{tabCopy[tab].title}</Text><Text style={ui.muted}>{tabCopy[tab].description}</Text>
    <Card><Text style={ui.label}>DEMO RECORDS</Text><Text style={ui.muted}>Explore this section with six fictional students, skill evidence, reviews, training and placement outcomes. Reuses a separate demo cohort; repeated clicks keep saved demo edits.</Text><Action secondary disabled={busy} onPress={() => void loadDemo()}>Load demo records</Action></Card>
    {demoActive && <Card><Text accessibilityLiveRegion="polite" style={ui.label}>DEMO FIXTURE / SYNTHETIC DATA</Text><Text style={ui.body}>All records and outcomes in the selected demo cohort are fictional. Stats below are calculated from its saved records.</Text>{tab !== 'Overview' && dashboard && <View style={ui.row}>{demoMetrics[tab].map(key => <View key={key} style={[ui.chip, { minWidth: 150, gap: 6 }]}><Text style={ui.score}>{dashboard.metrics[key] ?? '—'}</Text><Text style={ui.body}>{key.replaceAll('_', ' ')}</Text></View>)}</View>}</Card>}
    {busy && <View style={ui.row}><ActivityIndicator accessibilityLabel="Loading faculty data"/><Text style={ui.muted}>Loading faculty-scoped data…</Text></View>}{!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Text style={ui.muted}>Refresh to reload saved records. If demo loading was interrupted, Load demo records safely resumes it.</Text><Action secondary disabled={busy} onPress={() => void run(load)}>Retry loading workspace</Action></Card>}{!!message && <Card><Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text></Card>}
    <Choices label="Cohort" values={[{ value: 0, label: 'All assigned students' }, ...cohorts.map(x => ({ value: x.id, label: `${x.name} (${x.students})` }))]} selected={filter.cohort_id ?? 0} onSelect={id => { setFilter(x => ({ ...x, cohort_id: id || undefined })); setGaps(null); setDrill(null); }}/>
    <Details label="Search and cohort filters"><Field label="Search name or student ID" value={filter.q ?? ''} onChange={q => setFilter(x => ({ ...x, q }))}/><View style={{ gap: 12 }}>{(['department', 'batch', 'section'] as const).map(key => <Field key={key} label={`Filter ${key}`} value={filter[key] ?? ''} onChange={value => setFilter(x => ({ ...x, [key]: value }))}/>)}</View>
      <Choices label="Progress filter" values={[{ value: '', label: 'All progress' }, { value: 'follow_up', label: 'Needs follow-up' }, { value: 'complete', label: 'No follow-up flags' }]} selected={filter.progress ?? ''} onSelect={progress => setFilter(x => ({ ...x, progress: progress as C.PlacementFilter['progress'] }))}/>
    </Details><View style={ui.row}><Action disabled={busy} onPress={() => { setPage(1); setApplied({ ...filter }); }}>Apply filters</Action><Action secondary disabled={busy} onPress={() => void run(load)}>Refresh</Action></View><Card><Text style={ui.label}>CURRENT APPLIED SCOPE</Text><Text style={ui.body}>{scopeSummary}</Text><Text style={ui.muted}>Overview, student list, and Reports use these applied filters. Skill gaps and new drives/training use the selected cohort. Faculty authorization is always enforced by the server.</Text></Card>
    {cohorts.length === 0 && <Card><Text style={ui.heading}>No assigned cohorts yet</Text><Text style={ui.body}>Create an empty cohort below for imports. A local operator can grant existing students through the documented setup command.</Text></Card>}
    {tab === 'Overview' && dashboard && <><View style={ui.row}>{Object.entries(dashboard.metrics).map(([key, value]) => <View key={key} style={[ui.chip, { width: 230, minHeight: 132, gap: 8, padding: 16 }]}><Text style={ui.score}>{value ?? '—'}</Text><Text style={ui.body}>{key.replaceAll('_', ' ')}</Text><Text style={ui.muted}>{dashboard.definitions[key]}</Text></View>)}</View>
      <Card><Text style={ui.kicker}>NEXT ACTIONS</Text><Text style={ui.heading}>Students needing follow-up</Text>{dashboard.follow_up.length ? dashboard.follow_up.map(x => <View key={x.id} style={[ui.divider, { gap: 8 }]}><Text style={ui.body}>{x.name} · {x.student_id}</Text><Text style={ui.muted}>{x.follow_up.join(' · ')}</Text><Action secondary onPress={() => openStudent(x.id)}>Open student detail</Action></View>) : <Text style={ui.body}>No follow-up flags in this assigned scope.</Text>}</Card>
      <Card><Details label="Create an empty cohort for import">{(['name', 'department', 'batch', 'section'] as const).map(key => <Field key={key} label={`Cohort ${key}`} value={cohortForm[key]} onChange={value => setCohortForm(x => ({ ...x, [key]: value }))}/>)}<Action disabled={busy} onPress={() => void run(createCohort)}>Create cohort</Action></Details></Card>
    </>}
    {tab === 'Students' && <><View style={ui.row}><Action secondary disabled={busy} onPress={() => router.push('/admin-import')}>Import students into a cohort</Action>{selectedStudent && <Action secondary onPress={() => { router.setParams({ student: '' }); setDetail(null); }}>Back to student list</Action>}</View>
      {detail ? <><Card><Text style={ui.kicker}>STUDENT DETAIL / AUTHORIZED SCOPE</Text><Text style={ui.heading}>{detail.profile.student.name}</Text><Text style={ui.body}>{detail.profile.student.student_id} · {detail.profile.student.department ?? 'Department unknown'} · {detail.summary.batch ?? 'Batch unknown'} · {detail.summary.section ?? 'Section unknown'}</Text><Text style={ui.muted}>Profile completion {detail.summary.profile_completion}% · CGPA {detail.profile.student.cgpa ?? 'Unknown'} · {detail.profile.student.program ?? 'Program unknown'} · Semester {detail.profile.student.semester ?? 'Unknown'} · Graduation {detail.profile.student.graduation_year ?? 'Unknown'}</Text>
        <Text style={ui.heading}>Skills and supporting evidence</Text>{detail.profile.competencies.map(x => <Text key={x.skill.id} style={ui.body}>{x.skill.canonical_name}: {x.level === null ? 'Unknown' : `${x.level}/5`} · Evidence {x.evidence_ids.join(', ') || 'None attached'}</Text>)}{detail.profile.evidence.map(x => <Text key={x.id} selectable style={ui.muted}>Evidence {x.id} · {x.source_type}: {x.extracted_summary}</Text>)}</Card>
        <Card><Text style={ui.heading}>Assessment attempts</Text>{detail.assessments.length ? detail.assessments.map(x => <Text key={x.id} style={ui.body}>Skill {x.skill_id} · {Math.round(x.score*100)}% · {new Date(x.completed_at).toLocaleString()}</Text>) : <Text style={ui.body}>No assessments completed.</Text>}</Card>
        <Card><Text style={ui.heading}>Roadmap</Text>{detail.roadmap.map(x => <Text key={x.id} style={ui.body}>{x.task} · {x.status}</Text>)}{!detail.roadmap.length && <Text style={ui.body}>No roadmap saved.</Text>}</Card>
        <Text style={ui.heading}>Shared resume reviews</Text>{detail.reviews.length ? detail.reviews.map(x => <ReviewCard key={x.id} review={x} admin onUpdated={load}/>) : <Text style={ui.body}>The student has not shared a revision with you.</Text>}
        <Text style={ui.heading}>Assigned training</Text>{detail.training.length ? detail.training.map(x => <TrainingCard key={`${x.id}-${x.version}`} item={x} onUpdated={load}/>) : <Text style={ui.body}>No faculty training assigned.</Text>}
        <Text style={ui.heading}>Application history</Text>{detail.applications.length ? detail.applications.map(x => <ApplicationCard key={`${x.id}-${x.version}`} item={x} admin onUpdated={load}/>) : <Text style={ui.body}>No applications to your drives.</Text>}
        <Action onPress={() => { setAssignee('student'); selectView('Training'); }}>Assign training to this student</Action>
      </> : students && <><Text style={ui.muted}>{students.total} assigned students in the applied scope. Open a record to view private evidence, reviews, training, and applications.</Text>{students.items.length ? students.items.map(x => <Card key={x.id}><Text style={ui.heading}>{x.name} · {x.student_id}</Text><Text style={ui.muted}>{x.department ?? 'Unknown department'} · {x.batch ?? 'Unknown batch'} · {x.section ?? 'Unknown section'}</Text><Text style={ui.body}>Profile {x.profile_completion}% · Resume {x.resume_status.replaceAll('_', ' ')} · Assessments {x.assessments_completed} · Training {x.training_completed}/{x.training_total} · Applications {x.applications} · Offers {x.offers}</Text><Action secondary onPress={() => openStudent(x.id)}>Open student detail</Action></Card>) : <Card><Text style={ui.body}>No assigned students match these filters.</Text><Text style={ui.muted}>Adjust filters or choose another authorized cohort.</Text></Card>}
        <View style={ui.row}><Action secondary disabled={busy || page === 1} onPress={() => setPage(x => x-1)}>Previous page</Action><Text style={ui.muted}>Page {page} · {students.total} students</Text><Action secondary disabled={busy || page*students.page_size >= students.total} onPress={() => setPage(x => x+1)}>Next page</Action></View></>}
    </>}
    {tab === 'Skill gaps' && <><Card><Text style={ui.kicker}>COHORT EVIDENCE</Text><Text style={ui.heading}>Analyze a selected cohort against a target role</Text><Text style={ui.muted}>Choose a cohort and stored target role. Unknown or unassessed evidence is reported separately and does not become a known gap.</Text></Card><Choices label="Target role" values={roles.map(x => ({ value: x.id, label: x.title }))} selected={roleId} onSelect={id => { setRoleId(id); setGaps(null); setDrill(null); }}/><Action disabled={busy || !filter.cohort_id || !roleId} onPress={() => void run(async () => { setGaps(await placementApi.gaps(filter.cohort_id!, roleId!)); setDrill(null); })}>Analyze selected cohort</Action>
      {!roles.length && <Text style={ui.body}>No target roles with stored requirements. Students can analyze an existing role through the career journey.</Text>}
      {gaps && <><Text style={ui.body}>{gaps.student_count} assigned cohort members · {gaps.job.title}</Text><Text style={ui.muted}>{gaps.source}</Text><Text style={ui.muted}>{gaps.disclaimer}</Text>{gaps.skills.map(x => <Card key={x.skill.id}><Text style={ui.heading}>{x.skill.canonical_name}</Text><Text style={ui.body}>Expected {x.required_level ?? 'Unknown'}/5 · Known gaps {x.common_gap_count} · Unknown proficiency {x.unknown_count}</Text><Text style={ui.body}>Known mean {x.mean_proficiency ?? 'Unavailable'}/5 ({x.known_count}) · Assessed mean {x.mean_assessed_proficiency ?? 'Unavailable'}/5 ({x.assessed_count}) · Missing assessment {x.missing_assessment_count}</Text><View style={ui.row}><Action secondary onPress={() => setDrill(x.gap_student_ids)}>Students with known gaps</Action><Action secondary onPress={() => setDrill(x.unknown_student_ids)}>Unknown proficiency</Action><Action secondary onPress={() => setDrill(x.assessed_student_ids)}>Assessed students</Action><Action secondary onPress={() => setDrill(x.missing_assessment_student_ids)}>Missing assessments</Action></View></Card>)}</>}
      {drill && <Card><Text style={ui.heading}>Students behind this aggregate</Text>{drill.length ? drill.map(id => <Action secondary key={id} onPress={() => openStudent(id)}>Open student {id}</Action>) : <Text style={ui.body}>No students in this category.</Text>}</Card>}
    </>}
    {tab === 'Drives' && <><Card><Text style={ui.kicker}>COHORT DRIVES</Text><Text style={ui.heading}>Manage placement opportunities</Text><Text style={ui.muted}>Drive eligibility rules are applied by the existing placement workflow. Create or edit a drive only for the selected cohort.</Text></Card>{visibleDrives.map(x => <Card key={x.id}><Text style={ui.heading}>{x.company} · {x.role}</Text><Text style={ui.body}>{x.description}</Text><Text style={ui.muted}>Deadline {x.deadline} · Cohort {x.cohort_id}</Text><Action secondary onPress={() => setEditDrive(x)}>Edit drive</Action></Card>)}{!visibleDrives.length && <Card><Text style={ui.body}>No placement drives created.</Text><Text style={ui.muted}>Select a cohort below to create its first drive.</Text></Card>}
      {editDrive ? <><Action secondary onPress={() => setEditDrive(null)}>Cancel edit</Action><DriveEditor key={`${editDrive.id}-${editDrive.version}`} cohortId={editDrive.cohort_id} initial={editDrive} onSaved={async () => { await load(); setEditDrive(null); }}/></> : filter.cohort_id ? <DriveEditor key={filter.cohort_id} cohortId={filter.cohort_id} onSaved={async () => { await load(); setMessage('Drive created.'); }}/>: <Text style={ui.body}>Select a cohort to create a drive.</Text>}
    </>}
    {tab === 'Training' && <>{demoActive && students && <Card><Text style={ui.heading}>Demo reviews & training records</Text>{students.items.map(item => <View key={item.id} style={ui.divider}><Text style={ui.body}>{item.name} · Review {item.resume_status.replaceAll('_', ' ')} · Training {item.training_completed}/{item.training_total}</Text><Action secondary onPress={() => openStudent(item.id)}>Open demo student records</Action></View>)}</Card>}<Card><Text style={ui.kicker}>CONTEXTUAL RESUME REVIEWS</Text><Text style={ui.heading}>Open the student who shared a revision</Text><Text style={ui.body}>Reviews stay attached to the student and shared revision. This protects review context without creating a duplicate storage system.</Text><Action secondary onPress={() => selectView('Students')}>{selectedStudent ? 'Return to this student’s reviews' : 'Open Students & Cohorts to review resumes'}</Action></Card><Card><Text style={ui.kicker}>TRAINING ASSIGNMENT</Text><Text style={ui.heading}>Assign preparation</Text><Text style={ui.muted}>Choose an authorized cohort or the currently open student. Completion requires student-submitted evidence; assessments use the existing quiz service.</Text><Choices label="Assignee" values={[{ value: 'cohort', label: 'Selected cohort' }, { value: 'student', label: 'Open student' }]} selected={assignee} onSelect={value => setAssignee(value as 'cohort' | 'student')}/><Text style={ui.muted}>{assignee === 'student' ? `Student: ${detail?.profile.student.name ?? 'Open a student detail first'}` : `Cohort: ${cohorts.find(x => x.id === filter.cohort_id)?.name ?? 'Select a cohort first'}`}</Text>
      <Choices label="Training kind" values={(['resource', 'course', 'project', 'assessment'] as const).map(value => ({ value, label: value }))} selected={training.kind} onSelect={kind => setTraining(x => ({ ...x, kind }))}/>
      {(['title', 'instructions', 'resource_url', 'deadline'] as const).map(key => <Field key={key} label={`Training ${key === 'deadline' ? 'deadline (YYYY-MM-DD)' : key.replace('_', ' ')}`} value={training[key]} onChange={value => setTraining(x => ({ ...x, [key]: value }))} multiline={key === 'instructions'}/>)}
      <Choices label="Existing skill (assessment supports SQL, Python, Docker)" values={[{ value: 0, label: 'None' }, ...skills.map(x => ({ value: x.id, label: x.canonical_name }))]} selected={training.skill_id ?? 0} onSelect={skill_id => setTraining(x => ({ ...x, skill_id: skill_id || null }))}/>
      {assignee === 'student' && detail?.roadmap.length ? <Choices label="Reuse student roadmap resource" values={[{ value: 0, label: 'No roadmap link' }, ...detail.roadmap.map(x => ({ value: x.id, label: x.resource_title ?? x.task }))]} selected={training.roadmap_item_id ?? 0} onSelect={roadmap_item_id => setTraining(x => ({ ...x, roadmap_item_id: roadmap_item_id || null }))}/> : null}
      <Action disabled={busy} onPress={() => void run(assign)}>Save training assignments</Action><Text style={ui.muted}>Completion requires student-submitted evidence. Assigned assessments use the existing quiz and scoring service.</Text>
    </Card></>}
    {tab === 'Reports' && <Card><Text style={ui.kicker}>SCOPED CSV EXPORT</Text><Text style={ui.heading}>Download a faculty-scoped report</Text><Text style={ui.body}>{scopeSummary}</Text><Text style={ui.muted}>The CSV includes only students authorized for your faculty scope and the currently applied filters. Select a target role in Skill Analytics first if you want its existing gap context included.</Text><Action disabled={busy} onPress={() => void run(async () => { const bytes = await placementApi.report(applied, roleId ?? undefined); await downloadResume(bytes, 'aimora-cohort.csv', 'text/csv'); })}>Export filtered CSV</Action></Card>}
  </ScrollView>;
}
