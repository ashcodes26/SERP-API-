import { Link, useGlobalSearchParams, usePathname, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import { ui } from '@/components/career-ui';
import { breakpoints, design as d, spacing as s, sizes, radii, typography as t } from '@/constants/design';
import { resolveFacultySection, type FacultySection } from '@/utils/faculty-navigation';

type NavItem = { href: Href; label: string; paths: string[]; section?: FacultySection };
const navigationChipStyle = (selected: boolean) => StyleSheet.flatten([ui.chip, { justifyContent: 'center' as const }, selected && ui.selected]);
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
  { href: '/admin-import', label: 'Import', paths: ['/admin-import'] },
];
export function WorkspaceSubNavigation({ group }: { group: 'assets' | 'opportunities' }) {
  const path = usePathname();
  const items = group === 'assets' ? [{ href: '/resume' as Href, label: 'Resume Analyzer' }, { href: '/linkedin' as Href, label: 'LinkedIn Analyzer' }] : [{ href: '/jobs' as Href, label: 'Job Search & Matching' }, { href: '/market' as Href, label: 'Skill-Demand Insights' }];
  return <View style={styles.subnav}>{items.map(item => <Link href={item.href} asChild key={item.label}><Pressable accessibilityRole="link" accessibilityState={{ selected: path === item.href }} style={navigationChipStyle(path === item.href)}><Text style={ui.body}>{item.label}</Text></Pressable></Link>)}</View>;
}

function FacultyMobileNavigation({ activeSection, path }: { activeSection: FacultySection; path: string }) {
  const [open, setOpen] = useState(false);
  const selected = (item: NavItem) => path === '/admin-import' ? item.href === '/admin-import' : item.section === activeSection;
  const current = facultyNavigation.find(selected)!;
  return <View style={styles.mobileFaculty}>
    <Pressable accessibilityRole="button" accessibilityLabel="Faculty sections" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.mobileTrigger}><Text style={ui.body}>Faculty sections: {current.label} ▾</Text></Pressable>
    {open && <View style={styles.mobileMenu}>{facultyNavigation.map(item => <Link href={item.href} asChild key={item.label}><Pressable accessibilityRole="link" accessibilityState={{ selected: selected(item) }} onPress={() => setOpen(false)} style={navigationChipStyle(selected(item))}><Text style={ui.body}>{item.label}</Text></Pressable></Link>)}</View>}
  </View>;
}
export default function AppNavigation({ role, embedded = false }: { role: 'admin' | 'student'; embedded?: boolean }) {
  const path = usePathname(); const params = useGlobalSearchParams<{ section?: string; student?: string }>(); const { width } = useWindowDimensions();
  const routes = role === 'admin' ? facultyNavigation : studentNavigation;
  const activeFacultySection = resolveFacultySection(params.section, params.student);
  const active = (item: NavItem) => {
    if (!item.paths.includes(path)) return false;
    if (role !== 'admin') return true;
    if (path === '/admin-import') return true;
    return item.section === activeFacultySection;
  };
  if (role === 'admin' && width < breakpoints.desktop) return <View style={styles.shell}><FacultyMobileNavigation activeSection={activeFacultySection} path={path} /></View>;
  return <View style={styles.shell}><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={[styles.routes, embedded && { padding: 0 }]}>{routes.map(item => <Link href={item.href} asChild key={item.label}><Pressable accessibilityRole="link" accessibilityState={{ selected: active(item) }} style={navigationChipStyle(active(item))}><Text style={[styles.link, active(item) && { color: d.text }]}>{item.label}</Text></Pressable></Link>)}</ScrollView></View>;
}
const styles = StyleSheet.create({ shell: { backgroundColor: d.canvas }, routes: { padding: s.two, gap: s.one, alignItems: 'center' }, link: { ...t.compact, color: d.body }, subnav: { flexDirection: 'row', flexWrap: 'wrap', gap: s.two, alignItems: 'center' }, mobileFaculty: { padding: s.two, gap: s.one }, mobileTrigger: { minHeight: sizes.compactControl, paddingHorizontal: s.two, justifyContent: 'center', borderWidth: 1, borderColor: d.strongBorder, borderRadius: radii.control, backgroundColor: d.higher }, mobileMenu: { gap: s.one, paddingTop: s.one } });
