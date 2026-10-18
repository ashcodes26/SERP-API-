import { Text, View } from 'react-native';
import { Action, Card, Details, ui } from '@/components/career-ui';
import { BarChart, ScoreRing } from '@/components/analytics';
import { ImprovementRow } from '@/components/improvement-row';
import type { LinkedInAnalysisOut, ProfileRoleMatchOut } from '@/types/contracts';

export function LinkedInInsights({ analysis, busy, addTask }: { analysis: LinkedInAnalysisOut; busy: boolean; addTask: (title: string, description: string, priority: 'high' | 'medium' | 'low') => void }) {
  const supported = analysis.skills.filter(skill => skill.evidence_strength !== 'mention_only').length;
  return <>
    <Card>
      <Text style={ui.kicker}>CAREER INTELLIGENCE / {analysis.engine.toUpperCase()}</Text>
      <Text style={ui.kicker}>STEP 3 / PROFILE INSIGHTS</Text><Text style={ui.heading}>Profile completeness and positioning</Text><ScoreRing value={analysis.profile_quality_score} label="Text quality" />
      <Text style={ui.muted}>Analyzed source: {analysis.source.replaceAll('_', ' ')} / {analysis.data_scope.replaceAll('_', ' ')} / {analysis.confirmed ? 'Reviewed by you' : 'Self-reported'}</Text>
      <Text style={ui.muted}>This score describes the supplied profile text against the shown rubric. It is not a LinkedIn profile score, recruiter rating, or guarantee of visibility.</Text>
      <View style={ui.row}>
        <Metric label="Skills with context" value={`${supported}/${analysis.skills.length}`} />
        <Metric label="Contribution statements" value={String(analysis.action_statement_count)} />
        <Metric label="Measurable impact" value={String(analysis.quantified_statement_count)} />
      </View>
      <Details label="How to read this feedback"><Text style={ui.body}>{analysis.summary}</Text><Text style={ui.muted}>{analysis.quality_rubric}</Text></Details>
      <Text style={ui.body}>Sections detected: {analysis.present_sections.join(', ') || 'No labeled core sections'}</Text>
      <Text style={ui.muted}>Not detected in supplied text: {analysis.missing_sections.join(', ') || 'None'}</Text>
    </Card>
    {analysis.target && <Card><Text style={ui.kicker}>YOUR TARGET / EVIDENCE GAP ANALYSIS</Text><RoleMatch result={analysis.target} /></Card>}
    <Card>
      <Text style={ui.kicker}>EVIDENCE-BACKED RECOMMENDATIONS</Text><Text style={ui.heading}>Prioritized profile improvements</Text>
      {analysis.improvements.length ? analysis.improvements.map((item, index) => <ImprovementRow key={`${item.title}-${index}`} index={index} title={item.title} status={item.priority.toUpperCase()} summary={item.action}
        actions={<Action secondary disabled={busy} onPress={() => addTask(item.title, `${item.reason}\n${item.action}`, item.priority)}>Add task</Action>}>
        <Text style={ui.body}>{item.action}</Text><Text style={ui.muted}>{item.reason}</Text>{item.excerpt && <Text selectable style={ui.muted}>{item.excerpt}</Text>}
      </ImprovementRow>) : <Text style={ui.muted}>No further changes.</Text>}
    </Card>
    <Card>
      <Text style={ui.heading}>Skills and supporting evidence</Text><Text style={ui.muted}>Evidence reflects wording found in supplied text. It does not assess proficiency.</Text>
      {!!analysis.skills.length && <BarChart max={analysis.skills.length} unit=" skills" rows={[
        { label: 'Mentions', value: analysis.skills.filter(s => s.evidence_strength === 'mention_only').length },
        { label: 'Project context', value: analysis.skills.filter(s => s.evidence_strength === 'project_context').length },
        { label: 'Applied', value: analysis.skills.filter(s => s.evidence_strength === 'applied_example').length },
        { label: 'Quantified', value: analysis.skills.filter(s => s.evidence_strength === 'quantified_example').length },
      ]} />}
      {analysis.skills.length ? analysis.skills.map(skill => <View style={ui.divider} key={skill.name}>
        <Text style={ui.body}>{skill.name} / {skill.evidence_strength.replaceAll('_', ' ')}</Text>
        <Text style={ui.muted}>Proficiency unassessed</Text>
        {skill.excerpts.map((evidence, index) => <View key={index}><Text style={ui.label}>{evidence.section}</Text><Text selectable style={ui.body}>{evidence.excerpt}</Text></View>)}
      </View>) : <Text style={ui.body}>No supported skills detected.</Text>}
    </Card>
    {!!analysis.role_matches.length && <Card>
      <Text style={ui.heading}>Role positioning ideas</Text>
      <Text style={ui.muted}>Curated role templates</Text>
      {analysis.role_matches.slice(0, 3).map(role => <View style={ui.divider} key={role.title}><RoleMatch result={role} /></View>)}
    </Card>}
    {(analysis.headline_suggestion || analysis.wording_suggestions.length > 0) && <Card>
      <Text style={ui.heading}>Suggested wording to review</Text><Text style={ui.muted}>These are suggestions, not verified profile content. Keep only wording you can support.</Text>
      {!!analysis.headline_suggestion && <><Text style={ui.label}>SKILL-FOCUSED HEADLINE STARTING POINT</Text><Text selectable style={ui.body}>{analysis.headline_suggestion}</Text><Text style={ui.muted}>Review and adapt before using.</Text></>}
      {analysis.wording_suggestions.map((item, index) => <View style={ui.divider} key={index}><Text style={ui.label}>CURRENT WORDING</Text><Text selectable style={ui.muted}>{item.original}</Text><Text style={ui.label}>SUGGESTED WORDING</Text><Text selectable style={ui.body}>{item.suggested}</Text><Text style={ui.muted}>{item.reason}</Text></View>)}
    </Card>}
    <Details label="Analysis details">{analysis.limitations.map(value => <Text key={value} style={ui.muted}>{value}</Text>)}</Details>
  </>;
}

function RoleMatch({ result }: { result: ProfileRoleMatchOut }) {
  return <>
    <Text style={ui.heading}>{result.title}</Text>
    <BarChart rows={[{ label: "Keyword coverage", value: result.keyword_coverage }]} /><Text style={ui.muted}>Source: {result.source.replaceAll('_', ' ')}</Text>
    <Text style={ui.body}>Matches: {result.matched_skills.join(', ') || 'No recognized matches'}</Text>
    <Text style={ui.body}>With project or contribution context: {result.evidence_backed_skills.join(', ') || 'None detected'}</Text>
    <Text style={ui.muted}>Not detected: {result.not_detected_skills.join(', ') || 'None from the supported terms'}</Text>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ flexBasis: 180, flexGrow: 1, gap: 8, paddingVertical: 12 }}><Text style={ui.heading}>{value}</Text><Text style={ui.muted}>{label}</Text></View>;
}
