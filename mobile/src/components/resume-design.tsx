import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useFonts } from 'expo-font';
import { design as d } from '@/constants/design';
import { PlanIcon } from '@/components/career-plan-design';

export const resumeFace = (weight: 400 | 500 | 600 = 400) => Platform.OS === 'web' ? `CareerPlanInter${weight}, Inter, system-ui, sans-serif` : `CareerPlanInter${weight}`;
const fonts = {
  CareerPlanInter400: require('../../assets/fonts/career-plan/Inter-400.ttf'),
  CareerPlanInter500: require('../../assets/fonts/career-plan/Inter-500.ttf'),
  CareerPlanInter600: require('../../assets/fonts/career-plan/Inter-600.ttf'),
};

export function ResumePage({ children, jobId }: { children: ReactNode; jobId?: number | null }) {
  const { width } = useWindowDimensions();
  const [loaded, error] = useFonts(fonts);
  if (!loaded && !error) return <View style={r.screen}><ActivityIndicator color={d.accent} accessibilityLabel="Loading Resume Analyzer typography" /></View>;
  return <SafeAreaView edges={['bottom']} style={r.screen}><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
    <View style={r.subnav}><View style={[r.spread, r.container, { paddingHorizontal: width < 768 ? 16 : 24, gap: 8 }]}><View style={[r.row, { gap: 24 }]}>{[{ href: '/resume', title: 'Resume Analyzer', icon: 'profile' as const }, { href: '/linkedin', title: 'LinkedIn Analyzer', icon: 'edit' as const }].map(item => <Link key={item.href} href={item.href as '/resume' | '/linkedin'} asChild><Pressable accessibilityRole="link" aria-current={item.href === '/resume' ? 'page' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52, borderBottomWidth: 2, borderBottomColor: item.href === '/resume' ? d.accent : 'transparent' }}><PlanIcon name={item.icon} size={16} color={item.href === '/resume' ? '#cdbdff' : d.muted} /><Text style={[r.label, { color: item.href === '/resume' ? d.text : d.muted }]}>{item.title}</Text></Pressable></Link>)}</View>{width >= 900 && <Text style={r.small}>Career Assets / Resume Workspace{jobId ? ` · Job #${jobId}` : ''}</Text>}</View></View>
    <View style={[r.container, { paddingHorizontal: width < 768 ? 16 : 24, paddingTop: 36, paddingBottom: 48, gap: 24 }]}>{children}</View>
    <View style={r.footer}><View style={[r.container, r.spread, { padding: 24 }]}><Text style={r.small}>Skillup · Career evidence & learning workspace</Text><Text style={r.small}>Private resume revisions · Explicit save required</Text></View></View>
  </ScrollView></SafeAreaView>;
}
export function ResumeCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <View style={[r.card, style]}>{children}</View>; }
export function ResumeTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'accent' }) {
  const color = tone === 'success' ? d.successText : tone === 'warning' ? d.highlight : tone === 'accent' ? '#cdbdff' : d.muted;
  return <View style={[r.tag, { borderColor: tone === 'success' ? '#216754' : tone === 'warning' ? '#614d20' : d.strongBorder, backgroundColor: tone === 'success' ? '#102b24' : d.higher }]}><Text style={[r.tagText, { color }]}>{children}</Text></View>;
}
export function ResumeAction({ children, onPress, disabled = false, secondary = false, busy = false, icon }: { children: ReactNode; onPress: () => void; disabled?: boolean; secondary?: boolean; busy?: boolean; icon?: Parameters<typeof PlanIcon>[0]['name'] }) {
  const { width } = useWindowDimensions();
  return <Pressable accessibilityRole="button" aria-disabled={disabled || busy} aria-busy={busy} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ hovered, pressed }) => [r.button, secondary && r.secondary, (Platform.OS !== 'web' || width < 768) && { minHeight: 44 }, hovered && !disabled && { backgroundColor: secondary ? d.overlay : d.accentHover }, pressed && { opacity: 0.8 }, (disabled || busy) && { opacity: 0.5 }]}><View style={[r.row, { justifyContent: 'center', gap: 6 }]}>{busy ? <ActivityIndicator size="small" color={d.text} /> : icon ? <PlanIcon name={icon} size={16} color={d.text} /> : null}<Text style={r.buttonText}>{children}</Text></View></Pressable>;
}
export function ResumeDetails({ children, label = 'Details', open: controlled, onToggle, hideTrigger = false }: { children: ReactNode; label?: string; open?: boolean; onToggle?: () => void; hideTrigger?: boolean }) {
  const [local, setLocal] = useState(false);
  const { width } = useWindowDimensions();
  const open = controlled ?? local;
  if (hideTrigger && !open) return null;
  return <View style={{ gap: 12 }}>{!hideTrigger && <Pressable accessibilityRole="button" accessibilityLabel={label} aria-expanded={open} accessibilityState={{ expanded: open }} onPress={() => onToggle ? onToggle() : setLocal(value => !value)} style={[r.disclosure, (width < 768 || Platform.OS !== 'web') && { minHeight: 44 }]}><Text style={[r.small, { color: d.body }]}>{open ? '−' : '+'} {label}</Text></Pressable>}{open && <View style={{ gap: 12 }}>{children}</View>}</View>;
}
export function ResumeField({ label, value, onChange, multiline = false, disabled = false, maxLength = 20000, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; disabled?: boolean; maxLength?: number; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 6 }}><Text style={r.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} editable={!disabled} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={d.muted} autoCapitalize="none" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[r.input, multiline && { minHeight: 132, textAlignVertical: 'top' }, focused && { borderColor: d.accent }]} /></View>;
}
export function ResumeCheck({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={checked} aria-disabled={disabled} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={[r.row, { alignItems: 'flex-start', flexWrap: 'nowrap', minHeight: 44, paddingVertical: 8, opacity: disabled ? 0.6 : 1 }]}><View style={{ width: 16, height: 16, borderRadius: 2, borderWidth: 1, borderColor: checked ? d.accent : d.strongBorder, backgroundColor: checked ? d.accent : d.canvas, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}><Text style={[r.label, { fontSize: 11 }]}>{checked ? '✓' : ''}</Text></View><Text style={[r.small, { flex: 1, color: d.body }]}>{label}</Text></Pressable>;
}
export function ResumeColumns({ children, editor = false }: { children: ReactNode; editor?: boolean }) {
  const { width } = useWindowDimensions();
  return <View style={{ flexDirection: width >= (editor ? 1024 : 768) ? 'row' : 'column', alignItems: editor && width >= 1024 ? 'flex-start' : 'stretch', gap: editor ? 24 : 12 }}>{children}</View>;
}
export function ResumeSteps({ index }: { index: number }) {
  const { width } = useWindowDimensions();
  return <View accessibilityLabel="Resume workflow progress" style={[r.card, r.row, { alignItems: 'stretch', gap: 12, padding: 16 }]}>{['Add resume', 'Choose target', 'Review feedback', 'Revise', 'Export'].map((step, i) => <View key={step} aria-current={i === index ? 'step' : undefined} style={{ flex: 1, minWidth: width < 640 ? 120 : 0, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: i === index ? '#cdbdff' : 'transparent', borderRadius: 4, padding: 8, backgroundColor: i === index ? d.higher : 'transparent', opacity: i > index ? 0.5 : 1 }}><View style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: i < index ? '#15846e' : i === index ? d.accent : d.higher, borderWidth: 1, borderColor: d.strongBorder, alignItems: 'center', justifyContent: 'center' }}><Text style={r.label}>{i < index ? '✓' : i + 1}</Text></View><View style={{ flex: 1, gap: 2 }}><Text style={[r.label, { fontSize: 11 }]}>{i + 1}. {step}</Text><Text style={[r.small, { fontSize: 10, lineHeight: 14, color: i < index ? d.successText : d.muted }]}>{i === index ? 'Current stage' : i < index ? 'Earlier stage' : 'Next stage'}</Text></View></View>)}</View>;
}

export const r = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, container: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, maxWidth: '100%' }, spread: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, maxWidth: '100%' },
  column: { flex: 1, minWidth: 0, gap: 12 }, title: { fontFamily: resumeFace(600), fontSize: 42, lineHeight: 50, fontWeight: '600', letterSpacing: -1.05, color: d.text },
  heading: { fontFamily: resumeFace(600), fontWeight: '600', fontSize: 20, lineHeight: 26, color: d.text }, subheading: { fontFamily: resumeFace(600), fontWeight: '600', fontSize: 16, lineHeight: 24, color: d.text },
  body: { fontFamily: resumeFace(), fontSize: 14, lineHeight: 22, color: d.body }, description: { fontFamily: resumeFace(), fontSize: 16, lineHeight: 24, color: d.muted },
  label: { fontFamily: resumeFace(500), fontWeight: '500', fontSize: 12, lineHeight: 16, color: d.text }, small: { fontFamily: resumeFace(), fontSize: 12, lineHeight: 20, color: d.muted },
  kicker: { fontFamily: resumeFace(600), fontWeight: '600', fontSize: 11, lineHeight: 14, letterSpacing: 1, color: '#cdbdff' },
  card: { backgroundColor: d.elevated, borderWidth: 1, borderColor: d.border, borderRadius: 8, padding: 16, gap: 16, minWidth: 0 },
  inset: { borderWidth: 1, borderColor: d.border, backgroundColor: d.canvas, borderRadius: 4, padding: 12, gap: 8, minWidth: 0 },
  button: { backgroundColor: d.accent, minHeight: 36, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, alignSelf: 'flex-start', justifyContent: 'center', maxWidth: '100%' }, secondary: { backgroundColor: d.higher, borderWidth: 1, borderColor: d.strongBorder, borderRadius: 4, minHeight: 32, paddingHorizontal: 12, paddingVertical: 6 },
  buttonText: { fontFamily: resumeFace(500), fontWeight: '500', fontSize: 12, lineHeight: 16, color: d.text, textAlign: 'center', flexShrink: 1 },
  tag: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderRadius: 4 }, tagText: { fontFamily: resumeFace(500), fontSize: 11, lineHeight: 16, flexShrink: 1 },
  input: { fontFamily: resumeFace(), fontSize: 14, lineHeight: 22, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, borderWidth: 1, borderColor: d.strongBorder, borderRadius: 4, color: d.text, backgroundColor: d.canvas },
  disclosure: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start', maxWidth: '100%' }, divider: { borderTopWidth: 1, borderTopColor: d.border, paddingTop: 12, gap: 12 },
  notice: { borderWidth: 1, borderColor: d.strongBorder, borderLeftWidth: 4, borderLeftColor: d.accent, borderRadius: 4, backgroundColor: d.elevated, padding: 16, gap: 12 },
  metric: { fontFamily: resumeFace(600), fontWeight: '600', fontSize: 48, lineHeight: 54, letterSpacing: -1, color: d.text },
  error: { fontFamily: resumeFace(), fontSize: 14, lineHeight: 22, color: d.error },
  subnav: { backgroundColor: d.elevated, borderBottomWidth: 1, borderBottomColor: d.border }, footer: { marginTop: 'auto', backgroundColor: d.elevated, borderTopWidth: 1, borderTopColor: d.border },
  original: { fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Consolas, monospace' : Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, lineHeight: 21, color: d.body, padding: 12, backgroundColor: d.canvas },
});
