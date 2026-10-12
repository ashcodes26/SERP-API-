import { Link, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';

export default function AppNavigation({ role }: { role: 'admin' | 'student' }) {
  const path = usePathname();
  const routes = role === 'admin' ? [['/admin', 'Faculty dashboard'], ['/admin-import', 'Student import']] : [['/', 'Journey'], ['/jobs', 'Job Search'], ['/market', 'Skill Demand'], ['/resume', 'Resume'], ['/linkedin', 'LinkedIn'], ['/placement', 'Placement']];
  return <View style={[ui.row, { padding: 12, borderBottomWidth: 1, borderBottomColor: d.border }]}>{routes.map(([href, label]) => <Link href={href as Href} asChild key={href}><Pressable accessibilityRole="link" style={StyleSheet.flatten([ui.chip, path === href && ui.selected])}><Text style={ui.body}>{label}</Text></Pressable></Link>)}</View>;
}
