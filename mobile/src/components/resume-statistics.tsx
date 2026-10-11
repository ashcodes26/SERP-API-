import { Text, View } from 'react-native';
import { Card, ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';
import type { ResumeStatisticsOut } from '@/types/contracts';

export function ResumeStatistics({ revised, dirty }: { revised: ResumeStatisticsOut; dirty: boolean }) {
  return <Card>
    <Text style={ui.kicker}>RESUME STATISTICS</Text>
    <Text style={ui.heading}>Your resume strength at a glance.</Text>
    <Text style={ui.muted}>{dirty ? 'Save your editor changes to update these statistics.' : 'Statistics match the saved revision.'} Job alignment appears separately after you choose and analyze a target.</Text>
    <StatisticsColumn label="Saved revision" stats={revised} />
    <Text style={ui.muted}>{revised.rubric_version}: {revised.rubric}</Text>
    <Text style={ui.heading}>What to improve in the saved revision</Text>
    {revised.feedback.length ? revised.feedback.map(value => <Text key={value} style={ui.body}>{value}</Text>) : <Text style={ui.body}>All of these limited text indicators are present. Review accuracy, relevance and layout before applying.</Text>}
  </Card>;
}

function StatisticsColumn({ label, stats }: { label: string; stats: ResumeStatisticsOut }) {
  return <View style={{ flex: 1, minWidth: 0, padding: 20, borderRadius: d.controlRadius, backgroundColor: d.elevated, gap: 12 }}>
    <Text style={ui.label}>{label}</Text>
    <Text style={ui.score}>{stats.strength_score} / 100</Text>
    <Text style={ui.body}>Resume text strength</Text>
    <View accessibilityRole="progressbar" accessibilityLabel={`${label} text strength`} accessibilityValue={{ min: 0, max: 100, now: stats.strength_score }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.strength_score} style={{ height: 8, backgroundColor: d.border, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ height: 8, backgroundColor: d.accent, width: `${stats.strength_score}%` }} />
    </View>
    <View style={ui.row}>
      <Metric label="Words" value={stats.word_count} />
      <Metric label="Bullets" value={stats.bullet_count} />
      <Metric label="Skill mentions" value={stats.detected_skills.length} />
      <Metric label="Action statements" value={stats.action_statement_count} />
      <Metric label="Quantified statements" value={stats.quantified_statement_count} />
    </View>
    <Text style={ui.body}>Section coverage: {stats.section_coverage}% ({stats.present_sections.length}/4)</Text>
    <Text style={ui.muted}>Present: {stats.present_sections.join(', ') || 'No nonempty core sections detected'}</Text>
    <Text style={ui.muted}>Not detected: {stats.missing_sections.join(', ') || 'None'}</Text>
    <Text style={ui.body}>Skills in resume text: {stats.detected_skills.join(', ') || 'None from the supported dictionary'}</Text>
    <Text style={ui.muted}>Counts reflect recognizable headings, lines and supported terms. Skill mentions do not establish proficiency.</Text>
  </View>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <View style={{ flexGrow: 1, flexBasis: 110, padding: 12, gap: 4 }}><Text style={ui.heading}>{value}</Text><Text style={ui.muted}>{label}</Text></View>;
}
