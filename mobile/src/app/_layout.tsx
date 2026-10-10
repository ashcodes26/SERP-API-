import { DarkTheme, ThemeProvider } from 'expo-router';
import '@/global.css';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { api, session } from '@/api/client';
import { design as d } from '@/constants/design';
import AppTabs from '@/components/app-tabs';

void SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const [principal, setPrincipal] = useState<'admin' | 'student' | null>(null);
  const [username, setUsername] = useState('demo');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  function logout() { session.clear(); setPrincipal(null); setPassword(''); setError(''); }
  return <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: d.canvas, card: d.surface, border: d.border, primary: d.accent } }}>
    <StatusBar style="light" />
    {!principal ? <SafeAreaView style={s.shell}><KeyboardAvoidingView style={s.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.brandRow}><Text style={s.mark}>S</Text><Text style={s.brand}>skillup</Text><Text style={s.badge}>CAREER WORKSPACE</Text></View>
        <View nativeID="skillup-login-grid" style={[s.grid, width >= 900 && s.wide]}>
          <View style={s.story}><Text style={s.eyebrow}>EVIDENCE. DIRECTION. PROGRESS.</Text><Text nativeID="skillup-login-headline" style={[s.hero, width >= 900 && s.heroWide]}>Your next chapter.{'\n'}Built with intention.</Text>
            <View>{[['01', 'Understand your strengths'], ['02', 'Build a focused learning plan'], ['03', 'Practice. Reflect. Progress.']].map(([n, title]) => <View style={s.journeyRow} key={n}><Text style={s.number}>{n}</Text><Text style={s.journeyText}>{title}</Text></View>)}</View>
          </View>
          <View style={s.card}><Text style={s.eyebrow}>WELCOME BACK</Text><Text style={s.heading}>Enter your workspace</Text><Text style={s.note}>Sign in to continue your learning journey.</Text>
            <Text style={s.label}>Username</Text><TextInput accessibilityLabel="Username" autoCapitalize="none" autoCorrect={false} editable={!busy} value={username} onChangeText={setUsername} placeholder="demo or admin" placeholderTextColor={d.muted} style={s.input} />
            <Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" editable={!busy} value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={d.muted} secureTextEntry onSubmitEditing={() => void login()} style={s.input} />
            {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void login()} style={({ pressed }) => [s.button, (pressed || busy) && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color={d.canvas} /> : <Text style={s.buttonText}>Continue to Skillup →</Text>}</Pressable>
          </View>
        </View><Text style={s.footer}>Skillup / A little more clarity. A lot more possibility.</Text>
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView> : <SafeAreaView edges={['top']} style={s.shell}>
      <View style={s.topbar}><View style={s.brandRow}><Text style={s.mark}>S</Text><Text style={s.brand}>skillup</Text></View><View style={s.accountRow}><Text style={s.badge}>{principal === 'admin' ? 'ADMIN' : 'STUDENT'} / DEMO</Text><Pressable accessibilityRole="button" onPress={logout} style={s.signoutButton}><Text style={s.signout}>Sign out ↗</Text></Pressable></View></View>
      <AppTabs role={principal} />
    </SafeAreaView>}
  </ThemeProvider>;
}
const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: d.canvas }, page: { flexGrow: 1, padding: 24, gap: 48, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, mark: { width: 30, height: 30, textAlign: 'center', lineHeight: 30, borderWidth: 1, borderColor: d.strongBorder, borderRadius: 6, color: d.text, fontSize: 17, fontWeight: '500' }, brand: { color: d.text, fontSize: 22, fontWeight: '500', letterSpacing: -0.7 }, badge: { color: d.muted, fontSize: 10, letterSpacing: 1.2 },
  grid: { gap: 40, flex: 1, justifyContent: 'center' }, wide: { flexDirection: 'row', alignItems: 'center', gap: 80 }, story: { flex: 1, gap: 24 }, eyebrow: { fontSize: 11, letterSpacing: 1.8, color: d.muted }, hero: { fontSize: 42, lineHeight: 46, fontWeight: '500', letterSpacing: -1.2, color: d.text }, heroWide: { fontSize: 64, lineHeight: 66, letterSpacing: -1.4 },
  journeyRow: { flexDirection: 'row', gap: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: d.border }, number: { color: d.muted, fontSize: 12 }, journeyText: { color: d.body, fontSize: 14 },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: d.surface, padding: 28, borderRadius: 12, borderWidth: 1, borderColor: d.border, gap: 12 }, heading: { fontSize: 26, color: d.text, fontWeight: '500', letterSpacing: -0.6 }, note: { color: d.body, fontSize: 13, lineHeight: 21 }, label: { color: d.body, fontSize: 12, marginTop: 12 }, input: { padding: 14, minHeight: 48, borderRadius: 6, backgroundColor: d.elevated, borderWidth: 1, borderColor: d.strongBorder, color: d.text },
  button: { backgroundColor: d.accent, borderRadius: 6, padding: 16, minHeight: 48, alignItems: 'center', marginTop: 12 }, buttonText: { color: d.canvas, fontWeight: '500', fontSize: 14 }, error: { color: d.error, lineHeight: 20 },  footer: { color: d.muted, fontSize: 11, paddingVertical: 16 },
  topbar: { padding: 16, paddingHorizontal: 24, backgroundColor: d.surface, borderBottomWidth: 1, borderBottomColor: d.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, accountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flex: 1 }, signoutButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, signout: { color: d.body, fontSize: 12 },
});

