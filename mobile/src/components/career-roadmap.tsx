import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { jobsApi, session, tasksApi, type TaskSort, type TaskView } from '@/api/client';
import { Action, Card, Details, ui } from '@/components/career-ui';
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
  const [selected, setSelected] = useState<number | null>(null);
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
    setEditing(task ?? 'new'); setTitle(task?.title ?? item?.task.slice(0, 200) ?? '');
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
  const milestoneDetails = visibleItem ? <View style={ui.divider}>
        {!items.some(item => item.id === visibleItem.id) && <Text style={ui.heading}>{visibleItem.task}</Text>}
        <Text style={ui.body}>{visibleItem.objective}</Text>
        {visibleItem.completion_criteria !== visibleItem.objective && <Text style={ui.body}>{visibleItem.completion_criteria ?? 'Review the milestone exercise.'}</Text>}
        {visibleItem.resource_url && <Action secondary onPress={() => void perform(async () => {
          if (!/^https:\/\//i.test(visibleItem.resource_url!)) throw new Error('Unsupported resource URL.');
          await Linking.openURL(visibleItem.resource_url!);
        })} disabled={busy}>{visibleItem.resource_title ?? 'Learning resource'} ↗</Action>}
        <Details label="Resource details">
          <Text style={ui.body}>{skills.find(item => item.id === visibleItem.skill_id)?.canonical_name ?? `Skill #${visibleItem.skill_id}`}</Text>
          {visibleItem.effort_hours != null && <Text style={ui.body}>{visibleItem.effort_hours} estimated hours</Text>}
          <Text style={ui.body}>Source: {visibleItem.resource_provenance?.replaceAll('_', ' ') ?? 'Not supplied'}</Text>
        </Details>
        <Field label="Completion evidence" value={evidence[visibleItem.id] ?? visibleItem.completion_evidence ?? ''} onChange={value => setEvidence(previous => ({ ...previous, [visibleItem.id]: value }))} maxLength={2000} multiline disabled={busy} />
        <View style={ui.row}>
          <Action secondary disabled={busy || !student} onPress={() => completeMilestone(visibleItem)}>{visibleItem.status === 'done' ? 'Reopen' : 'Complete milestone'}</Action>
          <Action disabled={busy || !student} onPress={() => editor(null, visibleItem)}>Add to-do</Action>
        </View>
      </View> : null;
  return <View nativeID="career-roadmap-panels" style={{ flexDirection: width >= 1000 ? 'row' : 'column', gap: 32, alignItems: 'flex-start' }}>
    <View style={{ flex: 1, minWidth: 0, width: '100%' }}><Card>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.heading}>Milestones</Text>
        <Text style={ui.body}>{done}/{items.length} done</Text>
      </View>
      {items.length === 0 && <Text style={ui.body}>No milestones yet.</Text>}
      {items.map((item, index) => {
        const count = data?.milestone_counts[String(item.id)];
        return <View key={item.id} style={{ gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel={`Open milestone ${item.task}`} accessibilityState={{ expanded: selected === item.id }} onPress={() => setSelected(current => current === item.id ? null : item.id)} style={[ui.chip, selected === item.id && ui.selected, { gap: 8, borderLeftWidth: 3, borderLeftColor: item.status === 'done' ? d.accent : d.border }]}>
          <Text style={[ui.body, { color: d.text }]}>{item.task}</Text>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={ui.body}>Week {item.week ?? index + 1}</Text>
            <Text style={ui.body}>{item.status.replaceAll('_', ' ')}</Text>
          </View>
          {!!count?.total && <Text style={ui.body}>{count.completed}/{count.total} to-dos done</Text>}
        </Pressable>{visibleItem?.id === item.id && milestoneDetails}</View>;
      })}
      {visibleItem && !items.some(item => item.id === visibleItem.id) && milestoneDetails}
    </Card></View>
    <View style={{ flex: 1, minWidth: 0, width: '100%' }}><Card>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.heading}>To-do</Text>
        {student && <Action disabled={busy} onPress={() => editor()}>Add task</Action>}
      </View>
      {!student ? <Text style={ui.body}>Sign in to manage tasks.</Text> : <>
        {data && <Text style={ui.body}>{data.remaining} remaining · {data.completed} done</Text>}
        <View style={ui.row}>{(['all', 'today', 'upcoming', 'completed'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Task filter ${value}`} aria-checked={filter === value} accessibilityState={{ checked: filter === value, disabled: busy }} disabled={busy} onPress={() => { if (filter !== value) { setLoading(true); setFilter(value); } }} style={[ui.chip, filter === value && ui.selected]}><Text style={ui.body}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
        <Details label="Sort"><View style={ui.row}>{([['due_date', 'Due date'], ['priority', 'Priority'], ['updated', 'Recent'], ['title', 'Title']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" aria-checked={sort === value} accessibilityState={{ checked: sort === value, disabled: busy }} disabled={busy} onPress={() => { if (sort !== value) { setLoading(true); setSort(value); } }} style={[ui.chip, sort === value && ui.selected]}><Text style={ui.body}>{label}</Text></Pressable>)}</View></Details>
        {busy && <ActivityIndicator color={d.accent} />}
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
        {editing && <View style={ui.divider}>
          <Text style={ui.heading}>{editing === 'new' ? 'New task' : 'Edit task'}</Text>
          <Field label="Title" value={title} onChange={setTitle} maxLength={200} disabled={busy} />
          <Field label="Description" value={description} onChange={setDescription} multiline maxLength={4000} disabled={busy} />
          <Field label="Due date (YYYY-MM-DD, UTC)" value={due} onChange={setDue} maxLength={10} disabled={busy} />
          <Text style={ui.body}>Priority</Text>
          <View style={ui.row}>{(['low', 'medium', 'high'] as const).map(value => <Pressable key={value} accessibilityRole="radio" aria-checked={priority === value} accessibilityState={{ checked: priority === value, disabled: busy }} disabled={busy} onPress={() => setPriority(value)} style={[ui.chip, priority === value && ui.selected]}><Text style={ui.body}>{value}</Text></Pressable>)}</View>
          <Text style={ui.body}>Milestone</Text>
          <View style={{ gap: 8 }}>
            <Action secondary disabled={busy} onPress={() => { setMilestone(null); setSkill(null); }}>None{milestone === null ? ' ✓' : ''}</Action>
            {items.map(item => <Action key={item.id} secondary disabled={busy} onPress={() => { setMilestone(item.id); setSkill(item.skill_id); }}>{item.task}{milestone === item.id ? ' ✓' : ''}</Action>)}
          </View>
          {!milestone && <><Text style={ui.body}>Related skill</Text><View style={ui.row}><Action secondary disabled={busy} onPress={() => setSkill(null)}>None{skill === null ? ' ✓' : ''}</Action>{skills.map(item => <Action key={item.id} secondary disabled={busy} onPress={() => setSkill(item.id)}>{item.canonical_name}{skill === item.id ? ' ✓' : ''}</Action>)}</View></>}
          <View style={ui.row}><Action disabled={busy || !title.trim()} onPress={saveTask}>Save</Action><Action secondary disabled={busy} onPress={() => setEditing(null)}>Cancel</Action></View>
        </View>}
        {data && data.tasks.length === 0 && <Text style={ui.body}>{data.total === 0 ? 'No tasks yet.' : 'No tasks in this view.'}</Text>}
        {data?.tasks.map(task => <View key={task.id} style={ui.divider}>
          <Check label={task.title} checked={task.status === 'done'} disabled={busy} onChange={checked => void perform(async () => { await tasksApi.update(task.id, { version: task.version, status: checked ? 'done' : 'not_started' }); await reload(); })} />
          <Details label="Details">
            {!!task.description && task.description !== task.title && <Text style={ui.body}>{task.description}</Text>}
            <Text style={ui.body}>{task.priority[0].toUpperCase() + task.priority.slice(1)} priority{task.due_date ? ` · ${task.due_date} (UTC)` : ''}</Text>
            {task.skill_id !== null && <Text style={ui.body}>{skills.find(item => item.id === task.skill_id)?.canonical_name ?? `Skill #${task.skill_id}`}</Text>}
            {!!task.roadmap_milestone_id && <Action secondary disabled={busy} onPress={() => {
              const linked = items.find(item => item.id === task.roadmap_milestone_id);
              if (linked) setSelected(linked.id);
              else void perform(async () => { const saved = await tasksApi.milestone(task.roadmap_milestone_id!); setExtra(saved); setSelected(saved.id); });
            }}>View milestone</Action>}
            <View style={ui.row}><Action secondary disabled={busy} onPress={() => editor(task)}>Edit</Action><Action secondary disabled={busy} onPress={() => setDeleting(task)}>Delete</Action></View>
          </Details>
        </View>)}
        <View style={ui.row}><Action secondary disabled={busy} onPress={() => void perform(reload)}>Refresh</Action></View>
      </>}
    </Card></View>
    {deleting && <Confirm title="Delete task" message={`Remove "${deleting.title}" permanently?`} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => void perform(async () => { await tasksApi.remove(deleting.id, deleting.version); setDeleting(null); await reload(); })} />}
  </View>;
}
