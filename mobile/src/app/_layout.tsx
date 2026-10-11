import { DarkTheme, ThemeProvider } from 'expo-router';
import '@/global.css';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { api, session, workspaceApi } from '@/api/client';
import { design as d } from '@/constants/design';
import AppTabs from '@/components/app-tabs';

void SplashScreen.preventAutoHideAsync();

const benefits = [
  ['01', 'Understand your strengths', 'Gain clarity with actionable insights.'],
  ['02', 'Build a focused learning plan', 'Personalized and goal-oriented.'],
  ['03', 'Practice. Reflect. Progress.', 'Turn effort into tangible results.'],
] as const;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const [principal, setPrincipal] = useState<'admin' | 'student' | null>(null);
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const compact = width < 768;
  const tablet = width >= 768 && width < 1024;

  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  async function login() {
    if (busy) return;
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api.login(username.trim(), password);
      session.setToken(result.access_token); session.setStudentId(result.student_id); setPassword(''); setPrincipal(result.role);
    } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in unsuccessful'); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (principal === 'student') {
      try { await workspaceApi.clearSessionData(); }
      catch (err) { setError(err instanceof Error ? `Could not clear your private workspace: ${err.message}` : 'Could not clear your private workspace.'); return; }
    }
    session.clear(); setPrincipal(null); setPassword(''); setError('');
  }

  return <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: d.canvas, card: d.surface, border: d.border, primary: d.accent } }}>
    <StatusBar style="light" />
    {!principal ? <SafeAreaView nativeID="skillup-login-shell" style={s.loginShell}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.loginScroll} keyboardShouldPersistTaps="handled">
        <View nativeID="skillup-ambient" pointerEvents="none" accessible={false} style={s.ambient}><View nativeID="skillup-orb-one" style={s.orb} /><View nativeID="skillup-orb-two" style={s.orb} /><View nativeID="skillup-grid" style={s.grid} /></View>
        <View nativeID="skillup-login-page" style={[s.loginPage, compact && s.loginPageCompact]}>
          <View style={s.brandHeader}><Brand /><Text style={s.workspaceTag}>CAREER WORKSPACE</Text></View>
          <View nativeID="skillup-login-grid" style={[s.loginGrid, !compact && s.loginGridWide, tablet && s.loginGridTablet]}>
            <Hero compact={compact} />
            {!compact && <LearningScene compact={tablet} />}
            <AuthPanel username={username} password={password} passwordVisible={passwordVisible} busy={busy} error={error} onUsername={setUsername} onPassword={setPassword} onTogglePassword={() => setPasswordVisible(value => !value)} onSubmit={login} />
          </View>
          <Text style={s.loginFooter}>Skillup / A little more clarity. A lot more possibility.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView> : <SafeAreaView edges={['top']} style={s.appShell}>
      <View style={s.topbar}><Brand /><View style={s.accountRow}><Text style={s.workspaceTag}>{principal === 'admin' ? 'ADMIN' : 'STUDENT'} / DEMO</Text><Pressable accessibilityRole="button" onPress={logout} style={s.signoutButton}><Text style={s.signout}>Sign out ↗</Text></Pressable></View></View>
      <AppTabs role={principal} />
    </SafeAreaView>}
  </ThemeProvider>;
}

function Brand() { return <View style={s.brandRow}><View nativeID="skillup-mark" style={s.mark}><Text style={s.markText}>S</Text></View><Text style={s.brand}>skillup</Text></View>; }

function Hero({ compact }: { compact: boolean }) { return <View nativeID="skillup-hero" style={[s.heroColumn, compact && s.heroCompact]}>
  <View nativeID="skillup-eyebrow-pill" style={s.eyebrowPill}><Text style={s.eyebrow}>✦ EVIDENCE. DIRECTION. PROGRESS.</Text></View>
  <Text nativeID="skillup-login-headline" style={[s.heroTitle, compact && s.heroTitleCompact]}>Your next{`\n`}<Text nativeID="skillup-hero-gradient">chapter.</Text>{`\n`}Built with{`\n`}intention.</Text>
  <Text style={s.heroBody}>A focused workspace to understand your strengths, plan your learning, and track real progress toward the career you want.</Text>
  <View style={s.benefitList}>{benefits.map(([number, title, body]) => <View key={number} style={s.benefitRow}><Text style={s.benefitNumber}>{number}</Text><View style={s.benefitCopy}><Text style={s.benefitTitle}>{title}</Text>{!compact && <Text style={s.benefitBody}>{body}</Text>}</View></View>)}</View>
</View>; }

function LearningScene({ compact }: { compact: boolean }) { return <View nativeID="skillup-learning-scene" accessible={false} accessibilityElementsHidden style={[s.scene, compact && s.sceneCompact]}>
  <View nativeID="skillup-scene-halo" style={s.sceneHalo} /><View nativeID="skillup-scene-card" style={s.sceneCard}>
    <Text style={s.sceneOverline}>THIS WEEK</Text><View style={s.sceneTitleRow}><Text style={s.sceneTitle}>Learning momentum</Text><Text style={s.sceneValue}>72%</Text></View>
    {[['Python', '82%'], ['SQL', '64%'], ['Portfolio', '48%']].map(([label, value]) => <View key={label} style={s.progressItem}><View style={s.progressLabel}><Text style={s.progressText}>{label}</Text><Text style={s.progressText}>{value}</Text></View><View style={s.progressTrack}><View style={[s.progressFill, { width: value as `${number}%` }]} /></View></View>)}
    <Text style={s.sceneNote}>A representative preview — not account data</Text>
  </View><View nativeID="skillup-scene-tile-target" style={[s.sceneTile, s.tileTarget]}><Text style={s.tileIcon}>◎</Text></View><View nativeID="skillup-scene-tile-book" style={[s.sceneTile, s.tileBook]}><Text style={s.tileIcon}>▤</Text></View><View nativeID="skillup-scene-tile-chart" style={[s.sceneTile, s.tileChart]}><Text style={s.tileIcon}>↗</Text></View><View nativeID="skillup-scene-path" style={s.scenePath} />
</View>; }

function AuthPanel({ username, password, passwordVisible, busy, error, onUsername, onPassword, onTogglePassword, onSubmit }: { username: string; password: string; passwordVisible: boolean; busy: boolean; error: string; onUsername: (value: string) => void; onPassword: (value: string) => void; onTogglePassword: () => void; onSubmit: () => void }) { return <View nativeID="skillup-auth-panel" style={s.authPanel}>
  <Text style={s.authEyebrow}>WELCOME BACK</Text><Text style={s.authTitle}>Enter your workspace</Text><Text style={s.authNote}>Sign in to continue your learning journey.</Text>
  <View style={s.fieldGroup}><Text style={s.fieldLabel}>Username</Text><View style={s.inputWrap}><Text style={s.inputIcon}>◌</Text><TextInput accessibilityLabel="Username" autoCapitalize="none" autoComplete="username" autoCorrect={false} editable={!busy} value={username} onChangeText={onUsername} placeholder="demo or admin" placeholderTextColor={d.muted} style={s.input} /></View></View>
  <View style={s.fieldGroup}><Text style={s.fieldLabel}>Password</Text><View style={s.inputWrap}><Text style={s.inputIcon}>◈</Text><TextInput accessibilityLabel="Password" autoComplete="current-password" editable={!busy} value={password} onChangeText={onPassword} placeholder="Enter your password" placeholderTextColor={d.muted} secureTextEntry={!passwordVisible} onSubmitEditing={onSubmit} style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} onPress={onTogglePassword} disabled={busy} style={s.passwordToggle}><Text style={s.passwordToggleText}>{passwordVisible ? 'Hide' : 'Show'}</Text></Pressable></View></View>
  {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
  <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onSubmit} style={({ pressed }) => [s.submitButton, (pressed || busy) && { opacity: 0.72, transform: [{ translateY: 1 }] }]}>{busy ? <ActivityIndicator color="#f8f9ff" /> : <Text style={s.submitText}>Continue to Skillup →</Text>}</Pressable>
</View>; }

const s = StyleSheet.create({
  flex: { flex: 1 }, appShell: { flex: 1, backgroundColor: d.canvas }, loginShell: { flex: 1, backgroundColor: '#070b19' }, loginScroll: { flexGrow: 1, minHeight: '100%' }, ambient: { ...StyleSheet.absoluteFill, overflow: 'hidden' }, orb: { position: 'absolute', width: 440, height: 440, borderRadius: 220, backgroundColor: '#5b55f622', transform: [{ scale: 1.2 }] }, grid: { position: 'absolute', left: '-10%', right: '-10%', bottom: -220, height: 500, borderTopWidth: 1, borderColor: '#8da2ff2b', transform: [{ perspective: 700 }, { rotateX: '62deg' }] }, loginPage: { flex: 1, width: '100%', maxWidth: 1500, alignSelf: 'center', paddingHorizontal: 48, paddingVertical: 28, gap: 36 }, loginPageCompact: { paddingHorizontal: 20, paddingVertical: 20, gap: 28 }, brandHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 16 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, mark: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6d60ff', borderWidth: 1, borderColor: '#b8adff' }, markText: { color: '#ffffff', fontSize: 18, fontWeight: '800' }, brand: { color: '#f8f9ff', fontSize: 24, fontWeight: '700', letterSpacing: -0.8 }, workspaceTag: { color: '#abb7d7', fontSize: 10, letterSpacing: 1.8, fontWeight: '600' }, loginGrid: { flex: 1, justifyContent: 'center', gap: 38 }, loginGridWide: { flexDirection: 'row', alignItems: 'center' }, loginGridTablet: { gap: 24 }, heroColumn: { flex: 1.15, minWidth: 0, gap: 22, paddingVertical: 28 }, heroCompact: { paddingVertical: 8, gap: 18 }, eyebrowPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: '#9b8cff73', backgroundColor: '#201a4a99' }, eyebrow: { color: '#ccd5ff', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' }, heroTitle: { color: '#f8f9ff', fontSize: 56, lineHeight: 58, fontWeight: '800', letterSpacing: -2.4 }, heroTitleCompact: { fontSize: 42, lineHeight: 44, letterSpacing: -1.5 }, heroBody: { maxWidth: 430, color: '#abb7d7', fontSize: 16, lineHeight: 25 }, benefitList: { gap: 0, maxWidth: 440 }, benefitRow: { minHeight: 58, flexDirection: 'row', gap: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#9da9df30' }, benefitNumber: { color: '#89a7ff', fontSize: 11, letterSpacing: 1.2, paddingTop: 3 }, benefitCopy: { flex: 1, gap: 2 }, benefitTitle: { color: '#f0f2ff', fontSize: 14, fontWeight: '600' }, benefitBody: { color: '#8693b8', fontSize: 12, lineHeight: 18 }, scene: { width: 300, height: 330, justifyContent: 'center', alignItems: 'center', position: 'relative' }, sceneCompact: { width: 210, transform: [{ scale: 0.82 }] }, sceneHalo: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#6b6cff2b' }, sceneCard: { width: 245, minHeight: 180, padding: 18, gap: 12, borderRadius: 20, backgroundColor: '#171b3dd9', borderWidth: 1, borderColor: '#b8c3ff73', transform: [{ perspective: 700 }, { rotateY: '-12deg' }, { rotateX: '7deg' }] }, sceneOverline: { color: '#96aaff', fontSize: 9, letterSpacing: 1.3, fontWeight: '700' }, sceneTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, sceneTitle: { color: '#f8f9ff', fontSize: 15, fontWeight: '700' }, sceneValue: { color: '#80c9ff', fontSize: 17, fontWeight: '700' }, progressItem: { gap: 5 }, progressLabel: { flexDirection: 'row', justifyContent: 'space-between' }, progressText: { color: '#b8c4e5', fontSize: 10 }, progressTrack: { height: 5, borderRadius: 4, backgroundColor: '#4c5378' }, progressFill: { height: 5, borderRadius: 4, backgroundColor: '#8a72ff' }, sceneNote: { color: '#7d8ab5', fontSize: 8, lineHeight: 12 }, sceneTile: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#1b2047e8', borderWidth: 1, borderColor: '#afc0ff78' }, tileTarget: { left: 18, top: 42 }, tileBook: { right: 4, top: 74 }, tileChart: { right: 28, bottom: 34 }, tileIcon: { color: '#8ed0ff', fontSize: 24, fontWeight: '600' }, scenePath: { position: 'absolute', width: 225, height: 150, borderWidth: 1, borderColor: '#8d86ff66', borderRadius: 110, transform: [{ rotate: '-24deg' }] }, authPanel: { width: '100%', maxWidth: 430, minWidth: 300, alignSelf: 'center', gap: 12, padding: 30, borderRadius: 26, borderWidth: 1, borderColor: '#b8c2ff66', backgroundColor: '#171c3bd9', shadowColor: '#02030d', shadowOpacity: 0.5, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 14 }, authEyebrow: { color: '#9eb0ea', fontSize: 10, letterSpacing: 1.8, fontWeight: '700' }, authTitle: { color: '#f8f9ff', fontSize: 30, lineHeight: 36, letterSpacing: -0.8, fontWeight: '700' }, authNote: { color: '#abb7d7', fontSize: 14, lineHeight: 21, marginBottom: 10 }, fieldGroup: { gap: 7 }, fieldLabel: { color: '#e3e8ff', fontSize: 12, fontWeight: '600' }, inputWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: '#121833e8', borderWidth: 1, borderColor: '#68749e', overflow: 'hidden' }, inputIcon: { color: '#9db7ff', fontSize: 18, width: 42, textAlign: 'center' }, input: { flex: 1, minHeight: 52, color: '#f8f9ff', fontSize: 15, paddingVertical: 12, paddingRight: 8 }, passwordToggle: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 }, passwordToggleText: { color: '#9fc3ff', fontSize: 12, fontWeight: '700' }, error: { color: '#ffb4c0', fontSize: 13, lineHeight: 20, paddingVertical: 4 }, submitButton: { minHeight: 54, marginTop: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7260f5', shadowColor: '#7462ff', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, submitText: { color: '#f8f9ff', fontSize: 15, fontWeight: '800' }, loginFooter: { color: '#8693b8', fontSize: 11, paddingVertical: 10, textAlign: 'center' }, topbar: { padding: 16, paddingHorizontal: 24, backgroundColor: d.surface, borderBottomWidth: 1, borderBottomColor: d.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, accountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flex: 1 }, signoutButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, signout: { color: d.body, fontSize: 12 },
});
