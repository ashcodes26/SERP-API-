import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { jobsApi } from '@/api/client';
import { cp, planSurface, PlanIcon, PlanAction, PlanDetails, PlanTag } from '@/components/career-plan-design';
import { Action, Details, ui } from '@/components/career-ui';
import { Field } from '@/components/workspace-controls';
import { page, SectionHeading, StatusTag } from '@/components/screen-layout';
import { design as d } from '@/constants/design';
import type { RoadmapItemOut, RoadmapStatus } from '@/types/contracts';

export function RoadmapMilestone({ item, index, onUpdate, busy, run, compact = false }: { compact?: boolean; item: RoadmapItemOut; index: number; onUpdate: (saved: RoadmapItemOut) => void; busy: boolean; run: (work: () => Promise<void>) => Promise<void> }) {
  const [evidence, setEvidence] = useState(item.completion_evidence ?? '');
  const [error, setError] = useState('');
  const update = (status: RoadmapStatus) => void run(async () => {
    setError('');
    try { onUpdate(await jobsApi.progress(item.id, status, evidence)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save progress. Your evidence draft is preserved.'); }
  });
  if (compact) return <View style={{ flexDirection: 'row', gap: 8 }}>
    <View style={{ width: 20, alignItems: 'center' }}><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: item.status === 'done' ? d.successText : item.status === 'in_progress' ? d.highlight : d.strongBorder, alignItems: 'center', justifyContent: 'center' }}><PlanIcon name={item.status === 'done' ? 'check' : 'clock'} size={16} color={item.status === 'done' ? d.successText : item.status === 'in_progress' ? d.highlight : d.muted} /></View><View style={{ width: 1, flex: 1, backgroundColor: d.strongBorder }} /></View>
    <View style={{ flex: 1, minWidth: 0, padding: 16, gap: 8, borderRadius: 4, borderWidth: 1, borderColor: item.status === 'in_progress' ? '#665020' : d.border, backgroundColor: planSurface, marginBottom: 24 }}>
      <View style={[cp.spread, { alignItems: 'flex-start' }]}><View style={{ flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><View style={{ backgroundColor: d.higher, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3 }}><Text style={[cp.label, { fontSize: 11, lineHeight: 16, color: item.status === 'done' ? d.successText : item.status === 'in_progress' ? d.highlight : d.muted }]}>MS-{String(index + 1).padStart(2, '0')}</Text></View><Text accessibilityRole="header" style={[cp.strong, { flex: 1, minWidth: 0 }]}>{item.task}</Text></View><PlanTag tone={item.status === 'done' ? 'success' : item.status === 'in_progress' ? 'warning' : 'neutral'}>{item.status === 'done' ? 'Completed' : item.status === 'in_progress' ? 'Active milestone' : 'Not started'}</PlanTag></View>
      {item.objective && <Text style={[cp.body, { color: item.status === 'in_progress' ? d.body : d.muted }]}>{item.objective}</Text>}
      <View style={cp.spread}><Text style={cp.small}>{item.week ? `Week ${item.week} · ` : ''}Estimated workload: {item.effort_hours ?? 'Unknown'} hours</Text><Text style={cp.small}>Resource: {item.resource_provenance?.replaceAll('_', ' ') || 'Not supplied'}</Text></View>
      <PlanDetails label="Resources, completion criteria & progress">
        {item.resource_title && <Text style={cp.body}>Learning resource: {item.resource_title}</Text>}
              {item.resource_url && <PlanAction secondary disabled={busy} onPress={() => void run(async () => { setError(''); try { const url = item.resource_url!; if (!/^https?:\/\//i.test(url) || !await Linking.canOpenURL(url)) throw new Error('This resource link cannot be opened.'); await Linking.openURL(url); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open resource.'); } })}>Open learning resource</PlanAction>}
        {item.completion_criteria && <Text style={cp.small}>Completion criteria: {item.completion_criteria}</Text>}
        {item.completion_evidence && <Text selectable style={cp.small}>Saved evidence: {item.completion_evidence}</Text>}
        <Field label={`Completion evidence for milestone ${item.id}`} value={evidence} onChange={setEvidence} multiline disabled={busy} maxLength={2000} placeholder="Describe completed work and supporting references." />
        <Text style={cp.small}>Self-recorded progress does not independently verify skills or change assessment scores.</Text>
        <View style={cp.row}><PlanAction secondary disabled={busy} onPress={() => update('not_started')}>Not started</PlanAction><PlanAction secondary disabled={busy} onPress={() => update('in_progress')}>In progress</PlanAction><PlanAction disabled={busy || !evidence.trim()} onPress={() => update('done')}>Save as completed</PlanAction></View>
      </PlanDetails>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    </View>
  </View>;
  return <View style={{ flexDirection: 'row', gap: 12 }}>
    <View style={{ width: 28, alignItems: 'center' }}><View style={{ borderWidth: 1, borderColor: item.status === 'done' ? d.successText : item.status === 'in_progress' ? d.highlight : d.strongBorder, borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}><Text style={ui.label}>{item.status === 'done' ? '✓' : index + 1}</Text></View><View style={{ flex: 1, width: 1, backgroundColor: d.strongBorder }} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 12, backgroundColor: d.higher, padding: 16, borderRadius: 6, borderWidth: 1, borderColor: item.status === 'in_progress' ? d.highlight : d.border, marginBottom: 16 }}>
      <Text style={ui.kicker}>MILESTONE {String(index + 1).padStart(2, '0')}{item.week ? ` · WEEK ${item.week}` : ''}</Text>
      <SectionHeading title={item.task} aside={<StatusTag tone={item.status === 'done' ? 'success' : item.status === 'in_progress' ? 'warning' : 'neutral'}>{item.status.replaceAll('_', ' ')}</StatusTag>} />
      {item.objective && <Text style={ui.body}>{item.objective}</Text>}
      <View style={page.sectionHeader}>{item.effort_hours !== null && item.effort_hours !== undefined && <Text style={ui.muted}>Estimated effort: {item.effort_hours} hours</Text>}{item.resource_provenance && <StatusTag>{item.resource_provenance.replaceAll('_', ' ')}</StatusTag>}</View>
      {item.resource_title && <Text style={ui.body}>Learning resource: {item.resource_title}</Text>}
      {item.resource_url && <Action secondary compact disabled={busy} onPress={() => void run(async () => { setError(''); try { const url = item.resource_url!; if (!/^https?:\/\//i.test(url) || !await Linking.canOpenURL(url)) throw new Error('This resource link cannot be opened.'); await Linking.openURL(url); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open resource.'); } })}>Open learning resource</Action>}
      {item.completion_criteria && <Text style={ui.muted}>Completion criteria: {item.completion_criteria}</Text>}
      {item.completion_evidence && <Text selectable style={ui.muted}>Saved evidence: {item.completion_evidence}</Text>}
      <Details label="Record milestone progress"><Field label={`Completion evidence for milestone ${item.id}`} value={evidence} onChange={setEvidence} multiline disabled={busy} maxLength={2000} placeholder="Describe the work you completed and include supporting references." /><Text style={ui.muted}>Completion is self-recorded and does not independently verify a skill or change assessment scores.</Text><View style={ui.row}><Action secondary compact disabled={busy} onPress={() => update('not_started')}>Not started</Action><Action secondary compact disabled={busy} onPress={() => update('in_progress')}>In progress</Action><Action compact disabled={busy || !evidence.trim()} onPress={() => update('done')}>Save as completed</Action></View></Details>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    </View>
  </View>;
}
