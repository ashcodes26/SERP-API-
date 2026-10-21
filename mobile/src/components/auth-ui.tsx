import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { api } from '@/api/client';
import { design as d } from '@/constants/design';

const face = (weight: 400 | 500 | 600) => Platform.OS === 'web' ? `SkillupAuthInter${weight}, Inter, system-ui, sans-serif` : `SkillupAuthInter${weight}`;
const fonts = {
  SkillupAuthInter400: require('../../assets/fonts/career-plan/Inter-400.ttf'),
  SkillupAuthInter500: require('../../assets/fonts/career-plan/Inter-500.ttf'),
  SkillupAuthInter600: require('../../assets/fonts/career-plan/Inter-600.ttf'),
};
const container = '#201f21';
type IconName = 'terminal' | 'shield' | 'help' | 'students' | 'faculty' | 'route' | 'key' | 'add' | 'lock' | 'eye' | 'enter' | 'info';
const paths: Record<IconName, string> = {
  terminal: 'M3 5h18v14H3z M6 9l3 3-3 3 M12 15h5',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z M9 12l2 2 4-4',
  help: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01',
  students: 'M2 9l10-5 10 5-10 5z M6 11v6c4 3 8 3 12 0v-6 M22 9v8',
  faculty: 'M3 9l9-6 9 6z M3 21h18 M5 11v7 M10 11v7 M14 11v7 M19 11v7',
  route: 'M12 21V9 M12 14L5 7 M12 14l7-7 M2 7h5V2 M17 2v5h5',
  key: 'M9 14a5 5 0 1 1 0-6h12v4h-3v3h-3v-3H9 M4 10h.01',
  add: 'M14 20v-2c0-3-3-4-6-4s-6 1-6 4v2 M17 8h6 M20 5v6 M11 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  lock: 'M6 10h12v11H6z M8 10V7a4 4 0 0 1 8 0v3 M12 14v3',
  eye: 'M2 12c5-7 15-7 20 0-5 7-15 7-20 0 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  enter: 'M13 4h7v16h-7 M3 12h12 M10 7l5 5-5 5',
  info: 'M12 11v6 M12 7h.01',
};
export function AuthIcon({ name, color = d.text, size = 18 }: { name: IconName; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>{(name === 'help' || name === 'info') && <Circle cx={12} cy={12} r={9} />}<Path d={paths[name]} /></Svg>;
}

export function AuthLayout({ children }: { children: ReactNode }) {
  useFonts(fonts);
  const { width } = useWindowDimensions();
  const [help, setHelp] = useState(false);
  const [health, setHealth] = useState<'checking' | 'ok' | 'unavailable'>('checking');
  useEffect(() => {
    let active = true;
    api.health().then(value => { if (active) setHealth(value.status === 'ok' && value.database === 'ok' ? 'ok' : 'unavailable'); }).catch(() => { if (active) setHealth('unavailable'); });
    return () => { active = false; };
  }, []);
  const wide = width >= 1024;
  return <SafeAreaView style={auth.shell}>
    <View style={auth.header}><View style={[auth.headerInner, { paddingHorizontal: width < 640 ? 16 : 24 }]}>
      <View style={auth.row}><View style={auth.mark}><AuthIcon name="terminal" size={18} /></View><Text style={auth.brand}>SKILLUP</Text><View style={auth.divider} /><AuthIcon name="shield" size={15} color={d.successText} /></View>
      <View style={[auth.row, { gap: 12 }]}><View accessibilityLabel={health === 'ok' ? 'Service available' : health === 'checking' ? 'Checking service availability' : 'Service availability could not be confirmed'} style={auth.health}><View style={[auth.dot, { backgroundColor: health === 'ok' ? d.success : d.muted }]} /></View><Pressable accessibilityRole="button" accessibilityLabel="Account access information" onPress={() => setHelp(true)} hitSlop={10} style={[auth.help, width < 768 && { minWidth: 44 }]}><AuthIcon name="help" color={d.muted} /></Pressable></View>
    </View></View>
    <KeyboardAvoidingView style={auth.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[auth.scroll, { paddingHorizontal: width < 640 ? 16 : 24 }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden aria-hidden>
          <Image source={require('../../assets/images/auth-stitch-background.jpg')} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} />
          <Svg width="100%" height="100%" style={[StyleSheet.absoluteFill, { zIndex: 1 }]}><Defs><LinearGradient id="authScrim" x1="0%" x2="100%" y1="0%" y2="0%"><Stop offset="0" stopColor="#000" stopOpacity={0.96} /><Stop offset="0.5" stopColor="#0d0d0f" stopOpacity={0.92} /><Stop offset="1" stopColor="#000" stopOpacity={0.98} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#authScrim)" /></Svg>
        </View>
        <View style={[auth.content, wide && auth.contentWide]}>
          <View style={[auth.story, wide && { width: '54%' }]}>
            <View style={auth.eyebrow}><View style={[auth.dot, { backgroundColor: '#c4b5fd' }]} /><Text style={auth.kicker}>CAREER READINESS & PLACEMENT PLATFORM</Text></View>
            <View style={{ gap: 6 }}><Text accessibilityRole="header" style={[auth.title, width < 768 && { fontSize: 28, lineHeight: 34, letterSpacing: -0.7 }]}>Connecting verified evidence to career outcomes.</Text><Text style={auth.description}>Understand your skills, prepare your career assets, and build a learning plan around the role you want.</Text></View>
            <View style={auth.context}><View style={auth.contextIcon}><AuthIcon name="students" color={d.successText} size={20} /></View><View style={auth.flex}><Text style={auth.contextTitle}>ONE CONNECTED WORKSPACE</Text><Text numberOfLines={1} style={auth.caption}>Your profile, role alignment, learning roadmap and placement activity—all in one place.</Text></View></View>
            <View style={[auth.roles, width < 768 && { flexDirection: 'column' }]}>
              <RoleCard icon="students" title="For Students" color="#c4b5fd">Analyze target roles against confirmed profile evidence, bridge skill gaps with learning roadmaps, and prepare resume revisions you review and approve for placement drives.</RoleCard>
              <RoleCard icon="faculty" title="For Placement Faculty" color="#f1d7b0">Oversee authorized cohort records, inspect competency benchmarks, manage placement drives and training, and review only the saved resume revisions students explicitly share.</RoleCard>
            </View>
          </View>
          <View style={auth.form}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={help} transparent animationType="fade" onRequestClose={() => setHelp(false)}><View style={auth.modalScrim}><View role="dialog" aria-modal accessibilityLabel="Account access" accessibilityViewIsModal style={auth.helpPanel}><Text accessibilityRole="header" style={auth.roleTitle}>Account access</Text><Text style={auth.body}>Sign in with your registered username. Students open My Career Plan; placement faculty open the Faculty Console. Your server-issued account role determines access.</Text><Text style={auth.body}>Public registration creates student accounts only. Faculty and imported account activation are managed by your institution. Web sessions are stored per browser tab.</Text><AuthButton onPress={() => setHelp(false)}>Close</AuthButton></View></View></Modal>
  </SafeAreaView>;
}

function RoleCard({ icon, title, color, children }: { icon: IconName; title: string; color: string; children: ReactNode }) {
  return <View style={auth.roleCard}><View style={[auth.row, { gap: 6 }]}><AuthIcon name={icon} color={color} size={20} /><Text style={auth.roleTitle}>{title}</Text></View><Text style={auth.body}>{children}</Text></View>;
}
export function AuthTabs({ signup, busy, onChange }: { signup: boolean; busy: boolean; onChange: (signup: boolean) => void }) {
  const { width } = useWindowDimensions();
  return <View accessibilityRole="tablist" style={auth.tabs}>{[false, true].map(value => <Pressable key={String(value)} accessibilityRole="tab" accessibilityLabel={value ? 'Create student account' : 'Sign in'} aria-selected={signup === value} aria-disabled={busy} accessibilityState={{ selected: signup === value, disabled: busy }} disabled={busy} onPress={() => onChange(value)} style={({ hovered }) => [auth.tab, (Platform.OS !== 'web' || width < 768) && { minHeight: 44 }, signup === value ? { backgroundColor: d.accent } : hovered && { backgroundColor: container }]}><AuthIcon name={value ? 'add' : 'key'} size={16} color={signup === value ? d.text : d.muted} /><Text style={[auth.buttonText, { flexShrink: 1, color: signup === value ? d.text : d.muted }]}>{value ? 'Create Student Account' : 'Sign In'}</Text>{value && <View style={auth.studentBadge}><Text style={auth.studentBadgeText}>Students</Text></View>}</Pressable>)}</View>;
}
export function AuthField({ label, helper, aside, compact, ...input }: TextInputProps & { label: string; helper?: string; aside?: ReactNode; compact?: boolean }) {
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  return <View style={[auth.field, compact && { gap: 4 }]}><View style={auth.spread}><Text style={auth.label}>{label}</Text>{aside}</View><TextInput {...input} accessibilityLabel={input.accessibilityLabel ?? label} placeholderTextColor={d.muted} onFocus={event => { setFocused(true); input.onFocus?.(event); }} onBlur={event => { setFocused(false); input.onBlur?.(event); }} style={[auth.input, compact && { paddingVertical: 8, height: 38 }, (Platform.OS !== 'web' || width < 768) && { minHeight: 44 }, focused && { borderColor: d.accent }, input.style]} />{helper && <Text style={auth.helper}>{helper}</Text>}</View>;
}
export function AuthButton({ children, disabled, busy, onPress, icon = 'lock' }: { children: ReactNode; disabled?: boolean; busy?: boolean; onPress: () => void; icon?: IconName }) {
  return <Pressable accessibilityRole="button" aria-disabled={!!disabled || !!busy} aria-busy={!!busy} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed, hovered }) => [auth.submit, hovered && !disabled && !busy && { backgroundColor: d.accentHover }, pressed && { opacity: 0.8 }, (disabled || busy) && { opacity: 0.6 }]}>{busy ? <ActivityIndicator size="small" color={d.text} /> : <AuthIcon name={icon} />}<Text style={auth.buttonText}>{children}</Text></Pressable>;
}
export function AuthSandbox({ busy, onDemo }: { busy: boolean; onDemo: () => void }) {
  if (!__DEV__) return null;
  return <View style={auth.sandbox}><View style={[auth.row, { gap: 8 }]}><AuthIcon name="terminal" size={16} color={d.highlight} /><Text style={auth.sandboxHeading}>DEVELOPMENT & DEMO SANDBOX</Text></View><View style={{ gap: 6 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open local development student demo" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onDemo} style={({ hovered }) => [auth.demoRow, hovered && { backgroundColor: container }, busy && { opacity: 0.6 }]}><View style={auth.demoCircle}><AuthIcon name="students" color="#c4b5fd" size={18} /></View><View style={auth.flex}><Text style={auth.demoTitle}>Demo Student</Text><Text style={auth.demoCaption}>Local development only · Server-controlled access</Text></View><AuthIcon name="enter" color={d.muted} /></Pressable>
    <View style={auth.demoRow}><View style={[auth.demoCircle, { backgroundColor: '#362b16' }]}><AuthIcon name="faculty" color={d.highlight} size={18} /></View><View style={auth.flex}><Text style={auth.demoTitle}>Placement Faculty</Text><Text style={auth.demoCaption}>Sign in with an institution-provisioned account</Text></View><AuthIcon name="lock" size={16} color={d.disabled} /></View>
  </View></View>;
}

export const auth = StyleSheet.create({
  shell: { flex: 1, backgroundColor: d.canvas },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  header: { height: 64, backgroundColor: d.canvas },
  headerInner: { width: '100%', maxWidth: 1280, height: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mark: { width: 28, height: 28, backgroundColor: d.accent, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: face(600), fontWeight: '600', fontSize: 20, lineHeight: 26, letterSpacing: -0.5, color: d.text },
  divider: { width: 1, height: 16, backgroundColor: d.strongBorder, marginHorizontal: 10 },
  health: { width: 32, height: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: d.higher },
  dot: { width: 8, height: 8, borderRadius: 4 },
  help: { minWidth: 28, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 36 },
  content: { width: '100%', maxWidth: 1280, alignSelf: 'center', gap: 36 },
  contentWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  story: { width: '100%', gap: 24, minWidth: 0 },
  eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: d.higher, borderRadius: 12, maxWidth: '100%' },
  kicker: { fontFamily: face(600), fontWeight: '600', fontSize: 11, lineHeight: 14, letterSpacing: 1.1, color: '#c4b5fd', flexShrink: 1 },
  title: { fontFamily: face(600), fontWeight: '600', fontSize: 42, lineHeight: 50, letterSpacing: -1.05, color: d.text },
  description: { fontFamily: face(400), fontSize: 16, lineHeight: 26, color: d.muted },
  context: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: d.elevated, padding: 16, borderRadius: 8 },
  contextIcon: { width: 36, height: 36, borderRadius: 4, backgroundColor: container, alignItems: 'center', justifyContent: 'center' },
  contextTitle: { fontFamily: face(600), fontWeight: '600', fontSize: 12, lineHeight: 16, color: d.text },
  caption: { fontFamily: face(400), fontSize: 12, lineHeight: 20, color: d.muted },
  roles: { flexDirection: 'row', gap: 16, paddingTop: 6 },
  roleCard: { flex: 1, minWidth: 0, backgroundColor: d.elevated, borderRadius: 8, padding: 16, gap: 8 },
  roleTitle: { fontFamily: face(600), fontWeight: '600', fontSize: 16, lineHeight: 24, color: d.text },
  body: { fontFamily: face(400), fontSize: 14, lineHeight: 22.75, color: d.muted },
  form: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: d.elevated, borderRadius: 16, padding: 24, gap: 16, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)' },
  tabs: { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 4, backgroundColor: d.higher },
  tab: { flex: 1, minWidth: 0, minHeight: 32, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 2 },
  studentBadge: { backgroundColor: '#2a2a2c', paddingHorizontal: 6, paddingVertical: 2 },
  studentBadgeText: { fontFamily: face(500), fontSize: 10, lineHeight: 16, color: d.successText },
  buttonText: { fontFamily: face(500), fontWeight: '500', fontSize: 12, lineHeight: 16, color: d.text, textAlign: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: container, borderRadius: 4, padding: 12 },
  noticeText: { fontFamily: face(400), fontSize: 12, lineHeight: 20, color: d.muted, flex: 1 },
  noticeStrong: { fontFamily: face(600), fontWeight: '600', color: d.text },
  fields: { gap: 16 },
  field: { gap: 6 },
  label: { fontFamily: face(500), fontWeight: '500', fontSize: 12, lineHeight: 16, color: d.text },
  input: { fontFamily: face(400), fontSize: 14, lineHeight: 22, color: d.text, height: 42, backgroundColor: d.canvas, borderWidth: 1, borderColor: 'transparent', borderRadius: 4, paddingHorizontal: 13, paddingVertical: 9 },
  helper: { fontFamily: face(400), fontSize: 12, lineHeight: 20, color: d.muted },
  show: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 20 },
  session: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 },
  submit: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: d.accent, padding: 12 },
  error: { fontFamily: face(400), fontSize: 12, lineHeight: 20, color: d.error },
  sandbox: { marginTop: 8, paddingTop: 16, gap: 12 },
  sandboxHeading: { fontFamily: face(500), fontSize: 11, lineHeight: 14, letterSpacing: 1.5, color: d.muted, flexShrink: 1 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: d.higher, borderRadius: 8, padding: 12, minHeight: 56 },
  demoCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#292334', alignItems: 'center', justifyContent: 'center' },
  demoTitle: { fontFamily: face(600), fontWeight: '600', fontSize: 12, lineHeight: 16, color: d.text },
  demoCaption: { fontFamily: face(400), fontSize: 11, lineHeight: 16, color: d.muted },
  modalScrim: { flex: 1, backgroundColor: '#000b', alignItems: 'center', justifyContent: 'center', padding: 24 },
  helpPanel: { width: '100%', maxWidth: 420, padding: 24, gap: 16, borderRadius: 16, backgroundColor: d.elevated, borderWidth: 1, borderColor: d.border },
});
