import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { design as d } from '@/constants/design';

export function Card({ children }: { children: ReactNode }) { return <View style={ui.card}>{children}</View>; }
export function Details({ children, label = 'Details' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={[ui.row, { minHeight: 44 }]}>
      <Text style={ui.muted}>{open ? '−' : '+'} {label}</Text>
    </Pressable>
    {open && <View style={{ gap: 8 }}>{children}</View>}
  </View>;
}
export function Action({ children, onPress, disabled = false, secondary = false }: { children: ReactNode; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, secondary && ui.secondary, (pressed || disabled) && { opacity: 0.5 }]}><Text style={[ui.buttonText, secondary && { color: d.body }]}>{children}</Text></Pressable>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, content: { padding: 24, paddingTop: 36, paddingBottom: 48, maxWidth: 1280, width: '100%', alignSelf: 'center', gap: 30 },
  kicker: { fontSize: 11, letterSpacing: 2, color: d.muted }, title: { fontSize: 42, lineHeight: 50, fontWeight: '500', letterSpacing: -1, color: d.text }, heading: { color: d.text, fontSize: 24, fontWeight: '500', lineHeight: 30 }, body: { color: d.body, fontSize: 16, lineHeight: 24 }, muted: { color: d.muted, fontSize: 12, lineHeight: 20 },
  card: { paddingVertical: 24, borderTopWidth: 1, borderColor: d.border, backgroundColor: d.canvas, gap: 18 }, label: { color: d.body, fontSize: 12 }, input: { borderWidth: 1, borderColor: d.strongBorder, backgroundColor: d.elevated, borderRadius: 6, padding: 12, color: d.text, minHeight: 48 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }, button: { paddingVertical: 12, paddingHorizontal: 18, minHeight: 48, borderRadius: 24, backgroundColor: d.accent, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: d.canvas, borderWidth: 1, borderColor: d.border }, buttonText: { color: d.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  chip: { padding: 12, minHeight: 44, borderRadius: 6, borderWidth: 1, borderColor: d.border }, selected: { borderColor: d.accent, backgroundColor: d.elevated }, divider: { paddingTop: 16, borderTopWidth: 1, borderTopColor: d.border, gap: 12 }, error: { color: d.error, fontSize: 14, lineHeight: 22 }, score: { color: d.text, fontSize: 48, fontWeight: '500', letterSpacing: -1 },
});
