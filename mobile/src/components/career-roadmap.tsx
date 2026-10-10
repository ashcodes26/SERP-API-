import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { jobsApi, session, tasksApi, type TaskSort, type TaskView } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import { Check, Confirm, Field } from '@/components/workspace-controls';
import { design as d } from '@/constants/design';
import { validTaskDate } from '@/utils/resume-workspace';
import type { Priority, RoadmapItemOut, RoadmapTaskOut, SkillOut, TaskListOut } from '@/types/contracts';

export default function CareerRoadmap({ items, onChange }: { items: RoadmapItemOut[]; onChange: (items: RoadmapItemOut[]) => void }) {
  const { width } = useWindowDimensions();
  const student = session.getStudentId();
  const [data, setData] = useState<TaskListOut | null>(null);
  const [skills, setSkills] = useState<SkillOut[]>([]);
  const [filter, setFilter] = useState<TaskView>('all');
  const [sort, setSort] = useState<TaskSort>('due_date');
  const [extra, setExtra] = useState<RoadmapItemOut | null>(null);
  const [selected, setSelected] = useState<number | null>(items[0]?.id ?? null);
  const [operationBusy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!student); const busy = operationBusy || loading;
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<RoadmapTaskOut | 'new' | null>(null);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium'); const [due, setDue] = useState('');
  const [milestone, setMilestone] = useState<number | null>(null); const [skill, setSkill] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<RoadmapTaskOut | null>(null);
  const [evidence, setEvidence] = useState<Record<number, string>>({});
  const reload = useCallback(async () => { if (student) setData(await tasksApi.list(filter, sort)); }, [student, filter, sort]);
  const perform = useCallback(async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed; your form is preserved.'); }
    finally { lock.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    let active = true;
    if (!student) return;
    void Promise.all([tasksApi.list(filter, sort), tasksApi.skills()]).then(([list, knownSkills]) => {
      if (active) { setData(list); setSkills(knownSkills); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load tasks.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [student, filter, sort]);
  function editor(task: RoadmapTaskOut | null = null, item?: RoadmapItemOut) {
    setEditing(task ?? 'new'); setTitle(task?.title ?? (item ? `Practice: ${item.task}`.slice(0, 200) : ''));
    setDescription(task?.description ?? item?.completion_criteria ?? ''); setPriority(task?.priority ?? 'medium'); setDue(task?.due_date ?? '');
    setMilestone(task?.roadmap_milestone_id ?? item?.id ?? null); setSkill(task?.skill_id ?? item?.skill_id ?? null); setError('');
  }
  function saveTask() {
    if (!title.trim()) { setError('Enter a task title.'); return; }
    if (!validTaskDate(due)) { setError('Use a valid YYYY-MM-DD date, or leave it blank.'); return; }
    void perform(async () => {
      const body = { title: title.trim(), description, priority, due_date: due || null, roadmap_milestone_id: milestone, skill_id: skill };
      if (editing && editing !== 'new') await tasksApi.update(editing.id, { ...body, version: editing.version });
      else await tasksApi.create(body);
      setEditing(null); await reload();
    });
  }
  const completeMilestone = (item: RoadmapItemOut) => void perform(async () => {
    const result = await jobsApi.progress(item.id, item.status === 'done' ? 'in_progress' : 'done', evidence[item.id] ?? item.completion_evidence ?? undefined);
    if (extra?.id === result.id) setExtra(result);
    onChange(items.map(x => x.id === result.id ? result : x));
  });
  const visibleItem = items.find(x => x.id === selected) ?? (extra?.id === selected ? extra : null);
  const done = items.filter(x => x.status === 'done').length;
  return <View nativeID="career-roadmap-panels" style={{ flexDirection: width >= 1000 ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
    <View style={{ flex: 1, minWidth: 0 }}><Card><Text style={ui.kicker}>CAREER ROADMAP</Text><Text style={ui.heading}>Your learning milestones</Text><Text style={ui.body}>{done} of {items.length} milestones completed</Text><Text style={ui.muted}>Milestones require completion evidence. To-do completion is separate from proficiency.</Text>
      {items.length === 0 && <Text style={ui.body}>No milestones for this analysis. You can still add your own practical tasks.</Text>}
      <ScrollView nestedScrollEnabled style={width >= 1000 ? { maxHeight: 900 } : undefined} contentContainerStyle={{ gap: 12 }}>
        {items.map((item, index) => { const count = data?.milestone_counts[String(item.id)]; return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open milestone ${item.task}`} accessibilityState={{ selected: selected === item.id }} onPress={() => setSelected(item.id)} style={[ui.chip, selected === item.id && ui.selected, { borderLeftWidth: 3, borderLeftColor: item.status === 'done' ? d.accent : item.status === 'in_progress' ? d.body : d.border }]}><Text style={ui.muted}>WEEK {item.week ?? index + 1} / {item.status.replaceAll('_', ' ')}</Text><Text style={ui.body}>{item.task}</Text><Text style={ui.muted}>{count?.completed ?? 0} / {count?.total ?? 0} linked to-dos completed</Text></Pressable>; })}
        {visibleItem && <View style={ui.divider}><Text style={ui.heading}>{visibleItem.task}</Text><Text style={ui.body}>{visibleItem.objective}</Text><Text style={ui.muted}>Related skill: {skills.find(x => x.id === visibleItem.skill_id)?.canonical_name ?? `Skill #${visibleItem.skill_id}`} / {visibleItem.effort_hours ?? 'Unspecified'} estimated hours</Text><Text style={ui.muted}>Resource: {visibleItem.resource_provenance?.replaceAll('_', ' ') ?? 'Not supplied'}</Text>{visibleItem.resource_url && <Action secondary onPress={() => void perform(async () => { if (!/^https:\/\//i.test(visibleItem.resource_url!)) throw new Error('Unsupported resource URL.'); await Linking.openURL(visibleItem.resource_url!); })} disabled={busy}>{visibleItem.resource_title ?? 'Open learning resource'} ↗</Action>}<Text style={ui.body}>Completion criteria: {visibleItem.completion_criteria ?? 'Review the milestone exercise.'}</Text><Field label={`Milestone evidence ${visibleItem.id}`} value={evidence[visibleItem.id] ?? visibleItem.completion_evidence ?? ''} onChange={text => setEvidence(prev => ({ ...prev, [visibleItem.id]: text }))} maxLength={2000} multiline disabled={busy} />
          <Action secondary disabled={busy || !student} onPress={() => completeMilestone(visibleItem)}>{visibleItem.status === 'done' ? 'Reopen milestone' : 'Record milestone completion'}</Action><Action disabled={busy || !student} onPress={() => editor(null, visibleItem)}>Add task from this milestone</Action>
        </View>}
      </ScrollView>
    </Card></View>
    <View style={{ flex: 1, minWidth: 0 }}><Card><Text style={ui.kicker}>SMALL STEPS / REAL PROGRESS</Text><Text style={ui.heading}>My To-Do List</Text><Text style={ui.muted}>Tasks are privately saved to your account. Today and Upcoming use UTC calendar dates.</Text>
      {!student ? <Text style={ui.body}>Sign in as a student to manage personal tasks.</Text> : <>
        {data && <><Text style={ui.body}>{data.completed} completed / {data.remaining} remaining / {data.total} total</Text><View accessibilityRole="progressbar" accessibilityLabel="To-do completion" accessibilityValue={{ min: 0, max: 100, now: data.completion_percentage ?? 0 }} style={{ height: 5, backgroundColor: d.border }}><View style={{ height: 5, backgroundColor: d.body, width: `${data.completion_percentage ?? 0}%` }} /></View><Text style={ui.muted}>{data.completion_percentage === null ? 'Add a task to start measuring progress.' : `${data.completion_percentage}% task completion`}</Text></>}
        <Action disabled={busy} onPress={() => editor()}>Add Task</Action><View style={ui.row}>{(['all', 'today', 'upcoming', 'completed'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Task filter ${value}`} aria-checked={filter === value} accessibilityState={{ checked: filter === value, disabled: busy }} disabled={busy} onPress={() => { if (filter !== value) { setLoading(true); setFilter(value); } }} style={[ui.chip, filter === value && ui.selected]}><Text style={ui.body}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
        <Text style={ui.label}>Sort tasks</Text><View style={ui.row}>{([['due_date', 'Due date'], ['priority', 'Priority'], ['updated', 'Recent'], ['title', 'Title']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" aria-checked={sort === value} accessibilityState={{ checked: sort === value, disabled: busy }} disabled={busy} onPress={() => { if (sort !== value) { setLoading(true); setSort(value); } }} style={[ui.chip, sort === value && ui.selected]}><Text style={ui.body}>{label}</Text></Pressable>)}</View>
        {busy && <ActivityIndicator color={d.accent} />}{!!error && <Text accessibilityRole="alert" style={ui.error}>{error} Your local form is preserved.</Text>}<Action secondary disabled={busy} onPress={() => void perform(reload)}>Refresh saved tasks</Action>
        {editing && <View style={ui.divider}><Text style={ui.heading}>{editing === 'new' ? 'New task' : 'Edit task'}</Text><Field label="Task title" value={title} onChange={setTitle} maxLength={200} disabled={busy} /><Field label="Task description" value={description} onChange={setDescription} multiline maxLength={4000} disabled={busy} /><Field label="Due date (YYYY-MM-DD, optional)" value={due} onChange={setDue} maxLength={10} disabled={busy} /><Text style={ui.label}>Priority</Text><View style={ui.row}>{(['low', 'medium', 'high'] as const).map(value => <Pressable key={value} accessibilityRole="radio" aria-checked={priority === value} accessibilityState={{ checked: priority === value, disabled: busy }} disabled={busy} onPress={() => setPriority(value)} style={[ui.chip, priority === value && ui.selected]}><Text style={ui.body}>{value}</Text></Pressable>)}</View><Text style={ui.label}>Milestone (optional)</Text><View style={{ gap: 8 }}><Action secondary disabled={busy} onPress={() => { setMilestone(null); setSkill(null); }}>No milestone{milestone === null ? ' ✓' : ''}</Action>{items.map(item => <Action key={item.id} secondary disabled={busy} onPress={() => { setMilestone(item.id); setSkill(item.skill_id); }}>{item.task}{milestone === item.id ? ' ✓' : ''}</Action>)}</View>
          {!milestone && <><Text style={ui.label}>Related skill (optional)</Text><View style={ui.row}><Action secondary disabled={busy} onPress={() => setSkill(null)}>None{skill === null ? ' ✓' : ''}</Action>{skills.map(item => <Action key={item.id} secondary disabled={busy} onPress={() => setSkill(item.id)}>{item.canonical_name}{skill === item.id ? ' ✓' : ''}</Action>)}</View></>}
          <Action disabled={busy || !title.trim()} onPress={saveTask}>Save task</Action><Action secondary disabled={busy} onPress={() => setEditing(null)}>Cancel task editing</Action></View>}
        {data && data.tasks.length === 0 && <Text style={ui.body}>{data.total === 0 ? 'Your list is clear. Add a task or create one from a milestone.' : 'No tasks match this filter. Try All.'}</Text>}
        <ScrollView nestedScrollEnabled style={width >= 1000 ? { maxHeight: 700 } : undefined} contentContainerStyle={{ gap: 16 }}>{data?.tasks.map(task => <View key={task.id} style={ui.divider}><Check label={task.title} checked={task.status === 'done'} disabled={busy} onChange={checked => void perform(async () => { await tasksApi.update(task.id, { version: task.version, status: checked ? 'done' : 'not_started' }); await reload(); })} /><Text style={ui.body}>{task.description}</Text><Text style={ui.muted}>{task.priority.toUpperCase()} / {task.status.replaceAll('_', ' ')} / Due: {task.due_date ?? 'Not set'}</Text><Text style={ui.muted}>{task.skill_id ? `Skill: ${skills.find(x => x.id === task.skill_id)?.canonical_name ?? '#' + task.skill_id}` : 'No skill linked'}</Text>{task.roadmap_milestone_id && <Action secondary disabled={busy} onPress={() => { const linked = items.find(x => x.id === task.roadmap_milestone_id); if (linked) setSelected(linked.id); else void perform(async () => { const saved = await tasksApi.milestone(task.roadmap_milestone_id!); setExtra(saved); setSelected(saved.id); }); }}>Open linked milestone</Action>}<View style={ui.row}><Action secondary disabled={busy} onPress={() => editor(task)}>Edit task</Action><Action secondary disabled={busy} onPress={() => setDeleting(task)}>Delete task</Action></View></View>)}</ScrollView>
      </>}
    </Card></View>
    {deleting && <Confirm title="Delete task" message={`Remove “${deleting.title}” permanently? Milestone progress stays as recorded.`} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => void perform(async () => { await tasksApi.remove(deleting.id, deleting.version); setDeleting(null); await reload(); })} />}
  </View>;
}
