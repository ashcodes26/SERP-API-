import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Details, ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';
import type { AnalysisOut } from '@/types/contracts';

export function SkillGapChart({ gaps }: { gaps: AnalysisOut['gaps'] }) {
  return <View style={{ gap: 24 }}>{gaps.map(gap => <View key={gap.skill.id} style={{ gap: 12 }}>
    <View style={[ui.row, { justifyContent: 'space-between' }]}>
      <Text style={[ui.body, { flex: 1, color: d.text, fontWeight: '500' }]}>{gap.skill.canonical_name}</Text>
      <Text style={ui.body}>{gap.priority.toUpperCase()}</Text>
    </View>
    {([{ label: 'Current', value: gap.current_level, color: d.muted }, { label: 'Target', value: gap.required_level, color: d.accent }]).map(item => <View key={item.label} style={{ gap: 6 }}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.body}>{item.label}</Text><Text style={ui.body}>{item.value === null ? 'Unknown' : `${item.value}/5`}</Text></View>
      <View accessibilityRole="progressbar" accessibilityLabel={`${gap.skill.canonical_name} ${item.label.toLowerCase()}`} accessibilityValue={item.value === null ? { text: 'Unknown' } : { min: 0, max: 5, now: item.value }} style={{ height: 5, borderRadius: 3, backgroundColor: d.border, overflow: 'hidden' }}>
        {item.value !== null && <View style={{ height: 5, width: `${Math.max(0, Math.min(100, item.value / 5 * 100))}%`, backgroundColor: item.color }} />}
      </View>
    </View>)}
    {!!gap.rationale && <Details label="Why this gap matters"><Text style={ui.body}>{gap.rationale}</Text></Details>}
  </View>)}</View>;
}

export function StatStrip({ items }: { items: { label: string; value: string | number }[] }) {
  return <View style={[ui.row, { gap: 24 }]}>{items.map(item => <View key={item.label} style={{ flex: 1, minWidth: 100, gap: 6 }}>
    <Text style={[ui.heading, { fontSize: 30, lineHeight: 36 }]}>{item.value}</Text><Text style={ui.muted}>{item.label}</Text>
  </View>)}</View>;
}

export function ScoreRing({ value, label }: { value: number | null; label: string }) {
  const bounded = value === null ? null : Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 48;
  return <View style={[ui.row, { gap: 24 }]}>
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={bounded === null ? { text: 'Unavailable' } : { min: 0, max: 100, now: bounded }}>
      <Svg width={120} height={120} viewBox="0 0 120 120"><Circle cx={60} cy={60} r={48} fill="none" stroke={d.border} strokeWidth={6} />
        {bounded !== null && <Circle cx={60} cy={60} r={48} fill="none" stroke={d.accent} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - bounded / 100)} transform="rotate(-90 60 60)" />}
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' }}><Text style={ui.heading}>{bounded === null ? '—' : `${Math.round(bounded)}%`}</Text></View>
    </View>
    <Text style={[ui.body, { flex: 1 }]}>{label}</Text>
  </View>;
}

export function BarChart({ rows, max = 100, unit = '%' }: { rows: { label: string; value: number | null; color?: string }[]; max?: number; unit?: string }) {
  return <View style={{ gap: 18 }}>{rows.map(row => <View key={row.label} style={{ gap: 6 }}>
    <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={[ui.body, { flex: 1 }]}>{row.label}</Text><Text style={ui.label}>{row.value === null ? '—' : `${Math.round(row.value * 10) / 10}${unit}`}</Text></View>
    <View accessibilityRole="progressbar" accessibilityLabel={row.label} accessibilityValue={row.value === null ? { text: 'Unavailable' } : { min: 0, max, now: row.value }} style={{ height: 6, borderRadius: 3, backgroundColor: d.border, overflow: 'hidden' }}>
      {row.value !== null && <View style={{ width: `${Math.max(0, Math.min(100, row.value / Math.max(1, max) * 100))}%`, height: 6, backgroundColor: row.color ?? d.accent, borderRadius: 3 }} />}
    </View>
  </View>)}</View>;
}
