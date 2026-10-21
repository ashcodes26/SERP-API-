import { Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { documentsApi } from '@/api/client';
import { cp, planSurface, PlanIcon, PlanAction, PlanDetails, PlanHeading, PlanSection, PlanTag } from '@/components/career-plan-design';
import { design as d } from '@/constants/design';
import type { AnalysisOut, DashboardOut, ProfileOut } from '@/types/contracts';

export function EvidencePanel({ profile, onUpdate, busy, children }: { profile: ProfileOut; onUpdate: () => void; busy: boolean; children?: ReactNode }) {
  const { width } = useWindowDimensions();
  const [showAll, setShowAll] = useState(false);
  const [review, setReview] = useState('Private document review · preview available');
  useEffect(() => {
    let active = true;
    void documentsApi.capabilities().then(async capability => {
      if (!capability.review_enabled) { if (active) setReview('Document preview available · persistent review is not enabled'); return; }
      const records = await documentsApi.list();
      const pending = records.filter(record => record.proposal?.items.some(item => item.decision === 'pending')).length;
      if (active) setReview(pending ? `${pending} documents with pending private decisions` : 'No pending private document decisions');
    }).catch(() => { if (active) setReview('Private review status unavailable · open the workspace to retry'); });
    return () => { active = false; };
  }, [profile]);
  const columns = width >= 1024 ? 3 : width >= 768 ? 2 : 1;
  const visible = showAll ? profile.competencies : profile.competencies.slice(0, 6);
  return <PlanSection>
    <View style={cp.spread}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 210 }}><PlanIcon name="profile" size={22} /><View style={{ flex: 1, minWidth: 0 }}>
      <Text accessibilityRole="header" style={cp.heading}>Profile Evidence & Competencies</Text>
      <Text style={cp.small}>{profile.student.name} · Student ID: {profile.student.student_id}</Text>
      <Text style={cp.small}>{[profile.student.program, profile.student.specialization, profile.student.department, profile.student.graduation_year ? `Class of ${profile.student.graduation_year}` : null].filter(Boolean).join(' · ') || 'Academic details not recorded'} · CGPA {profile.student.cgpa ?? 'Unknown'}/10</Text>
      <Text style={[cp.small, { color: d.successText }]}>● {profile.evidence.length} saved evidence records</Text>
    </View></View><View style={[cp.row, { gap: 6 }]}><PlanAction secondary icon="edit" disabled={busy} onPress={onUpdate}>Update profile details</PlanAction><PlanAction secondary icon="upload" disabled={busy} onPress={onUpdate}>Upload journey (PDF/DOCX)</PlanAction></View></View>
    <View style={[cp.divider, { paddingTop: 16 }]}>
      <View style={{ borderWidth: 1, borderColor: '#665020', borderRadius: 4, backgroundColor: d.higher, paddingHorizontal: 12, paddingVertical: 8 }}>
        <PlanDetails label="Open private review →" summary={<Text style={[cp.small, { color: d.highlight, flex: 1, minWidth: 180 }]}>Documents to review: <Text style={{ color: d.body }}>{review}</Text></Text>}>{children}</PlanDetails>
      </View>
      <View style={cp.spread}><Text style={cp.kicker}>INDEXED COMPETENCY EVIDENCE (SCALE 0.0–5.0)</Text><Text style={cp.small}>Unknown is distinct from zero</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{visible.map(item => <View key={item.skill.id} style={{ width: columns === 3 ? '31.9%' : columns === 2 ? '48.8%' : '100%', flexGrow: 1, minWidth: 0, minHeight: 108, backgroundColor: planSurface, borderWidth: 1, borderColor: d.border, borderRadius: 4, padding: 12, gap: 6, justifyContent: 'space-between' }}>
        <View style={[cp.spread, { flexWrap: 'nowrap', gap: 6 }]}><Text style={[cp.strong, { flex: 1, minWidth: 0, color: item.level === null ? d.body : d.text }]}>{item.skill.canonical_name}</Text><PlanTag tone={item.level === null ? 'warning' : 'neutral'}>{item.level === null ? 'Unknown' : 'Recorded'}</PlanTag></View>
        <View style={[cp.row, { flexWrap: 'nowrap', gap: 12 }]}><View accessibilityRole="progressbar" accessibilityLabel={item.skill.canonical_name} accessibilityValue={item.level === null ? { text: 'Unknown proficiency; distinct from zero' } : { min: 0, max: 5, now: item.level }} style={{ flex: 1, height: 6, backgroundColor: d.higher, borderRadius: 4 }}>{item.level !== null && <View style={{ width: `${Math.max(0, Math.min(5, item.level)) * 20}%`, height: 6, borderRadius: 4, backgroundColor: '#94f4da' }} />}</View><Text style={cp.label}>{item.level === null ? 'Unknown' : `${item.level.toFixed(1)}/5.0`}</Text></View>
        <Text numberOfLines={1} style={cp.small}>{item.evidence_ids.length ? `Evidence #${item.evidence_ids.join(', #')}` : 'No linked evidence · needs assessment'}</Text>
      </View>)}</View>
      {!profile.competencies.length && <Text style={cp.body}>No competencies recorded. Upload profile evidence to get started.</Text>}
      <PlanDetails label="More competencies & saved evidence records">
        {profile.competencies.length > 6 && <PlanAction secondary onPress={() => setShowAll(value => !value)}>{showAll ? 'Show fewer competencies' : `Show all ${profile.competencies.length} competencies`}</PlanAction>}
        {profile.evidence.map(evidence => <View key={evidence.id} style={cp.divider}><Text style={cp.label}>Evidence #{evidence.id} · {evidence.source_type.replaceAll('_', ' ')}</Text><Text selectable style={cp.body}>{evidence.extracted_summary}</Text><Text style={cp.small}>Observed {new Date(evidence.observed_at).toLocaleString()}</Text></View>)}
      </PlanDetails>
    </View>
  </PlanSection>;
}

export function AlignmentPanel({ analysis, snapshot, children }: { analysis: AnalysisOut | null; snapshot?: DashboardOut | null; children?: ReactNode }) {
  const { width } = useWindowDimensions();
  const readiness = analysis?.readiness ?? snapshot?.readiness;
  const gaps = analysis?.gaps ?? snapshot?.top_gaps ?? [];
  const metrics = [
    { label: 'ROLE ALIGNMENT', value: readiness ? readiness.measurable ? `${Math.round(readiness.alignment * 100)}%` : 'Unknown' : '—', detail: 'Weighted match against the role requirements. Informational alignment, not a placement probability.', icon: 'chart' as const, color: d.accent, progress: readiness?.measurable ? readiness.alignment : null },
    { label: 'EVIDENCE COVERAGE', value: readiness ? `${Math.round(readiness.evidence_coverage * 100)}%` : '—', detail: 'Evidence coverage returned by the deterministic analysis of your saved profile.', icon: 'shield' as const, color: '#94f4da', progress: readiness?.evidence_coverage },
    { label: 'ANALYSIS CONFIDENCE', value: readiness ? `${Math.round(readiness.confidence * 100)}%` : '—', detail: 'Confidence in available evidence. Missing proficiency stays unknown.', icon: 'chart' as const, color: d.highlight, progress: readiness?.confidence },
  ];
  return <PlanSection>
    <PlanHeading title="Alignment & Readiness Breakdown" description={analysis ? `Analysis #${analysis.id} · ${analysis.readiness.formula_version} · ${new Date(analysis.created_at).toLocaleDateString()}` : snapshot?.readiness ? `Saved target snapshot · ${snapshot.readiness.formula_version}` : 'Save your target role and analyze alignment to populate this breakdown.'} aside={<PlanTag>{analysis ? `${analysis.job.skills.length} role requirements` : snapshot?.readiness ? 'Saved analysis snapshot' : 'Awaiting analysis'}</PlanTag>} />
    <View style={[cp.divider, { flexDirection: width >= 768 ? 'row' : 'column', gap: 16 }]}>{metrics.map(metric => <View key={metric.label} style={[cp.inset, { flex: 1, minHeight: 182 }]}><View style={cp.spread}><Text style={cp.kicker}>{metric.label}</Text><PlanIcon name={metric.icon} color={metric.color} size={18} /></View><Text style={cp.metric}>{metric.value}</Text><View style={{ height: 8, borderRadius: 4, backgroundColor: d.higher }}>{metric.progress !== null && metric.progress !== undefined && <View style={{ width: `${Math.max(0, Math.min(1, metric.progress)) * 100}%`, height: 8, backgroundColor: metric.color, borderRadius: 4 }} />}</View><Text style={cp.small}>{metric.detail}</Text></View>)}</View>
    <View style={{ flexDirection: width >= 1024 ? 'row' : 'column', alignItems: 'flex-start', gap: 16 }}>
      <View style={[cp.inset, { flex: width >= 1024 ? 1 : undefined, width: width >= 1024 ? undefined : '100%' }]}><View style={[cp.row, { gap: 6 }]}><PlanIcon name="check" color={d.successText} /><Text style={cp.strong}>Strengths (Target Met)</Text></View>{analysis?.strengths.length ? analysis.strengths.map(item => <View key={item.skill.id} style={{ backgroundColor: d.elevated, padding: 8, gap: 2 }}><Text style={[cp.label, { color: d.text }]}>{item.skill.canonical_name}</Text><Text style={cp.small}>{item.level === null ? 'Unknown' : `${item.level.toFixed(1)}/5.0`} · Evidence: {item.evidence_ids.join(', ') || 'No linked references'}</Text></View>) : <Text style={cp.small}>{analysis ? 'No target strengths identified from the available evidence.' : snapshot?.readiness ? 'The saved dashboard snapshot does not include a strengths list. Run alignment to view the complete breakdown.' : 'Strengths will appear after analysis.'}</Text>}</View>
      <View style={[cp.inset, { flex: 1 }]}><View style={[cp.row, { gap: 6 }]}><PlanIcon name="warning" color={d.highlight} /><Text style={cp.strong}>Gaps to Bridge (Actionable)</Text></View>{gaps.length ? gaps.map(item => <View key={item.skill.id} style={{ backgroundColor: d.elevated, padding: 8, borderWidth: 1, borderColor: d.strongBorder, gap: 2 }}><View style={cp.spread}><Text style={[cp.label, { color: d.text, flex: 1 }]}>{item.skill.canonical_name}</Text><Text style={[cp.small, { color: d.highlight }]}>{item.priority} priority</Text></View><Text style={cp.small}>Required: {item.required_level ?? 'Unknown'}/5 · Current: {item.current_level === null ? 'Unknown / unassessed' : `${item.current_level}/5`}{item.gap !== null ? ` · Gap: ${item.gap}` : ''}</Text></View>) : <Text style={cp.small}>{analysis ? 'No gaps identified from current evidence.' : 'Measured gaps and unknown requirements will appear here.'}</Text>}</View>
    </View>
    <View style={{ borderWidth: 1, borderLeftWidth: 3, borderColor: d.strongBorder, borderLeftColor: d.accent, backgroundColor: d.higher, padding: 16, borderRadius: 4, gap: 8 }}><View style={cp.spread}><View style={[cp.row, { gap: 6 }]}><PlanIcon name="spark" /><Text style={cp.strong}>Grounded AI Analysis Summary</Text></View><PlanTag>Explicit consent required</PlanTag></View><Text style={cp.small}>Optional Gemini explanation · explicit consent required · scores remain deterministic.</Text>{children || <Text style={cp.small}>Analyze a target role first to request grounded guidance.</Text>}</View>
    {gaps.length > 0 && <PlanDetails label="Why these gaps?">{gaps.map(item => <View key={item.skill.id}><Text style={cp.label}>{item.skill.canonical_name}</Text><Text style={cp.small}>{item.rationale}</Text></View>)}</PlanDetails>}
    {snapshot && !analysis && <Text style={cp.small}>Saved summary contains up to three gaps. Run Analyze alignment for all requirements, strengths, warnings and consent-based AI guidance.</Text>}
    {analysis && <PlanDetails label="Scoring drivers, warnings & SWOT"><Text style={cp.small}>{analysis.readiness.label}</Text>{analysis.readiness.drivers.map(driver => <Text key={driver} style={cp.small}>{driver}</Text>)}<Text style={cp.small}>{analysis.readiness.disclaimer}</Text>{analysis.warnings.map((warning, index) => <Text key={index} style={cp.small}>{warning}</Text>)}{analysis.swot.map((item, index) => <View key={index}><Text style={cp.label}>{item.category}: {item.statement}</Text><Text style={cp.small}>{item.confidence_label} · References: {item.evidence_refs.join(', ') || 'Not supplied'}</Text></View>)}</PlanDetails>}
  </PlanSection>;
}
