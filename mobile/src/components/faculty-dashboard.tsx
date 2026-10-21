import { Text, View } from 'react-native';
import { Action, Card, Details, ui } from '@/components/career-ui';
import { page, SectionHeading, StatusTag } from '@/components/screen-layout';
import { design as d } from '@/constants/design';
import type { BatchSkillOut, PlacementDashboardOut, PlacementStudentsOut } from '@/types/contracts';

export function FacultyMetrics({ dashboard, keys = ['assigned_students', 'resumes_submitted', 'training_completed', 'offers'] }: { dashboard: PlacementDashboardOut; keys?: string[] }) {
  const primary = keys.filter(key => key in dashboard.metrics);
  return <View style={{ gap: 24 }}><View style={[ui.row, { alignItems: 'stretch' }]}>{primary.map(key => <View key={key} style={page.metric}><Text style={ui.kicker}>{key.replaceAll('_', ' ').toUpperCase()}</Text><Text style={ui.score}>{dashboard.metrics[key] ?? '—'}</Text><Text style={ui.muted}>{dashboard.definitions[key]}</Text></View>)}</View>
    <Card><Details label="All faculty-scoped metrics and definitions"><View style={[ui.row, { alignItems: 'stretch' }]}>{Object.entries(dashboard.metrics).map(([key, value]) => <View key={key} style={[page.metric, { minWidth: 180 }]}><Text style={ui.heading}>{value ?? '—'}</Text><Text style={ui.body}>{key.replaceAll('_', ' ')}</Text><Text style={ui.muted}>{dashboard.definitions[key]}</Text></View>)}</View></Details></Card>
  </View>;
}

export function FacultyRoster({ students, selected, busy, currentPage, onSelect, onPage }: { students: PlacementStudentsOut; selected: number | null; busy: boolean; currentPage: number; onSelect: (id: number) => void; onPage: (next: number) => void }) {
  return <View style={{ gap: 12 }}><SectionHeading title="Cohort roster" description={`${students.total} authorized students · page ${currentPage}`} />
    {students.items.map(student => <Card key={student.id} style={{ padding: 16, borderColor: selected === student.id ? d.accent : d.border }}><Text style={ui.heading}>{student.name}</Text><Text style={ui.muted}>{student.student_id} · {student.department || 'Department unknown'}</Text><StatusTag tone={student.follow_up.length ? 'warning' : 'neutral'}>{student.resume_status.replaceAll('_', ' ')}</StatusTag><Text style={ui.muted}>Profile {student.profile_completion}% · Assessments {student.assessments_completed} · Training {student.training_completed}/{student.training_total}</Text><Text style={ui.muted}>{student.applications} applications · {student.offers} recorded offers</Text>{student.follow_up.length > 0 && <Text style={ui.muted}>{student.follow_up.join(' · ')}</Text>}<Action secondary compact disabled={busy} onPress={() => onSelect(student.id)}>Open student {student.name}</Action></Card>)}
    {!students.items.length && <Card><Text style={ui.body}>No authorized students match the applied filters.</Text></Card>}
    <View style={ui.row}><Action secondary compact disabled={busy || currentPage === 1} onPress={() => onPage(currentPage - 1)}>Previous page</Action><Text style={ui.muted}>Page {currentPage}</Text><Action secondary compact disabled={busy || currentPage * students.page_size >= students.total} onPress={() => onPage(currentPage + 1)}>Next page</Action></View>
  </View>;
}

export function FacultySkillCard({ skill, onDrill }: { skill: BatchSkillOut; onDrill: (ids: number[]) => void }) {
  const metrics = [
    { label: 'ROLE-REQUIRED LEVEL', value: skill.required_level === null ? 'Unknown' : `${skill.required_level} / 5`, detail: 'Expected proficiency in the selected role.' },
    { label: 'KNOWN MEAN', value: skill.mean_proficiency === null ? 'Unavailable' : `${skill.mean_proficiency} / 5`, detail: `${skill.known_count} students with known proficiency.` },
    { label: 'ASSESSED MEAN', value: skill.mean_assessed_proficiency === null ? 'Unavailable' : `${skill.mean_assessed_proficiency} / 5`, detail: `${skill.assessed_count} assessed students.` },
    { label: 'UNKNOWN PROFICIENCY', value: String(skill.unknown_count), detail: `${skill.missing_assessment_count} missing assessments · ${skill.common_gap_count} known gaps.` },
  ];
  return <Card><SectionHeading title={skill.skill.canonical_name} aside={<StatusTag tone={skill.unknown_count ? 'warning' : 'neutral'}>{skill.unknown_count} unknown</StatusTag>} />
    <View style={[ui.row, { alignItems: 'stretch' }]}>{metrics.map(metric => <View key={metric.label} style={[page.metric, { minWidth: 115 }]}><Text style={ui.kicker}>{metric.label}</Text><Text style={ui.heading}>{metric.value}</Text><Text style={ui.muted}>{metric.detail}</Text></View>)}</View>
    <View style={ui.row}><Action secondary compact onPress={() => onDrill(skill.gap_student_ids)}>Students with known gaps</Action><Action secondary compact onPress={() => onDrill(skill.unknown_student_ids)}>Unknown proficiency</Action><Action secondary compact onPress={() => onDrill(skill.assessed_student_ids)}>Assessed students</Action><Action secondary compact onPress={() => onDrill(skill.missing_assessment_student_ids)}>Missing assessments</Action></View>
  </Card>;
}
