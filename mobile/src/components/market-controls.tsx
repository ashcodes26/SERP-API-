import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';

export type InsightMode = 'ranking' | 'roles' | 'student';
const views = [{ id: 'ranking', icon: '≡', label: 'Demand ranking' }, { id: 'roles', icon: '⇄', label: 'Role comparison' }, { id: 'student', icon: '◎', label: 'My skill evidence' }] as const;
export function InsightViews({ value, onChange, disabled }: { value: InsightMode; onChange: (value: InsightMode) => void; disabled: boolean }) {
  return <View style={ui.row} accessibilityRole="radiogroup" accessibilityLabel="Insight view">{views.map(view => <Pressable key={view.id} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: value === view.id, disabled }} onPress={() => onChange(view.id)} style={[ui.chip, value === view.id && ui.selected]}><Text style={ui.body}>{view.icon}  {view.label}</Text></Pressable>)}</View>;
}
export function InsightActions({ reset, reload, exportCsv, mode, setMode, disabled }: { reset: () => void; reload: () => void; exportCsv?: () => void; mode: InsightMode; setMode: (mode: InsightMode) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  function run(action: () => void) { setOpen(false); action(); }
  return <><Pressable accessibilityRole="button" accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(true)} style={ui.chip}><Text style={ui.body}>Actions ▾</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 24 }}><View style={[ui.card, { maxWidth: 420, width: '100%', alignSelf: 'center' }]} accessibilityViewIsModal>
      <Text style={ui.heading}>Dashboard actions</Text><Text style={ui.muted}>Switch view</Text>{views.map(v => <Pressable accessibilityRole="radio" accessibilityState={{ checked: mode === v.id }} key={v.id} style={ui.chip} onPress={() => run(() => setMode(v.id))}><Text style={ui.body}>{mode === v.id ? '✓' : v.icon}  {v.label}</Text></Pressable>)}
      <View style={ui.divider}><Pressable accessibilityRole="button" style={ui.chip} onPress={() => run(reload)}><Text style={ui.body}>↻ Reload collected data</Text></Pressable><Pressable accessibilityRole="button" style={ui.chip} onPress={() => run(reset)}><Text style={ui.body}>↺ Reset filters</Text></Pressable>{exportCsv && <Pressable accessibilityRole="button" style={ui.chip} onPress={() => run(exportCsv)}><Text style={ui.body}>↓ Download demand CSV</Text></Pressable>}</View>
      <Pressable accessibilityRole="button" style={ui.chip} onPress={() => setOpen(false)}><Text style={ui.body}>Close actions</Text></Pressable>
    </View></View></Modal></>;
}
export function SkillCoverage({ value, present, total }: { value: number | null; present: number; total: number }) {
  const radius = 44; const circumference = 2 * Math.PI * radius;
  return <View style={ui.row}><View accessibilityRole="progressbar" accessibilityLabel="Observed skill evidence coverage" accessibilityValue={value === null ? { text: 'Unavailable' } : { min: 0, max: 100, now: value }}>
    <Svg width={112} height={112} viewBox="0 0 112 112"><Circle cx={56} cy={56} r={radius} fill="none" stroke={d.border} strokeWidth={8} />{value !== null && <Circle cx={56} cy={56} r={radius} fill="none" stroke={d.accent} strokeWidth={8} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - value / 100)} transform="rotate(-90 56 56)" />}</Svg>
    <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><Text style={ui.heading}>{value === null ? '—' : `${Math.round(value)}%`}</Text></View>
  </View><View style={{ flex: 1, minWidth: 180 }}><Text style={ui.heading}>Evidence coverage</Text><Text style={ui.body}>{present} / {total} skills with evidence</Text><Text style={ui.muted}>Evidence coverage · not employment probability</Text></View></View>;
}
