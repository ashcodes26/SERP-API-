import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { design as d } from '@/constants/design';

const face = (weight: 400 | 500 | 600) => Platform.OS === 'web' ? `CareerPlanInter${weight}, Inter, system-ui, sans-serif` : `CareerPlanInter${weight}`;
export const planSurface = '#201f21';
const planFonts = {
  CareerPlanInter400: require('../../assets/fonts/career-plan/Inter-400.ttf'),
  CareerPlanInter500: require('../../assets/fonts/career-plan/Inter-500.ttf'),
  CareerPlanInter600: require('../../assets/fonts/career-plan/Inter-600.ttf'),
};

/** Page-scoped dimensions from the Stitch export; shared app tokens remain intact. */
export const cp = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, maxWidth: '100%' },
  spread: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, maxWidth: '100%' },
  heading: { fontFamily: face(600), fontSize: 20, lineHeight: 26, fontWeight: '600', color: d.text },
  title: { fontFamily: face(600), fontSize: 42, lineHeight: 50, fontWeight: '600', letterSpacing: -1.2, color: d.text },
  body: { fontFamily: face(400), fontSize: 14, lineHeight: 22, color: d.body },
  small: { fontFamily: face(400), fontSize: 12, lineHeight: 20, color: d.muted },
  label: { fontFamily: face(500), fontSize: 12, lineHeight: 16, fontWeight: '500', color: d.body },
  kicker: { fontFamily: face(600), fontSize: 11, lineHeight: 14, letterSpacing: 1, color: d.muted },
  strong: { fontFamily: face(600), fontSize: 16, lineHeight: 24, fontWeight: '600', color: d.text },
  metric: { fontFamily: face(600), fontSize: 48, lineHeight: 54, letterSpacing: -1, color: d.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  section: { backgroundColor: d.elevated, borderWidth: 1, borderColor: d.border, borderRadius: 8, padding: 24, gap: 16 },
  inset: { backgroundColor: planSurface, borderWidth: 1, borderColor: d.border, borderRadius: 4, padding: 16, gap: 12, minWidth: 0 },
  divider: { borderTopWidth: 1, borderTopColor: d.border, paddingTop: 16, gap: 12 },
  notice: { backgroundColor: planSurface, borderWidth: 1, borderColor: d.border, borderRadius: 4, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  button: { alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 1, backgroundColor: d.accent, borderWidth: 1, borderColor: d.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, minHeight: 34, justifyContent: 'center' },
  buttonText: { fontFamily: face(500), fontSize: 12, lineHeight: 16, fontWeight: '500', color: d.text, textAlign: 'center' },
  input: { fontFamily: face(400), fontSize: 14, lineHeight: 22, color: d.text, backgroundColor: d.canvas, borderWidth: 1, borderColor: d.strongBorder, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
});

export function PlanAction({ children, onPress, disabled = false, secondary = false, icon }: { children: ReactNode; onPress: () => void; disabled?: boolean; secondary?: boolean; icon?: 'chart' | 'edit' | 'upload' | 'export' }) {
  const { width } = useWindowDimensions();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed, hovered }) => [cp.button, secondary ? { backgroundColor: d.higher, borderColor: d.strongBorder } : { minHeight: 44, borderWidth: 0, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 }, (Platform.OS !== 'web' || width < 768) && { minHeight: 44 }, hovered && !disabled && { backgroundColor: secondary ? d.overlay : d.accentHover }, pressed && { opacity: 0.8 }, disabled && { backgroundColor: d.higher, borderColor: d.border }]}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' }}>{icon && <PlanIcon name={icon} size={secondary ? 16 : 18} color={disabled ? d.disabled : d.text} />}<Text style={[secondary ? cp.buttonText : cp.strong, { textAlign: 'center', flexShrink: 1 }, disabled && { color: d.disabled }]}>{children}</Text></View></Pressable>;
}
export function PlanTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  const color = tone === 'success' ? d.successText : tone === 'warning' ? d.highlight : d.muted;
  return <View style={{ alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: tone === 'success' ? '#216754' : d.strongBorder, borderRadius: 12, backgroundColor: tone === 'success' ? '#15342e' : d.higher }}><Text style={[cp.label, { color, fontSize: 11, lineHeight: 16 }]}>{children}</Text></View>;
}
export function PlanSection({ children }: { children: ReactNode }) { return <View style={cp.section}>{children}</View>; }
export function PlanHeading({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return <View style={cp.spread}><View style={{ flex: 1, minWidth: 180 }}><Text accessibilityRole="header" style={cp.heading}>{title}</Text>{description && <Text style={cp.small}>{description}</Text>}</View>{aside}</View>;
}
export function PlanDetails({ label, children, summary }: { label: string; children: ReactNode; summary?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  return <View style={{ gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={[cp.spread, { minHeight: Platform.OS === 'web' && width >= 768 ? 28 : 44 }]}>{summary}<Text style={[cp.small, { color: d.body }]}>{open ? '−' : '+'} {label}</Text></Pressable>{open && children}</View>;
}
export function PlanTitle({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <Text accessibilityRole="header" style={[cp.title, width < 768 && { fontSize: 28, lineHeight: 34, letterSpacing: -0.6 }]}>{children}</Text>;
}
export function PlanMark({ avatar = false }: { avatar?: boolean }) {
  if (!avatar) return <Image accessible={false} source={require('../../assets/images/career-plan-logo.png')} style={{ width: 32, height: 32 }} resizeMode="contain" />;
  return <Svg aria-hidden width={24} height={24} viewBox="0 0 24 24"><Circle cx={12} cy={8} r={3} fill="none" stroke="#370095" strokeWidth={1.5} /><Path d="M6 19v-2c0-5 12-5 12 0v2Z" fill="none" stroke="#370095" strokeWidth={1.5} /></Svg>;
}
export function PlanField({ label, value, onChange, multiline = false, disabled = false, maxLength = 20000, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; disabled?: boolean; maxLength?: number; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 6 }}><Text style={cp.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} accessibilityState={{ disabled }} maxLength={maxLength} multiline={multiline} placeholder={placeholder} placeholderTextColor={d.muted} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[cp.input, focused && { borderColor: d.accent }, multiline && { minHeight: 76, textAlignVertical: 'top' }]} /></View>;
}
export function CareerPlanPage({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const [fontsLoaded, fontError] = useFonts(planFonts);
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: d.canvas, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={d.accent} accessibilityLabel="Loading Career Plan typography" /></View>;
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: d.canvas }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}><View style={{ width: '100%', maxWidth: 960, alignSelf: 'center', padding: width < 768 ? 16 : 24, gap: 24 }}>{children}</View><View style={{ marginTop: 'auto', borderTopWidth: 1, borderTopColor: d.border, backgroundColor: d.elevated }}><View style={[cp.spread, { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 24 }]}><Text style={cp.small}>Skillup · Career evidence & learning workspace</Text><Text style={cp.small}>Readiness is informational</Text></View></View></ScrollView></SafeAreaView>;
}

/** Decorative symbols replace platform-dependent text glyphs in the compact dashboard. */
export function PlanIcon({ name, color = '#cdbdff', size = 18 }: { name: 'info' | 'profile' | 'check' | 'clock' | 'spark' | 'shield' | 'chart' | 'warning' | 'edit' | 'upload' | 'export'; color?: string; size?: number }) {
  const paths = {
    info: 'M12 11v6m0-10v.1',
    profile: 'M8 4h8v3H8zM5 6H3v15h18V6h-2M7 12h4m-4 4h10',
    check: 'm6 12 4 4 8-8',
    clock: 'M12 6v6l4 2',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Zm-4 9 3 3 5-6',
    chart: 'M4 20V4h16v16ZM8 16v-4m4 4V8m4 8v-6',
    warning: 'M12 3 2 21h20Zm0 6v5m0 3v.1',
    edit: 'm16 3 5 5L9 20l-6 2 2-6ZM13 6l5 5',
    upload: 'M12 16V4m-5 5 5-5 5 5M4 15v6h16v-6',
    export: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  };
  return <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{['info', 'check', 'clock'].includes(name) && <Circle cx={12} cy={12} r={9} />}<Path d={paths[name]} /></Svg>;
}
