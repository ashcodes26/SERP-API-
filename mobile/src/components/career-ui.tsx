import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { design as d } from '@/constants/design';

export function Card({ children }: { children: ReactNode }) { return <View testID="skillup-depth-card" style={ui.card}>{children}</View>; }
export function Action({ children, onPress, disabled = false, secondary = false }: { children: ReactNode; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed, hovered }) => [ui.button, secondary && ui.secondary, hovered && !disabled && ui.buttonHover, pressed && ui.buttonPressed, disabled && { opacity: 0.5 }]}><Text style={[ui.buttonText, secondary && { color: d.body }]}>{children}</Text></Pressable>;
}
export function Disclosure({ title, summary, children, open, onToggle }: { title: ReactNode; summary?: ReactNode; children: ReactNode; open: boolean; onToggle: () => void }) {
  return <View style={ui.disclosure}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={({ pressed, hovered }) => [ui.disclosureHeader, hovered && ui.disclosureHover, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={ui.body}>{title}</Text>{summary && <Text style={ui.muted}>{summary}</Text>}</View>
      <Text style={ui.disclosureIcon}>{open ? '−' : '+'}</Text>
    </Pressable>
    {open && <View style={ui.disclosureBody}>{children}</View>}
  </View>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, content: { padding: 24, paddingTop: 36, paddingBottom: 48, maxWidth: 880, width: '100%', alignSelf: 'center', gap: 20 },
  kicker: { fontSize: 11, letterSpacing: 2, color: d.muted }, title: { fontSize: 40, lineHeight: 46, fontWeight: '500', letterSpacing: -1, color: d.text }, heading: { color: d.text, fontSize: 22, fontWeight: '500', lineHeight: 29 }, body: { color: d.body, fontSize: 14, lineHeight: 23 }, muted: { color: d.muted, fontSize: 12, lineHeight: 20 },
  card: { padding: 24, borderWidth: 1, borderColor: d.border, borderRadius: d.radius, backgroundColor: d.surface, gap: 14, shadowColor: '#01030b', shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 7 }, label: { color: d.body, fontSize: 12 }, input: { borderWidth: 1, borderColor: d.strongBorder, backgroundColor: d.elevated, borderRadius: d.controlRadius, padding: 14, color: d.text, minHeight: 52 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, button: { padding: 16, minHeight: 50, borderRadius: d.controlRadius, backgroundColor: d.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#5d4cf5', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 6 }, buttonHover: { transform: [{ translateY: -2 }, { scale: 1.01 }], shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }, buttonPressed: { transform: [{ translateY: 1 }, { scale: 0.985 }], shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: d.strongBorder }, buttonText: { color: d.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  chip: { padding: 12, minHeight: 44, borderRadius: 6, borderWidth: 1, borderColor: d.border }, selected: { borderColor: d.body, backgroundColor: d.elevated }, divider: { paddingTop: 16, borderTopWidth: 1, borderTopColor: d.border, gap: 12 }, error: { color: d.error, fontSize: 14, lineHeight: 22 }, score: { color: d.text, fontSize: 48, fontWeight: '500', letterSpacing: -1 },
  disclosure: { borderWidth: 1, borderColor: d.border, borderRadius: d.controlRadius, overflow: 'hidden', backgroundColor: d.elevated }, disclosureHeader: { minHeight: 58, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, disclosureHover: { backgroundColor: 'rgba(131, 108, 255, 0.12)' }, disclosureIcon: { color: '#9fc3ff', fontSize: 24, lineHeight: 28, width: 24, textAlign: 'center' }, disclosureBody: { borderTopWidth: 1, borderTopColor: d.border, padding: 16, gap: 12 },
});
