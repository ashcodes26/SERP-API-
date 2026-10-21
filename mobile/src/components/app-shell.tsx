import { Link, usePathname } from 'expo-router';
import { StudentDemoHeader } from '@/components/student-demo-header';
import { cp, PlanAction, PlanMark } from '@/components/career-plan-design';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AppNavigation from '@/components/app-navigation';
import { Action } from '@/components/career-ui';
import { breakpoints, design as d, layout, spacing as s, typography as t } from '@/constants/design';

/** Presentation only: the root layout owns authentication, sessions and logout. */
export function AppShellHeader({ username, role, loggingOut, onLogout }: {
  username: string; role: 'admin' | 'student'; loggingOut: boolean; onLogout: () => void;
}) {
  const path = usePathname();
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.wideShell;
  if (role === 'student' && (path === '/' || path === '/resume')) return <View style={{ backgroundColor: d.elevated, borderBottomWidth: 1, borderBottomColor: d.border }}>
    <View style={{ maxWidth: 960, width: '100%', alignSelf: 'center', minHeight: 64, paddingHorizontal: width < 768 ? 16 : 24, flexDirection: 'row', alignItems: 'center', gap: path === '/resume' && width < 768 ? 8 : 24, flexWrap: width < 768 ? 'wrap' : 'nowrap', paddingVertical: width < 768 ? 8 : 0 }}>
      <View style={[cp.row, { gap: 6 }]}><PlanMark /><Text style={[cp.strong, { letterSpacing: -0.5 }]}>Skillup</Text></View>
      {width >= 768 && <View style={{ flex: 1, minWidth: 0 }}><CareerNavigation activePath={path} /></View>}
      <View style={[cp.row, { marginLeft: 'auto', gap: path === '/resume' && width < 768 ? 8 : 12 }]}>
        <StudentDemoHeader section={path === '/resume' ? 'resume' : 'journey'} toolbar />
        <Text numberOfLines={2} style={[cp.small, { maxWidth: 90, textAlign: 'right', color: d.text }]}>{username}{'\n'}Student</Text>
        {width >= 1024 && <View style={{ width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#cdbdff' }}><PlanMark avatar /></View>}
        <PlanAction secondary disabled={loggingOut} onPress={onLogout}>{loggingOut ? 'Logging out…' : 'Log out'}</PlanAction>
      </View>
      {width < 768 && <View style={{ width: '100%' }}><CareerNavigation activePath={path} /></View>}
    </View>
  </View>;
  return <View style={styles.shell}>
    <View style={[styles.header, { paddingHorizontal: width < breakpoints.tablet ? s.medium : s.four }]}>
      <Text style={styles.brand}>skillup</Text>
      {wide && <View style={styles.navigation}><AppNavigation role={role} embedded /></View>}
      <View style={styles.account}>
        <Text numberOfLines={2} style={styles.identity}>{username} / {role.toUpperCase()}</Text>
        <Action secondary compact busy={loggingOut} accessibilityLabel="Log out" onPress={onLogout}>{loggingOut ? 'Logging out…' : 'Log out'}</Action>
      </View>
    </View>
    {!wide && <AppNavigation role={role} />}
  </View>;
}

const styles = StyleSheet.create({
  shell: { backgroundColor: d.canvas, borderBottomWidth: 1, borderBottomColor: d.border },
  header: { width: '100%', maxWidth: layout.workspace + s.shelf, alignSelf: 'center', paddingVertical: s.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.medium },
  brand: { ...t.heading, color: d.text, letterSpacing: -1 },
  navigation: { flex: 1, minWidth: 0 },
  account: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: s.two, flexShrink: 1, minWidth: 0 },
  identity: { ...t.caption, color: d.muted, flexShrink: 1, textAlign: 'right' },
});

function CareerNavigation({ activePath = '/' }: { activePath?: string }) {
  const { width } = useWindowDimensions();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between', gap: activePath === '/resume' && width < 768 ? 8 : 16 }}>{[
    ['/', 'My Career Plan'], ['/resume', 'Career Assets'], ['/jobs', 'Opportunities'], ['/placement', 'Placement Hub'],
  ].map(([href, label]) => <Link key={href} href={href as '/' | '/resume' | '/jobs' | '/placement'} asChild><Pressable accessibilityRole="link" aria-current={href === activePath ? 'page' : undefined} accessibilityState={{ selected: href === activePath }} style={{ minHeight: width < 768 ? 44 : 64, minWidth: width < 768 ? activePath === '/resume' ? 0 : 90 : undefined, width: width < 768 && activePath === '/resume' ? (width - 56) / 4 : undefined, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: href === activePath ? d.accent : 'transparent', flexShrink: 1 }}><Text style={[href === activePath ? cp.strong : cp.body, { color: href === activePath ? d.text : d.body, fontSize: activePath === '/resume' && width < 768 ? 12 : href === activePath && activePath === '/' ? 16 : 14, fontWeight: href === activePath ? '600' : '400', maxWidth: activePath === '/resume' && width < 768 ? '100%' : 100 }]}>{label}</Text></Pressable></Link>)}</ScrollView>;
}
