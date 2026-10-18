import { Link, useGlobalSearchParams, usePathname, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import { ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';
import { resolveFacultySection, type FacultySection } from '@/utils/faculty-navigation';

type NavItem = { href: Href; label: string; paths: string[]; section?: FacultySection };
const navigationChipStyle = (selected: boolean) => StyleSheet.flatten([ui.chip, selected && ui.selected]);
const studentNavigation: NavItem[] = [
  { href: '/', label: 'My Career Plan', paths: ['/'] }, { href: '/resume', label: 'Career Assets', paths: ['/resume', '/linkedin'] },
  { href: '/jobs', label: 'Opportunities', paths: ['/jobs', '/market'] }, { href: '/placement', label: 'Placement Hub', paths: ['/placement'] },
];
const facultyNavigation: NavItem[] = [
  { href: '/admin?section=overview' as Href, label: 'Overview', paths: ['/admin'], section: 'overview' },
  { href: '/admin?section=students' as Href, label: 'Students & Cohorts', paths: ['/admin'], section: 'students' },
  { href: '/admin?section=analytics' as Href, label: 'Skill Analytics', paths: ['/admin'], section: 'analytics' },
  { href: '/admin?section=placement' as Href, label: 'Placement Management', paths: ['/admin'], section: 'placement' },
  { href: '/admin?section=reviews-training' as Href, label: 'Reviews & Training', paths: ['/admin'], section: 'reviews-training' },
  { href: '/admin?section=reports' as Href, label: 'Reports', paths: ['/admin'], section: 'reports' },
];
export function WorkspaceSubNavigation({ group }: { group: 'assets' | 'opportunities' }) {
  const path = usePathname();
  const items = group === 'assets' ? [{ href: '/resume' as Href, label: 'Resume Analyzer' }, { href: '/linkedin' as Href, label: 'LinkedIn Analyzer' }] : [{ href: '/jobs' as Href, label: 'Job Search & Matching' }, { href: '/market' as Href, label: 'Skill-Demand Insights' }];
  return <View style={styles.subnav}>{items.map(item => <Link href={item.href} asChild key={item.label}><Pressable accessibilityRole="link" accessibilityState={{ selected: path === item.href }} style={navigationChipStyle(path === item.href)}><Text style={ui.body}>{item.label}</Text></Pressable></Link>)}</View>;
}

function FacultyMobileNavigation({ activeSection }: { activeSection: FacultySection }) {
  const [open, setOpen] = useState(false);
  const current = facultyNavigation.find(item => item.section === activeSection)!;
  return <View style={styles.mobileFaculty}>
    <Pressable accessibilityRole="button" accessibilityLabel="Faculty sections" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.mobileTrigger}><Text style={ui.body}>Faculty sections: {current.label} ▾</Text></Pressable>
    {open && <View style={styles.mobileMenu}>{facultyNavigation.map(item => <Link href={item.href} asChild key={item.label}><Pressable accessibilityRole="link" accessibilityState={{ selected: item.section === activeSection }} onPress={() => setOpen(false)} style={navigationChipStyle(item.section === activeSection)}><Text style={ui.body}>{item.label}</Text></Pressable></Link>)}</View>}
  </View>;
}
export default function AppNavigation({ role }: { role: 'admin' | 'student' }) {
  const path = usePathname(); const params = useGlobalSearchParams<{ section?: string; student?: string }>(); const { width } = useWindowDimensions();
  const routes = role === 'admin' ? facultyNavigation : studentNavigation;
  const activeFacultySection = resolveFacultySection(params.section, params.student);
  const active = (item: NavItem) => {
    if (!item.paths.includes(path)) return false;
    if (role !== 'admin') return true;
    return item.section === activeFacultySection;
  };
  if (role === 'admin' && width < 900) return <View style={styles.shell}><FacultyMobileNavigation activeSection={activeFacultySection} /></View>;
  return <View style={styles.shell}><ScrollView horizontal showsHorizontalScrollIndicator={role !== 'admin'} contentContainerStyle={styles.routes}>{routes.map(item => <Link href={item.href} asChild key={item.label}><Pressable accessibilityRole="link" accessibilityState={{ selected: active(item) }} style={navigationChipStyle(active(item))}><Text style={ui.body}>{item.label}</Text></Pressable></Link>)}</ScrollView></View>;
}
const styles = StyleSheet.create({ shell: { borderBottomWidth: 1, borderBottomColor: d.border, backgroundColor: d.canvas }, routes: { paddingHorizontal: 12, paddingVertical: 12, gap: 12, alignItems: 'center' }, subnav: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }, mobileFaculty: { padding: 12, gap: 8 }, mobileTrigger: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: d.border, borderRadius: 6, backgroundColor: d.elevated }, mobileMenu: { gap: 8, paddingTop: 4 } });
