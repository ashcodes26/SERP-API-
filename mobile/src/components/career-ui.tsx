import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { design as d, spacing as s, radii, sizes, layout, typography as t } from '@/constants/design';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[ui.card, style]}>{children}</View>; }
export function Details({ children, label = 'Details' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={[ui.row, { minHeight: 44 }]}>
      <Text style={ui.muted}>{open ? '−' : '+'} {label}</Text>
    </Pressable>
    {open && <View style={{ gap: 8 }}>{children}</View>}
  </View>;
}
export function Action({ children, onPress, disabled = false, secondary = false, compact = false, busy = false, accessibilityLabel }: { children: ReactNode; onPress: () => void; disabled?: boolean; secondary?: boolean; compact?: boolean; busy?: boolean; accessibilityLabel?: string }) {
  const [hovered, setHovered] = useState(false);
  const inactive = disabled || busy;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: inactive, busy }} disabled={inactive} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    style={({ pressed }) => [ui.button, secondary && ui.secondary, compact && ui.compactButton,
      !inactive && hovered && { backgroundColor: secondary ? d.overlay : d.accentHover },
      !inactive && pressed && { backgroundColor: secondary ? d.overlay : d.accentPressed },
      inactive && { backgroundColor: d.higher, borderWidth: 1, borderColor: d.border }]}>
    <View style={[ui.row, { justifyContent: 'center', gap: s.one }]}>
      {busy && <ActivityIndicator size="small" color={d.muted} />}
      <Text style={[ui.buttonText, inactive && { color: d.muted }]}>{children}</Text>
    </View>
  </Pressable>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, content: { padding: s.four, paddingTop: s.five, paddingBottom: s.shelf, maxWidth: layout.workspace, width: '100%', alignSelf: 'center', gap: s.four },
  kicker: { ...t.kicker, color: d.muted }, title: { ...t.title, color: d.text }, heading: { ...t.heading, color: d.text }, body: { ...t.body, color: d.body }, muted: { ...t.caption, color: d.muted },
  card: { padding: s.four, borderWidth: 1, borderRadius: radii.card, borderColor: d.border, backgroundColor: d.elevated, gap: s.three }, label: { ...t.label, color: d.body }, input: { ...t.body, borderWidth: 1, borderColor: d.strongBorder, backgroundColor: d.canvas, borderRadius: radii.control, padding: s.two, color: d.text, minHeight: sizes.control },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: s.two, alignItems: 'center' }, button: { paddingVertical: s.two, paddingHorizontal: s.four, minHeight: sizes.control, borderRadius: radii.pill, backgroundColor: d.accent, alignItems: 'center', justifyContent: 'center' }, compactButton: { minHeight: sizes.compactControl, paddingVertical: s.one, paddingHorizontal: s.medium }, secondary: { backgroundColor: d.higher, borderWidth: 1, borderColor: d.strongBorder }, buttonText: { ...t.compact, color: d.text, fontWeight: '500', textAlign: 'center' },
  chip: { padding: s.two, minHeight: sizes.compactControl, borderRadius: radii.control, borderWidth: 1, borderColor: d.border }, selected: { borderColor: d.accent, backgroundColor: d.higher }, divider: { paddingTop: s.medium, borderTopWidth: 1, borderTopColor: d.border, gap: s.two }, error: { ...t.compact, color: d.error }, score: { ...t.metric, color: d.text, fontVariant: ['tabular-nums'] },
});
