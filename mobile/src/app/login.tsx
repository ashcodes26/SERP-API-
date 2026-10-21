import { useState } from 'react';
import { View, Text, Pressable, Platform, useWindowDimensions } from 'react-native';
import { api } from '@/api/client';
import { useAuth } from '@/context/auth';
import { design as d } from '@/constants/design';
import { AuthButton, AuthField, AuthIcon, AuthLayout, AuthSandbox, AuthTabs, auth } from '@/components/auth-ui';

export default function Login() {
  const { width } = useWindowDimensions();
  const { accept } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [details, setDetails] = useState({ student_id: '', name: '', email: '', department: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = signup ? await api.signup({ username, password, ...details }) : await api.login(username.trim(), password); await accept(result); setPassword(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in unsuccessful'); }
    finally { setBusy(false); }
  }
  async function openDemo() {
    if (busy) return;
    setBusy(true); setError('');
    try { await accept(await api.demoSession()); setPassword(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Student demo unavailable'); }
    finally { setBusy(false); }
  }
  const usernameField = <AuthField label="Username" compact={signup} autoCapitalize="none" autoCorrect={false} editable={!busy} value={username} onChangeText={setUsername} maxLength={120} placeholder={signup ? 'Choose a username' : 'Enter your registered username'} helper={signup ? undefined : 'Use the username registered with your account.'} />;
  return <AuthLayout>
    <AuthTabs signup={signup} busy={busy} onChange={value => { setSignup(value); setError(''); }} />
    <View style={auth.notice}><AuthIcon name="route" color={d.info} /><Text style={auth.noticeText}><Text style={auth.noticeStrong}>Role-aware routing: </Text>Students open My Career Plan (/). Placement faculty open the Faculty Console (/admin). Faculty accounts are provisioned by an administrator.</Text></View>
    <View style={[auth.fields, signup && { gap: 12 }]}>
      {signup ? <>
        <View style={[auth.notice, { padding: 8, gap: 6 }]}><AuthIcon name="info" size={16} color={d.highlight} /><Text style={auth.noticeText}>Student registration only. Imported accounts must be activated by your institution.</Text></View>
        {([['student_id', 'Student ID', 'Your institution-issued student ID'], ['name', 'Full name', 'Your full name'], ['email', 'Email', 'Your email address'], ['department', 'Department', 'Your department']] as const).map(([key, label, placeholder]) => <AuthField key={key} label={label} compact editable={!busy} autoCapitalize={key === 'email' ? 'none' : 'words'} keyboardType={key === 'email' ? 'email-address' : 'default'} value={details[key]} onChangeText={value => setDetails(x => ({ ...x, [key]: value }))} placeholder={placeholder} />)}
        {usernameField}
      </> : usernameField}
      <AuthField label={signup ? 'Create password' : 'Password'} accessibilityLabel="Password" compact={signup} editable={!busy} value={password} onChangeText={setPassword} maxLength={256} secureTextEntry={!showPassword} onSubmitEditing={() => void submit()} placeholder="••••••••••••" helper={signup ? 'Use at least 12 characters.' : 'Enter your existing account password.'} aside={<Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => setShowPassword(value => !value)} hitSlop={8} style={[auth.show, (Platform.OS !== 'web' || width < 768) && { minHeight: 44 }]}><AuthIcon name="eye" size={15} color={d.muted} /><Text style={auth.caption}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable>} />
      {!signup && <View style={auth.session}><AuthIcon name="shield" color={d.muted} size={16} /><Text style={[auth.caption, auth.flex]}>{Platform.OS === 'web' ? 'Session stored per browser tab on this device.' : 'Session stored securely on this device.'}</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={auth.error}>{error}</Text>}
      <AuthButton busy={busy} disabled={!username.trim() || !password || (signup && (password.length < 12 || !details.student_id.trim() || !details.name.trim() || !details.email.trim() || !details.department.trim()))} onPress={() => void submit()} icon={signup ? 'add' : 'lock'}>{signup ? 'Register student account' : 'Sign in to Skillup'}</AuthButton>
    </View>
    <AuthSandbox busy={busy} onDemo={() => void openDemo()} />
  </AuthLayout>;
}

