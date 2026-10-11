import { useState } from 'react';
import { Text, View } from 'react-native';
import { Action, Card, Disclosure, ui } from '@/components/career-ui';
import type { LinkedInAnalysisOut, ProfileRoleMatchOut } from '@/types/contracts';

export function LinkedInInsights({ analysis, busy, addTask }: { analysis: LinkedInAnalysisOut; busy: boolean; addTask: (title: string, description: string, priority: 'high' | 'medium' | 'low') => void }) {
  const supported = analysis.skills.filter(skill => skill.evidence_strength !== 'mention_only').length;
  const [openSkill, setOpenSkill] = useState<string | null>(null);
  return <>
    <Card>
      <Text style={ui.kicker}>CAREER INTELLIGENCE / {analysis.engine.toUpperCase()}</Text>
      <Text style={ui.heading}>What your profile communicates.</Text>
      <Text style={ui.body}>{analysis.summary}</Text>
      <Text style={ui.muted}>Analyzed source: {analysis.source.replaceAll('_', ' ')} / {analysis.data_scope.replaceAll('_', ' ')} / {analysis.confirmed ? 'Reviewed by you' : 'Self-reported'}</Text>
      <View style={ui.row}>
        <Metric label="Text quality" value={analysis.profile_quality_score === null ? 'Unavailable' : `${analysis.profile_quality_score}/100`} />
        <Metric label="Skills with context" value={`${supported}/${analysis.skills.length}`} />
        <Metric label="Contribution statements" value={String(analysis.action_statement_count)} />
        <Metric label="Measurable impact" value={String(analysis.quantified_statement_count)} />
      </View>
      <Text style={ui.muted}>{analysis.quality_rubric}</Text>
      <Text style={ui.body}>Sections detected: {analysis.present_sections.join(', ') || 'No labeled core sections'}</Text>
      <Text style={ui.muted}>Not detected in supplied text: {analysis.missing_sections.join(', ') || 'None'}</Text>
    </Card>
    {analysis.target && <Card><Text style={ui.kicker}>YOUR TARGET / EVIDENCE GAP ANALYSIS</Text><RoleMatch result={analysis.target} /></Card>}
    <Card>
      <Text style={ui.heading}>Your highest-impact improvements.</Text>
      {analysis.improvements.length ? analysis.improvements.map((item, index) => <View key={`${item.title}-${index}`} style={ui.divider}>
        <Text style={ui.label}>{item.priority.toUpperCase()} PRIORITY</Text><Text style={ui.heading}>{item.title}</Text>
        <Text style={ui.body}>{item.reason}</Text>{item.excerpt && <Text selectable style={ui.muted}>Your text: {item.excerpt}</Text>}
        <Text style={ui.body}>{item.action}</Text>
        <Action secondary disabled={busy} onPress={() => addTask(item.title, `${item.reason}\n${item.action}`, item.priority)}>Add to roadmap: {item.title}</Action>
      </View>) : <Text style={ui.body}>These limited checks found no additional changes. Review your profile against a specific job description.</Text>}
    </Card>
    <Card>
      <Text style={ui.heading}>Skill evidence, beyond keywords.</Text>
      <Text style={ui.muted}>Select a skill to inspect its supporting excerpts. Context is evidence, not an assessed proficiency level.</Text>
      {analysis.skills.length ? analysis.skills.map(skill => <Disclosure key={skill.name} title={skill.name} summary={skill.evidence_strength.replaceAll('_', ' ')} open={openSkill === skill.name} onToggle={() => setOpenSkill(current => current === skill.name ? null : skill.name)}>
        <Text style={ui.muted}>Proficiency is unknown. Project context links a skill to that section; applied examples also contain a recognized contribution.</Text>
        {skill.excerpts.map((evidence, index) => <View key={index} style={ui.divider}><Text style={ui.label}>{evidence.section}</Text><Text selectable style={ui.body}>{evidence.excerpt}</Text></View>)}
      </Disclosure>) : <Text style={ui.body}>No supported skill evidence detected. Add concrete tools and contributions in your profile editor.</Text>}
    </Card>
    {!!analysis.role_matches.length && <Card>
      <Text style={ui.heading}>Career directions to explore.</Text>
      <Text style={ui.muted}>Ordered by skill mentions and then applied examples. These curated templates are starting points; compare a real job description for a more specific review.</Text>
      {analysis.role_matches.slice(0, 3).map(role => <View style={ui.divider} key={role.title}><RoleMatch result={role} /></View>)}
    </Card>}
    {(analysis.headline_suggestion || analysis.wording_suggestions.length > 0) && <Card>
      <Text style={ui.heading}>Grounded wording ideas.</Text>
      {!!analysis.headline_suggestion && <><Text style={ui.label}>Skill-focused headline starting point</Text><Text selectable style={ui.body}>{analysis.headline_suggestion}</Text><Text style={ui.muted}>Add your actual role, focus and context. Review each skill before using it. No title or achievement has been invented.</Text></>}
      {analysis.wording_suggestions.map((item, index) => <View style={ui.divider} key={index}><Text selectable style={ui.muted}>Original: {item.original}</Text><Text selectable style={ui.body}>Suggested: {item.suggested}</Text><Text style={ui.muted}>{item.reason}</Text></View>)}
    </Card>}
    <Card>{analysis.limitations.map(value => <Text key={value} style={ui.muted}>{value}</Text>)}</Card>
  </>;
}

function RoleMatch({ result }: { result: ProfileRoleMatchOut }) {
  return <>
    <Text style={ui.heading}>{result.title}</Text>
    <Text style={ui.body}>Keyword coverage: {result.keyword_coverage === null ? 'Insufficient data' : `${result.keyword_coverage}%`} / {result.source.replaceAll('_', ' ')}</Text>
    <Text style={ui.body}>Matches: {result.matched_skills.join(', ') || 'No recognized matches'}</Text>
    <Text style={ui.body}>With project or contribution context: {result.evidence_backed_skills.join(', ') || 'None detected'}</Text>
    <Text style={ui.muted}>Not detected: {result.not_detected_skills.join(', ') || 'None from the supported terms'}</Text>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ flexBasis: 180, flexGrow: 1, gap: 8, paddingVertical: 12 }}><Text style={ui.heading}>{value}</Text><Text style={ui.muted}>{label}</Text></View>;
}
