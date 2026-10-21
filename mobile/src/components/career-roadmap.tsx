import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { jobsApi, session } from '@/api/client';
import { cp, PlanAction, PlanDetails } from '@/components/career-plan-design';
import { Action, Card, ui } from '@/components/career-ui';
import { Check, Field } from '@/components/workspace-controls';
import AiExplanation from '@/components/ai-explanation';
import { design as d } from '@/constants/design';
import type { RoadmapAiOut, RoadmapItemOut } from '@/types/contracts';
import { RoadmapMilestone } from '@/components/roadmap-milestone';

type Props = { items: RoadmapItemOut[]; onChange: (items: RoadmapItemOut[]) => void; analysisId?: number; compact?: boolean };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] as string));
const readableStatus = (status: string) => status.replaceAll('_', ' ');

function reportHtml(items: RoadmapItemOut[]) {
  const rows = items.map(item => `<tr><td>${item.week ?? '—'}</td><td>${escapeHtml(item.task)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.completion_evidence ?? 'Not recorded')}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Skillup progress report</title><style>body{font-family:Arial,sans-serif;color:#16131d;margin:42px;line-height:1.45}h1{margin-bottom:4px}p{color:#5e5967}table{width:100%;border-collapse:collapse;margin-top:26px}th,td{padding:11px;text-align:left;border-bottom:1px solid #ddd}th{background:#f4f0ff}@media print{body{margin:22px}}</style></head><body><h1>Skillup progress report</h1><p>Generated ${new Date().toLocaleString()}</p><table><thead><tr><th>Week</th><th>Roadmap item</th><th>Status</th><th>Completion evidence</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No saved progress items.</td></tr>'}</tbody></table></body></html>`;
}
function download(contents: string, filename: string, type: string) {
  if (Platform.OS !== 'web') return;
  const blob = new Blob([contents], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
function aiHtml(plan: RoadmapAiOut) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Skillup AI roadmap</title><style>body{font-family:Arial,sans-serif;margin:42px;line-height:1.5}h1{color:#2a174f}h2{margin-top:28px}</style></head><body><h1>Skillup AI learning roadmap</h1><p>${escapeHtml(plan.summary ?? '')}</p>${plan.phases.map((phase, index) => `<section><h2>${index + 1}. ${escapeHtml(phase.title)}</h2><ul>${phase.actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul></section>`).join('')}</body></html>`;
}

export default function CareerRoadmap({ items, onChange, analysisId, compact = false }: Props) {
  const latestItems = useRef(items);
  useEffect(() => { latestItems.current = items; }, [items]);
  const progressLock = useRef(false);
  const [progressBusy, setProgressBusy] = useState(false);
  const runProgress = async (work: () => Promise<void>) => {
    if (progressLock.current) return;
    progressLock.current = true; setProgressBusy(true);
    try { await work(); } finally { progressLock.current = false; setProgressBusy(false); }
  };
  const updatedMilestone = (saved: RoadmapItemOut) => { const next = latestItems.current.map(item => item.id === saved.id ? saved : item); latestItems.current = next; onChange(next); };
  const [description, setDescription] = useState(''); const [consent, setConsent] = useState(false); const [plan, setPlan] = useState<RoadmapAiOut | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const lock = useRef(false); const studentId = session.getStudentId();
  const createPlan = async () => {
    if (!studentId || !analysisId || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { setPlan(await jobsApi.aiRoadmap(studentId, analysisId, description.trim(), consent)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create the AI roadmap.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const exportPdf = () => {
    if (Platform.OS !== 'web') return;
    const printable = window.open('', '_blank');
    if (!printable) { setError('Allow pop-ups to export this progress report as PDF.'); return; }
    printable.document.write(reportHtml(items)); printable.document.close(); printable.focus(); printable.print();
  };

  if (compact) return <View style={cp.divider}>
    <View style={cp.spread}><Text style={cp.small}>{items.reduce((sum, item) => sum + (item.effort_hours ?? 0), 0)} estimated learning hours · {items.length} displayed milestone{items.length === 1 ? '' : 's'}</Text>
      {Platform.OS === 'web' && <View style={[cp.row, { gap: 6 }]}><PlanAction secondary icon="export" onPress={exportPdf}>Export progress PDF</PlanAction><PlanAction secondary onPress={() => download(reportHtml(items), 'skillup-progress-report.doc', 'application/msword')}>Export DOC</PlanAction></View>}
    </View>
    {items.length ? <View>{items.map((item, index) => <RoadmapMilestone compact key={`${item.id}:${item.status}`} item={item} index={index} onUpdate={updatedMilestone} busy={progressBusy} run={runProgress} />)}</View> : <Text style={cp.body}>No roadmap items were returned for this analysis.</Text>}
    <PlanDetails label="AI plan summary · optional consent-based guidance"><><Text style={ui.kicker}>OPTIONAL GEMINI GUIDANCE</Text><Text style={ui.heading}>Create an AI learning plan</Text><Text style={ui.body}>Describe your goal or constraints. With your permission, Skillup combines that description with your analyzed skill gaps to create a focused plan.</Text>
      {!analysisId && <Text style={ui.muted}>Analyze a target role first to create an AI learning plan.</Text>}
      <Field label="What should this roadmap optimize for?" value={description} onChange={setDescription} multiline maxLength={4000} placeholder="Example: I have 8 hours each week and want to be interview-ready for an entry-level machine learning role in three months." />
      <Check label="I consent to use this description and my analyzed role gaps to generate an AI learning plan." checked={consent} onChange={setConsent} disabled={busy || !analysisId} /><Text style={ui.muted}>Consent is required before any AI request is sent. Your deterministic roadmap above remains available either way.</Text>
      <Action disabled={busy || !studentId || !analysisId || !consent || description.trim().length < 30} onPress={() => void createPlan}>{busy ? 'Creating plan…' : 'Generate AI learning plan'}</Action>
      {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.muted}>Creating your AI learning plan…</Text></View>}{error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {plan && <View style={ui.divider}><Text style={ui.label}>AI PLAN STATUS · {readableStatus(plan.status)}</Text><Text style={ui.body}>{plan.message}</Text>{plan.summary && <Text style={ui.body}>{plan.summary}</Text>}{plan.phases.map((phase, index) => <View key={`${phase.title}-${index}`} style={{ gap: 6, padding: 12, borderLeftWidth: 2, borderLeftColor: d.accent }}><Text style={ui.label}>{String(index + 1).padStart(2, '0')} / {phase.title}</Text>{phase.actions.map((action, actionIndex) => <Text key={`${action}-${actionIndex}`} style={ui.body}>• {action}</Text>)}</View>)}{Platform.OS === 'web' && plan.phases.length > 0 && <Action secondary onPress={() => download(aiHtml(plan), 'skillup-ai-roadmap.html', 'text/html')}>Download roadmap HTML</Action>}</View>}
    </></PlanDetails>
    {error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
  return <View style={{ gap: 22 }}>
    {analysisId && <AiExplanation key={`learning:${analysisId}`} path={`/api/ai/readiness/${analysisId}`} label="Prioritize learning with evidence" notice="Sends saved role requirements, deterministic gaps, skill levels and approved evidence references. Learning resources reuse the existing roadmap service." />}
    <Card><Text style={ui.kicker}>DETERMINISTIC ROADMAP</Text><Text style={ui.heading}>Your learning roadmap</Text><Text style={ui.body}>This plan is based on the selected role and your saved alignment analysis. It is separate from the optional Gemini plan below.</Text>
      {items.length ? <View>{items.map((item, index) => <RoadmapMilestone key={`${item.id}:${item.status}`} item={item} index={index} onUpdate={updatedMilestone} busy={progressBusy} run={runProgress} />)}</View> : <View style={ui.divider}><Text style={ui.body}>No roadmap items were returned yet. Build the roadmap from your alignment analysis to get started.</Text></View>}
    </Card>
    <Card><Text style={ui.kicker}>OPTIONAL GEMINI GUIDANCE</Text><Text style={ui.heading}>Create an AI learning plan</Text><Text style={ui.body}>Describe your goal or constraints. With your permission, Skillup combines that description with your analyzed skill gaps to create a focused plan.</Text>
      {!analysisId && <Text style={ui.muted}>Analyze a target role first to create an AI learning plan.</Text>}
      <Field label="What should this roadmap optimize for?" value={description} onChange={setDescription} multiline maxLength={4000} placeholder="Example: I have 8 hours each week and want to be interview-ready for an entry-level machine learning role in three months." />
      <Check label="I consent to use this description and my analyzed role gaps to generate an AI learning plan." checked={consent} onChange={setConsent} disabled={busy || !analysisId} /><Text style={ui.muted}>Consent is required before any AI request is sent. Your deterministic roadmap above remains available either way.</Text>
      <Action disabled={busy || !studentId || !analysisId || !consent || description.trim().length < 30} onPress={() => void createPlan}>{busy ? 'Creating plan…' : 'Generate AI learning plan'}</Action>
      {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.muted}>Creating your AI learning plan…</Text></View>}{error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {plan && <View style={ui.divider}><Text style={ui.label}>AI PLAN STATUS · {readableStatus(plan.status)}</Text><Text style={ui.body}>{plan.message}</Text>{plan.summary && <Text style={ui.body}>{plan.summary}</Text>}{plan.phases.map((phase, index) => <View key={`${phase.title}-${index}`} style={{ gap: 6, padding: 12, borderLeftWidth: 2, borderLeftColor: d.accent }}><Text style={ui.label}>{String(index + 1).padStart(2, '0')} / {phase.title}</Text>{phase.actions.map((action, actionIndex) => <Text key={`${action}-${actionIndex}`} style={ui.body}>• {action}</Text>)}</View>)}{Platform.OS === 'web' && plan.phases.length > 0 && <Action secondary onPress={() => download(aiHtml(plan), 'skillup-ai-roadmap.html', 'text/html')}>Download roadmap HTML</Action>}</View>}
    </Card>
    <Card><Text style={ui.kicker}>PROGRESS EXPORT</Text><Text style={ui.heading}>Download your progress</Text><Text style={ui.body}>Your report includes saved deterministic roadmap status and completion evidence. Exporting does not send data to Gemini.</Text>
      {Platform.OS === 'web' ? <View style={ui.row}><Action secondary onPress={exportPdf}>Export progress PDF</Action><Action secondary onPress={() => download(reportHtml(items), 'skillup-progress-report.doc', 'application/msword')}>Export progress DOC</Action></View> : <Text style={ui.muted}>Open this workspace in a browser to download a PDF or DOC progress report.</Text>}
    </Card>
  </View>;
}
