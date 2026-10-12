import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { useAuth } from '@/context/auth';
import { design as d } from '@/constants/design';

export default function Login() {
  const { width } = useWindowDimensions();
  const { accept } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [details, setDetails] = useState({ student_id: '', name: '', email: '', department: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = signup ? await api.signup({ username, password, ...details }) : await api.login(username.trim(), password); await accept(result); setPassword(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in unsuccessful'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.shell}><KeyboardAvoidingView style={s.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <View style={s.brandRow}><Text style={s.mark}>S</Text><Text style={s.brand}>skillup</Text><Text style={s.badge}>WORKSPACE</Text></View>
    <View style={[s.grid, width >= 900 && s.wide]}><View style={s.story}><Text style={s.eyebrow}>SKILLUP</Text><Text style={[s.hero, width >= 900 && s.heroWide]}>Your next move.{'\n'}Starts here.</Text><Text style={s.note}>One sign-in for students and placement faculty.</Text></View>
      <View style={s.card}><Text style={s.eyebrow}>WELCOME</Text><Text style={s.heading}>{signup ? 'Student signup' : 'Sign in'}</Text>
        <Text style={s.label}>Username</Text><TextInput accessibilityLabel="Username" autoCapitalize="none" autoCorrect={false} editable={!busy} value={username} onChangeText={setUsername} style={s.input} />
        <Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" editable={!busy} value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={() => void submit()} style={s.input} />
        {signup && <><Text style={s.note}>Use at least 12 characters. Imported accounts are activated by faculty through the local setup command.</Text>{(['student_id', 'name', 'email', 'department'] as const).map(key => <View key={key}><Text style={s.label}>{key.replace('_', ' ')}</Text><TextInput accessibilityLabel={key} style={s.input} value={details[key]} onChangeText={value => setDetails(x => ({ ...x, [key]: value }))} /></View>)}</>}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={s.button}>{busy ? <ActivityIndicator color={d.text} /> : <Text style={s.buttonText}>{signup ? 'Create student account' : 'Sign in'}</Text>}</Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setSignup(x => !x); setError(''); }} style={s.signoutButton}><Text style={s.note}>{signup ? 'Back to sign in' : 'Create student account'}</Text></Pressable>
      </View>
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  opening: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  shell: { flex: 1, backgroundColor: d.canvas }, page: { flexGrow: 1, padding: 24, gap: 48, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, mark: { width: 30, height: 30, textAlign: 'center', lineHeight: 30, borderWidth: 1, borderColor: d.strongBorder, borderRadius: 6, color: d.accent, fontSize: 17, fontWeight: '500' }, brand: { color: d.text, fontSize: 22, fontWeight: '500', letterSpacing: -0.7 }, badge: { color: d.muted, fontSize: 10, letterSpacing: 1.2 },
  grid: { gap: 40, flex: 1, justifyContent: 'center' }, wide: { flexDirection: 'row', alignItems: 'center', gap: 80 }, story: { flex: 1, gap: 24 }, eyebrow: { fontSize: 11, letterSpacing: 1.8, color: d.muted }, hero: { fontSize: 42, lineHeight: 46, fontWeight: '500', letterSpacing: -1.2, color: d.text }, heroWide: { fontSize: 78, lineHeight: 86, letterSpacing: -1.4 },
  journeyRow: { flexDirection: 'row', gap: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: d.border }, number: { color: d.muted, fontSize: 12 }, journeyText: { color: d.body, fontSize: 14 },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: d.surface, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: d.border, gap: 12 }, heading: { fontSize: 26, color: d.text, fontWeight: '500', letterSpacing: -0.6 }, note: { color: d.body, fontSize: 13, lineHeight: 21 }, label: { color: d.body, fontSize: 12, marginTop: 12 }, input: { padding: 14, minHeight: 48, borderRadius: 6, backgroundColor: d.elevated, borderWidth: 1, borderColor: d.strongBorder, color: d.text },
  button: { backgroundColor: d.accent, borderRadius: 24, padding: 16, minHeight: 48, alignItems: 'center', marginTop: 12 }, buttonText: { color: d.text, fontWeight: '500', fontSize: 14 }, error: { color: d.error, lineHeight: 20 },  footer: { color: d.muted, fontSize: 11, paddingVertical: 16 },
  topbar: { padding: 16, paddingHorizontal: 24, backgroundColor: d.surface, borderBottomWidth: 1, borderBottomColor: d.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, accountRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flex: 1 }, signoutButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, signout: { color: d.body, fontSize: 12 },
});

