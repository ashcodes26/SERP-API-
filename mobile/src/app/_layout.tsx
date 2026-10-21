import { DarkTheme, ThemeProvider, Stack, router, usePathname, useGlobalSearchParams } from 'expo-router';
import '@/global.css';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, session } from '@/api/client';
import { AuthContext } from '@/context/auth';
import { readSession, saveSession } from '@/utils/session-storage';
import { homePath, permittedPath } from '@/utils/role-routing';
import { sessionRestoreAction } from '@/utils/session-restore';
import { design as d } from '@/constants/design';
import { AppShellHeader } from '@/components/app-shell';
import type { AccountOut, AuthSessionOut } from '@/types/contracts';
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const path = usePathname();
  const params = useGlobalSearchParams();
  const initialQuery = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (typeof value === 'string') initialQuery.set(key, value); });
  const intended = useRef(path + (initialQuery.size ? `?${initialQuery}` : ''));
  const [account, setAccount] = useState<AccountOut | null>(null);
  const [opening, setOpening] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const routingPending = useRef(true);
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  useEffect(() => {
    let active = true;
    async function restore() {
      setOpening(true); setError('');
      try {
        const token = await readSession();
        if (token) {
          session.setToken(token);
          const me = await api.me();
          if (active) { session.setStudentId(me.student_id); setAccount(me); }
        } else {
          try {
            const result = await api.demoSession();
            session.setToken(result.access_token);
            const me = await api.me();
            await saveSession(result.access_token);
            if (active) { session.setStudentId(me.student_id); setAccount(me); }
          } catch (err) {
            if (!(err instanceof ApiError && ['DEMO_LOGIN_DISABLED', 'LOCAL_DEMO_ONLY', 'http_404'].includes(err.code))) throw err;
          }
        }
      } catch (err) {
        if (sessionRestoreAction(err instanceof ApiError ? err.status : undefined) === 'clear_session') { session.clear(); await saveSession(null); }
        else if (active) setError(err instanceof Error ? err.message : 'Could not restore session');
      } finally { if (active) setOpening(false); }
    }
    void restore();
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    session.onUnauthorized(() => { intended.current = path; session.clear(); setAccount(null); routingPending.current = true; void saveSession(null); });
    return () => session.onUnauthorized(null);
  }, [path]);
  async function accept(result: AuthSessionOut) {
    session.setToken(result.access_token);
    try {
      const me = await api.me();
      await saveSession(result.access_token);
      session.setStudentId(me.student_id); routingPending.current = true; setAccount(me);
    } catch (err) { session.clear(); throw err; }
  }
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      try { await api.logout(); }
      catch (err) { if (!(err instanceof ApiError && err.status === 401)) throw err; }
      session.clear(); await saveSession(null); setAccount(null); intended.current = '/login'; routingPending.current = true;
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'Could not sign out');
    } finally {
      setLoggingOut(false);
    }
  }
  useEffect(() => {
    if (opening || error) return;
    if (account && (routingPending.current || path === '/login')) {
      const next = permittedPath(account.role, intended.current) ? intended.current : homePath(account.role);
      routingPending.current = false;
      router.replace(next as '/');
    } else if (account && !permittedPath(account.role, path)) router.replace(homePath(account.role) as '/');
  }, [account, opening, path, error]);
  return <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: d.canvas, card: d.surface, border: d.border, primary: d.accent } }}>
    <AuthContext.Provider value={{ account, opening, error, retry: () => setAttempt(x => x+1), accept, logout }}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: d.canvas }}>
        {account && <AppShellHeader username={account.username} role={account.role} loggingOut={loggingOut} onLogout={() => void logout()} />}
        {!!logoutError && <Text accessibilityRole="alert" style={{ color: d.error }}>{logoutError}</Text>}
        {opening ? <View style={{ padding: 32 }}><ActivityIndicator color={d.accent} /></View> : error ? <View style={{ padding: 32, gap: 16 }}><Text accessibilityRole="alert" style={{ color: d.error }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(x => x+1)}><Text style={{ color: d.body }}>Retry session restoration</Text></Pressable></View> : <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!account}><Stack.Screen name="login" /></Stack.Protected>
          <Stack.Protected guard={account?.role === 'student'}>
            <Stack.Screen name="index" /><Stack.Screen name="jobs" /><Stack.Screen name="market" /><Stack.Screen name="resume" /><Stack.Screen name="linkedin" /><Stack.Screen name="placement" />
          </Stack.Protected>
          <Stack.Protected guard={account?.role === 'admin'}><Stack.Screen name="admin" /><Stack.Screen name="admin-import" /></Stack.Protected>
        </Stack>}
      </SafeAreaView>
    </AuthContext.Provider>
  </ThemeProvider>;
}
