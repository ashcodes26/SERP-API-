import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { tasksApi, type TaskView, type TaskSort } from '@/api/client';
import { cp, PlanAction, PlanHeading } from '@/components/career-plan-design';
import { Action, Card, ui } from '@/components/career-ui';
import { Choices } from '@/components/placement-ui';
import { Confirm, Field } from '@/components/workspace-controls';
import { SectionHeading, StatusTag } from '@/components/screen-layout';
import { validTaskDate } from '@/utils/resume-workspace';
import type { Priority, RoadmapStatus, RoadmapTaskOut, TaskListOut } from '@/types/contracts';

export function PersonalTasks({ compact = false }: { compact?: boolean }) {
  const params = useLocalSearchParams<{ view?: string }>();
  const [visibility, setVisibility] = useState({ context: params.view, open: params.view === 'tasks' });
  const open = visibility.context === params.view ? visibility.open : params.view === 'tasks';
  const [view, setView] = useState<TaskView>('all');
  const [sort, setSort] = useState<TaskSort>('due_date');
  const [data, setData] = useState<TaskListOut | null>(null);
  const [editing, setEditing] = useState<RoadmapTaskOut | null>(null);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [due, setDue] = useState(''); const [priority, setPriority] = useState<Priority>('medium');
  const [deleting, setDeleting] = useState<RoadmapTaskOut | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const mutation = useRef(false); const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    try { const next = await tasksApi.list(view, sort); if (id === request.current) setData(next); }
    catch (cause) { if (id === request.current) setError(cause instanceof Error ? cause.message : 'Could not load saved tasks.'); }
  }, [view, sort]);
  useEffect(() => {
    if (!open) return;
    const id = ++request.current;
    void tasksApi.list(view, sort).then(next => { if (id === request.current) setData(next); }).catch(cause => { if (id === request.current) setError(cause instanceof Error ? cause.message : 'Could not load saved tasks.'); });
    return () => { request.current += 1; };
  }, [view, sort, open]);
  async function perform(work: () => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError('');
    try { await work(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your task. Your draft is preserved.'); }
    finally { mutation.current = false; setBusy(false); }
  }
  function resetForm() { setEditing(null); setTitle(''); setDescription(''); setDue(''); setPriority('medium'); }
  function edit(task: RoadmapTaskOut) { setEditing(task); setTitle(task.title); setDescription(task.description); setDue(task.due_date ?? ''); setPriority(task.priority); }
  const changeStatus = (task: RoadmapTaskOut, status: RoadmapStatus) => void perform(async () => { await tasksApi.update(task.id, { version: task.version, status }); });
  return <Card style={compact ? cp.section : undefined}>
    {compact ? <PlanHeading title="Personal learning tasks" description="Saved personal tasks · completion does not change assessed proficiency." aside={<PlanAction secondary onPress={() => setVisibility({ context: params.view, open: !open })}>{open ? 'Hide tasks' : 'Open tasks'}</PlanAction>} /> : <SectionHeading title="Personal learning tasks" description="Your saved tasks, including actions added from LinkedIn analysis. Task completion is self-recorded and does not change assessed proficiency." aside={<Action secondary compact onPress={() => setVisibility({ context: params.view, open: !open })}>{open ? 'Hide tasks' : 'Open tasks'}</Action>} />}
    {open && <>
      <Choices disabled={busy} label="Task view" values={(['all', 'today', 'upcoming', 'completed'] as const).map(value => ({ value, label: value }))} selected={view} onSelect={next => { setView(next); setData(null); setError(''); }} />
      <Choices disabled={busy} label="Sort tasks" values={(['due_date', 'priority', 'updated', 'title'] as const).map(value => ({ value, label: value.replaceAll('_', ' ') }))} selected={sort} onSelect={next => { setSort(next); setData(null); setError(''); }} />
      {data && <Text style={ui.muted}>{data.completed} completed · {data.remaining} remaining · {data.total} saved tasks</Text>}
      <Action secondary compact disabled={busy} onPress={() => { setError(''); void load(); }}>Reload saved tasks</Action>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {busy && <Text accessibilityLiveRegion="polite" style={ui.muted}>Updating saved tasks…</Text>}
      {!data && !error && <Text style={ui.muted}>Loading saved tasks…</Text>}
      {data?.tasks.length === 0 && <Text style={ui.body}>No tasks in this view. Add a task below or choose another view.</Text>}
      {data?.tasks.map(task => <View key={task.id} style={ui.divider}>
        <SectionHeading title={task.title} description={task.description} aside={<StatusTag tone={task.status === 'done' ? 'success' : 'neutral'}>{task.status.replaceAll('_', ' ')}</StatusTag>} />
        <Text style={ui.muted}>{task.priority} priority · Due {task.due_date ?? 'not set'}{task.roadmap_milestone_id ? ` · Milestone #${task.roadmap_milestone_id}` : ''}</Text>
        <View style={ui.row}>{(['not_started', 'in_progress', 'done'] as const).map(status => <Action key={status} secondary compact disabled={busy || task.status === status} onPress={() => changeStatus(task, status)}>{status.replaceAll('_', ' ')}</Action>)}<Action secondary compact disabled={busy} onPress={() => edit(task)}>Edit task</Action><Action secondary compact disabled={busy} onPress={() => { setError(''); setDeleting(task); }}>Delete task</Action></View>
      </View>)}
      <View style={ui.divider}><Text style={ui.heading}>{editing ? 'Edit saved task' : 'Add a personal task'}</Text>
        <Field label="Task title" value={title} onChange={setTitle} maxLength={200} disabled={busy} />
        <Field label="Task description" value={description} onChange={setDescription} multiline maxLength={4000} disabled={busy} />
        <Field label="Task due date (YYYY-MM-DD, optional)" value={due} onChange={setDue} maxLength={10} disabled={busy} />
        {!!due && !validTaskDate(due) && <Text style={ui.error}>Enter a valid calendar date in YYYY-MM-DD format.</Text>}
        <Choices disabled={busy} label="Task priority" values={(['high', 'medium', 'low'] as const).map(value => ({ value, label: value }))} selected={priority} onSelect={setPriority} />
        <Action disabled={busy || !title.trim() || !validTaskDate(due)} onPress={() => void perform(async () => { const values = { title: title.trim(), description, priority, due_date: due || null }; if (editing) await tasksApi.update(editing.id, { ...values, version: editing.version }); else await tasksApi.create(values); resetForm(); })}>{editing ? 'Save task changes' : 'Add task'}</Action>
        {editing && <Action secondary disabled={busy} onPress={resetForm}>Cancel task edit</Action>}
      </View>
    </>}
    {deleting && <Confirm title="Delete task" message={`Delete “${deleting.title}”? This removes this saved task only; it does not remove its roadmap milestone.${error ? `\n\n${error}` : ''}`} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => void perform(async () => { await tasksApi.remove(deleting.id, deleting.version); if (editing?.id === deleting.id) resetForm(); setDeleting(null); })} />}
  </Card>;
}
