import { SelectField } from '@/components/select-field';
import { AdaptiveColumns, PageHeading, page as frame, SectionHeading, StatusTag, WorkspacePage } from '@/components/screen-layout';
import { FacultyMetrics, FacultyRoster, FacultySkillCard } from '@/components/faculty-dashboard';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Action, Card, Details, ui } from '@/components/career-ui';
import { ApplicationCard, Choices, DriveEditor, Field, ReviewCard, TrainingCard } from '@/components/placement-ui';
import { placementApi } from '@/api/placement';
import { downloadResume } from '@/utils/resume-download';
import { resolveFacultySection } from '@/utils/faculty-navigation';
import { facultyScopeSummary } from '@/utils/faculty-scope';
import type * as C from '@/types/contracts';
import { createLatestRequestGate } from '@/utils/latest-request';

type Tab = 'Overview' | 'Students' | 'Skill gaps' | 'Drives' | 'Training' | 'Reports';
const sectionToTab: Record<string, Tab> = { overview: 'Overview', students: 'Students', analytics: 'Skill gaps', placement: 'Drives', 'reviews-training': 'Training', reports: 'Reports' };
const tabToSection: Record<Tab, string> = { Overview: 'overview', Students: 'students', 'Skill gaps': 'analytics', Drives: 'placement', Training: 'reviews-training', Reports: 'reports' };
const tabCopy: Record<Tab, { title: string; description: string }> = {
  Overview: { title: 'Cohort Placement Overview', description: 'Use the assigned-student scope below to review summary signals and choose a next action.' },
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
  const requestGate = useRef(createLatestRequestGate());
  const loadVersion = useRef(0);
  const selectedStudent = Number(params.student) || null;
  const tab = sectionToTab[resolveFacultySection(params.section, params.student)];
  const scopeSummary = facultyScopeSummary(applied, cohorts);
  const selectView = (next: Tab) => { router.setParams({ section: tabToSection[next] }); };
  const run = useCallback(async (work: () => Promise<void>) => {
    const requestId = requestGate.current.begin();
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (err) { if (requestGate.current.isCurrent(requestId)) setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { if (requestGate.current.isCurrent(requestId)) setBusy(false); }
  }, []);
  const load = useCallback(async () => {
    const current = ++loadVersion.current;
    const [c, r, d, list, opportunities, studentDetail] = await Promise.all([placementApi.cohorts(), placementApi.roles(), placementApi.dashboard(applied), placementApi.students(applied, page), placementApi.adminDrives(), selectedStudent ? placementApi.detail(selectedStudent) : Promise.resolve(null)]);
    if (current !== loadVersion.current) return;
    setCohorts(c); setRoles(r); setDashboard(d); setStudents(list); setDrives(opportunities);
    setDetail(studentDetail);
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
      });
    } finally { demoLock.current = false; }
  }
  useFocusEffect(useCallback(() => { void run(load); return () => { loadVersion.current += 1; requestGate.current.begin(); }; }, [run, load]));
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
  return <WorkspacePage>
    <View style={frame.sectionHeader}><View style={{ flex: 1, minWidth: 180 }}><PageHeading title={tabCopy[tab].title} eyebrow={`FACULTY CONSOLE / ${tabToSection[tab].toUpperCase()}`} description={tab === 'Overview' ? undefined : tabCopy[tab].description} /></View><Action secondary compact disabled={busy} accessibilityLabel="Load demo records" onPress={() => void loadDemo()}>Demo</Action></View>
    <View style={frame.notice}><Text style={ui.label}>AUTHORIZED FACULTY SCOPE</Text><Text style={ui.muted}>Only assigned students and explicitly shared resume revisions are available here. Private unshared drafts remain private. Cohort statistics and eligibility follow the existing server rules.</Text></View>
    {demoActive && tab !== 'Overview' && dashboard && <FacultyMetrics dashboard={dashboard} keys={demoMetrics[tab]} />}
    {busy && <View style={ui.row}><ActivityIndicator accessibilityLabel="Loading faculty data"/><Text style={ui.muted}>Loading faculty-scoped data…</Text></View>}{!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Text style={ui.muted}>Refresh to reload saved records. If demo loading was interrupted, Load demo records safely resumes it.</Text><Action secondary disabled={busy} onPress={() => void run(load)}>Retry loading workspace</Action></Card>}{!!message && <Card><Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text></Card>}
    <Card style={{ padding: 16, gap: 12 }}><View style={[ui.row, { alignItems: 'flex-start', justifyContent: 'space-between' }]}>
      <View style={{ flex: 1, minWidth: 200 }}><Details label={`Cohort: ${cohorts.find(cohort => cohort.id === filter.cohort_id)?.name ?? 'All assigned students'}`}><Choices disabled={busy} label="Cohort" values={[{ value: 0, label: 'All assigned students' }, ...cohorts.map(x => ({ value: x.id, label: `${x.name} (${x.students})` }))]} selected={filter.cohort_id ?? 0} onSelect={id => { setFilter(x => ({ ...x, cohort_id: id || undefined })); setGaps(null); setDrill(null); }} /></Details></View>
      <View style={{ flex: 1, minWidth: 200 }}><Details label="Search and cohort filters"><Field label="Search name or student ID" value={filter.q ?? ''} onChange={q => setFilter(x => ({ ...x, q }))} />{(['department', 'batch', 'section'] as const).map(key => <Field key={key} label={`Filter ${key}`} value={filter[key] ?? ''} onChange={value => setFilter(x => ({ ...x, [key]: value }))} />)}<Choices disabled={busy} label="Progress filter" values={[{ value: '', label: 'All progress' }, { value: 'follow_up', label: 'Needs follow-up' }, { value: 'complete', label: 'No follow-up flags' }]} selected={filter.progress ?? ''} onSelect={progress => setFilter(x => ({ ...x, progress: progress as C.PlacementFilter['progress'] }))} /><Text style={ui.muted}>Overview, student list, and Reports use these applied filters. Skill gaps and new drives/training use the selected cohort. Faculty authorization is always enforced by the server.</Text></Details></View>
      <Action compact disabled={busy} onPress={() => { setPage(1); setApplied({ ...filter }); }}>Apply filters</Action><Action secondary compact disabled={busy} onPress={() => void run(load)}>Refresh</Action>
    </View><Text style={ui.muted}>APPLIED ROSTER / REPORT SCOPE · {scopeSummary}</Text>{(tab === 'Skill gaps' || tab === 'Drives' || tab === 'Training') && <Text style={ui.muted}>SELECTED COHORT FOR ANALYSIS / CREATION · {cohorts.find(cohort => cohort.id === filter.cohort_id)?.name ?? 'Choose an assigned cohort'}</Text>}</Card>
    {cohorts.length === 0 && <Card><Text style={ui.heading}>No assigned cohorts yet</Text><Text style={ui.body}>Create an empty cohort below for imports. A local operator can grant existing students through the documented setup command.</Text></Card>}
    {tab === 'Overview' && dashboard && <><FacultyMetrics dashboard={dashboard} /><AdaptiveColumns><View style={[frame.column, { flex: 1.5 }]}>
      <Card><Text style={ui.kicker}>NEXT ACTIONS</Text><Text style={ui.heading}>Students needing follow-up</Text>{dashboard.follow_up.length ? dashboard.follow_up.map(x => <View key={x.id} style={[ui.divider, { gap: 8 }]}><Text style={ui.body}>{x.name} · {x.student_id}</Text><Text style={ui.muted}>{x.follow_up.join(' · ')}</Text><Action secondary onPress={() => openStudent(x.id)}>Open student detail</Action></View>) : <Text style={ui.body}>No follow-up flags in this assigned scope.</Text>}</Card>
      <Card><Details label="Create an empty cohort for import">{(['name', 'department', 'batch', 'section'] as const).map(key => <Field key={key} label={`Cohort ${key}`} value={cohortForm[key]} onChange={value => setCohortForm(x => ({ ...x, [key]: value }))}/>)}<Action disabled={busy} onPress={() => void run(createCohort)}>Create cohort</Action></Details></Card>
      </View><View style={frame.column}><Card><SectionHeading title="Quick scoped actions" /><Action secondary onPress={() => selectView('Students')}>Student roster & profiles</Action><Action secondary onPress={() => selectView('Skill gaps')}>Cohort skill analytics</Action><Action secondary onPress={() => router.push('/admin-import')}>Import CSV / XLSX</Action><Action secondary onPress={() => selectView('Reports')}>Faculty-scoped CSV report</Action></Card><Card><SectionHeading title="Placement drives" description="Drives visible in the applied cohort scope." />{visibleDrives.length ? visibleDrives.map(drive => <View style={ui.divider} key={drive.id}><Text style={ui.body}>{drive.company} · {drive.role}</Text><Text style={ui.muted}>Deadline {drive.deadline}</Text><Action secondary compact onPress={() => { setEditDrive(drive); selectView('Drives'); }}>Manage drive</Action></View>) : <Text style={ui.muted}>No drives in this scope.</Text>}</Card></View></AdaptiveColumns>
    </>}
    {tab === 'Students' && <>
      <View style={ui.row}><Action secondary disabled={busy} onPress={() => router.push('/admin-import')}>Import students into a cohort</Action>{selectedStudent && <Action secondary onPress={() => { router.setParams({ student: '' }); setDetail(null); }}>Back to student list</Action>}</View>
      <AdaptiveColumns><View style={[frame.column, { flex: 0.8 }]}>{students ? <FacultyRoster students={students} selected={selectedStudent} busy={busy} currentPage={page} onSelect={openStudent} onPage={setPage} /> : <Text style={ui.muted}>Loading authorized roster…</Text>}</View><View style={[frame.column, { flex: 1.35 }]}>{detail ? <><Card><Text style={ui.kicker}>STUDENT DETAIL / AUTHORIZED SCOPE</Text><Text style={ui.heading}>{detail.profile.student.name}</Text><Text style={ui.body}>{detail.profile.student.student_id} · {detail.profile.student.department ?? 'Department unknown'} · {detail.summary.batch ?? 'Batch unknown'} · {detail.summary.section ?? 'Section unknown'}</Text><Text style={ui.muted}>Profile completion {detail.summary.profile_completion}% · CGPA {detail.profile.student.cgpa ?? 'Unknown'} · {detail.profile.student.program ?? 'Program unknown'} · Semester {detail.profile.student.semester ?? 'Unknown'} · Graduation {detail.profile.student.graduation_year ?? 'Unknown'}</Text>
        <Text style={ui.heading}>Skills and supporting evidence</Text>{detail.profile.competencies.map(x => <Text key={x.skill.id} style={ui.body}>{x.skill.canonical_name}: {x.level === null ? 'Unknown' : `${x.level}/5`} · Evidence {x.evidence_ids.join(', ') || 'None attached'}</Text>)}{detail.profile.evidence.map(x => <Text key={x.id} selectable style={ui.muted}>Evidence {x.id} · {x.source_type}: {x.extracted_summary}</Text>)}</Card>
        <Card><Text style={ui.heading}>Assessment attempts</Text>{detail.assessments.length ? detail.assessments.map(x => <Text key={x.id} style={ui.body}>Skill {x.skill_id} · {Math.round(x.score*100)}% · {new Date(x.completed_at).toLocaleString()}</Text>) : <Text style={ui.body}>No assessments completed.</Text>}</Card>
        <Card><Text style={ui.heading}>Roadmap</Text>{detail.roadmap.map(x => <Text key={x.id} style={ui.body}>{x.task} · {x.status}</Text>)}{!detail.roadmap.length && <Text style={ui.body}>No roadmap saved.</Text>}</Card>
        <Text style={ui.heading}>Shared resume reviews</Text>{detail.reviews.length ? detail.reviews.map(x => <ReviewCard key={x.id} review={x} admin onUpdated={load}/>) : <Text style={ui.body}>The student has not shared a revision with you.</Text>}
        <Text style={ui.heading}>Assigned training</Text>{detail.training.length ? detail.training.map(x => <TrainingCard key={`${x.id}-${x.version}`} item={x} onUpdated={load}/>) : <Text style={ui.body}>No faculty training assigned.</Text>}
        <Text style={ui.heading}>Application history</Text>{detail.applications.length ? detail.applications.map(x => <ApplicationCard key={`${x.id}-${x.version}`} item={x} admin onUpdated={load}/>) : <Text style={ui.body}>No applications to your drives.</Text>}
        <Action onPress={() => { setAssignee('student'); selectView('Training'); }}>Assign training to this student</Action>
      </> : <Card><SectionHeading title={selectedStudent ? 'Loading student record' : 'Select an authorized student'} description="The selected record shows saved competencies, shared revisions, assessment history, roadmap progress and applications. Student privacy and faculty scope are enforced by the server." /></Card>}</View></AdaptiveColumns>
    </>}
    {tab === 'Skill gaps' && <><Card><Text style={ui.kicker}>COHORT EVIDENCE</Text><Text style={ui.heading}>Analyze a selected cohort against a target role</Text><Text style={ui.muted}>Choose a cohort and stored target role. Unknown or unassessed evidence is reported separately and does not become a known gap.</Text></Card><SelectField disabled={busy} label="Target role" values={roles.map(x => ({ value: x.id, label: x.title }))} selected={roleId} onSelect={id => { setRoleId(id); setGaps(null); setDrill(null); }}/><Action disabled={busy || !filter.cohort_id || !roleId} onPress={() => void run(async () => { setGaps(await placementApi.gaps(filter.cohort_id!, roleId!)); setDrill(null); })}>Analyze selected cohort</Action>
      {!roles.length && <Text style={ui.body}>No target roles with stored requirements. Students can analyze an existing role through the career journey.</Text>}
      {gaps && <><Text style={ui.body}>{gaps.student_count} assigned cohort members · {gaps.job.title}</Text><Text style={ui.muted}>{gaps.source}</Text><Text style={ui.muted}>{gaps.disclaimer}</Text><AdaptiveColumns><View style={[frame.column, { flex: 1.8 }]}>{gaps.skills.map(x => <FacultySkillCard key={x.skill.id} skill={x} onDrill={setDrill} />)}</View><View style={frame.column}><Card><SectionHeading title="Read the comparison" /><Text style={ui.body}>Role-required level is the expected proficiency in the selected role, on a 0–5 scale.</Text><Text style={ui.muted}>Known and assessed means show their own student counts. Unknown proficiency remains separate from measured zero and missing assessments.</Text></Card></View></AdaptiveColumns></>}
      {drill && <Card><Text style={ui.heading}>Students behind this aggregate</Text>{drill.length ? drill.map(id => <Action secondary key={id} onPress={() => openStudent(id)}>Open student {id}</Action>) : <Text style={ui.body}>No students in this category.</Text>}</Card>}
    </>}
    {tab === 'Drives' && <><Card><Text style={ui.kicker}>COHORT DRIVES</Text><Text style={ui.heading}>Manage placement opportunities</Text><Text style={ui.muted}>Drive eligibility rules are applied by the existing placement workflow. Create or edit a drive only for the selected cohort.</Text></Card><AdaptiveColumns><View style={frame.column}>{visibleDrives.map(x => <Card key={x.id}><Text style={ui.heading}>{x.company} · {x.role}</Text><Text style={ui.body}>{x.description}</Text><Text style={ui.muted}>Deadline {x.deadline} · Cohort {x.cohort_id}</Text><Action secondary onPress={() => setEditDrive(x)}>Edit drive</Action></Card>)}{!visibleDrives.length && <Card><Text style={ui.body}>No placement drives created.</Text><Text style={ui.muted}>Select a cohort below to create its first drive.</Text></Card>}
      </View><View style={frame.column}>{editDrive ? <><Action secondary onPress={() => setEditDrive(null)}>Cancel edit</Action><DriveEditor key={`${editDrive.id}-${editDrive.version}`} cohortId={editDrive.cohort_id} initial={editDrive} onSaved={async () => { await load(); setEditDrive(null); }}/></> : filter.cohort_id ? <DriveEditor key={filter.cohort_id} cohortId={filter.cohort_id} onSaved={async () => { await load(); setMessage('Drive created.'); }}/>: <Text style={ui.body}>Select a cohort to create a drive.</Text>}</View></AdaptiveColumns>
    </>}
    {tab === 'Training' && <AdaptiveColumns><View style={frame.column}><Card><SectionHeading title="Shared review queue" description="Resume status for the current page of authorized students. Select a student to review their shared revision." />{students?.items.map(student => <View key={student.id} style={ui.divider}><Text style={ui.body}>{student.name} · {student.student_id}</Text><StatusTag>{student.resume_status.replaceAll('_', ' ')}</StatusTag><Action secondary compact disabled={busy} onPress={() => { setDetail(null); router.setParams({ student: String(student.id), section: 'reviews-training' }); }}>Inspect shared reviews for {student.name}</Action></View>)}{!students?.items.length && <Text style={ui.muted}>No authorized students in this page.</Text>}</Card>{detail && <Card><SectionHeading title={detail.profile.student.name} description="Shared saved revisions only. Feedback is required for a review decision." />{detail.reviews.length ? detail.reviews.map(review => <ReviewCard key={review.id} review={review} admin onUpdated={load} />) : <Text style={ui.body}>This student has not shared a resume revision with you.</Text>}<Action secondary onPress={() => openStudent(detail.profile.student.id)}>Open full student record</Action></Card>}</View><View style={frame.column}><Card><Text style={ui.kicker}>TRAINING ASSIGNMENT</Text><Text style={ui.heading}>Assign preparation</Text><Text style={ui.muted}>Choose an authorized cohort or the currently open student. Completion requires student-submitted evidence; assessments use the existing quiz service.</Text><Choices label="Assignee" values={[{ value: 'cohort', label: 'Selected cohort' }, { value: 'student', label: 'Open student' }]} selected={assignee} onSelect={value => setAssignee(value as 'cohort' | 'student')}/><Text style={ui.muted}>{assignee === 'student' ? `Student: ${detail?.profile.student.name ?? 'Open a student detail first'}` : `Cohort: ${cohorts.find(x => x.id === filter.cohort_id)?.name ?? 'Select a cohort first'}`}</Text>
      <Choices label="Training kind" values={(['resource', 'course', 'project', 'assessment'] as const).map(value => ({ value, label: value }))} selected={training.kind} onSelect={kind => setTraining(x => ({ ...x, kind }))}/>
      {(['title', 'instructions', 'resource_url', 'deadline'] as const).map(key => <Field key={key} label={`Training ${key === 'deadline' ? 'deadline (YYYY-MM-DD)' : key.replace('_', ' ')}`} value={training[key]} onChange={value => setTraining(x => ({ ...x, [key]: value }))} multiline={key === 'instructions'}/>)}
      <SelectField disabled={busy} label="Existing skill (assessment supports SQL, Python, Docker)" values={[{ value: 0, label: 'None' }, ...skills.map(x => ({ value: x.id, label: x.canonical_name }))]} selected={training.skill_id ?? 0} onSelect={skill_id => setTraining(x => ({ ...x, skill_id: skill_id || null }))}/>
      {assignee === 'student' && detail?.roadmap.length ? <Choices label="Reuse student roadmap resource" values={[{ value: 0, label: 'No roadmap link' }, ...detail.roadmap.map(x => ({ value: x.id, label: x.resource_title ?? x.task }))]} selected={training.roadmap_item_id ?? 0} onSelect={roadmap_item_id => setTraining(x => ({ ...x, roadmap_item_id: roadmap_item_id || null }))}/> : null}
      <Action disabled={busy} onPress={() => void run(assign)}>Save training assignments</Action><Text style={ui.muted}>Completion requires student-submitted evidence. Assigned assessments use the existing quiz and scoring service.</Text>
    </Card></View></AdaptiveColumns>}
    {tab === 'Reports' && <AdaptiveColumns><View style={frame.column}><Card><SectionHeading title="Faculty-scoped report" description="The CSV export uses your applied cohort, search and progress filters." /><StatusTag>CSV export</StatusTag><Text style={ui.body}>{scopeSummary}</Text><SelectField disabled={busy} label="Optional role gap context" values={[{ value: 0, label: 'No role context' }, ...roles.map(role => ({ value: role.id, label: role.title }))]} selected={roleId ?? 0} onSelect={id => setRoleId(id || null)} /><Text style={ui.muted}>Exports preserve the existing server-authorized scope. No private unshared resume text, artificial readiness tiers, or compliance-ledger claims are added.</Text><Action disabled={busy} onPress={() => void run(async () => { const bytes = await placementApi.report(applied, roleId ?? undefined); await downloadResume(bytes, 'aimora-cohort.csv', 'text/csv'); })}>Export filtered CSV</Action></Card></View><View style={frame.column}><Card><SectionHeading title="Current page preview" description={students ? `${students.items.length} records on page ${page} · ${students.total} total in applied scope. The export includes the full authorized scope.` : 'Loading the applied scope…'} />{students?.items.map(student => <View key={student.id} style={ui.divider}><Text style={ui.body}>{student.name} · {student.student_id}</Text><Text style={ui.muted}>Profile {student.profile_completion}% · Resume {student.resume_status.replaceAll('_', ' ')} · Assessments {student.assessments_completed} · Applications {student.applications}</Text></View>)}{students?.items.length === 0 && <Text style={ui.body}>No students match the applied filters.</Text>}</Card></View></AdaptiveColumns>}
  </WorkspacePage>;
}
