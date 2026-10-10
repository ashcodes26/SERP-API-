import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { design as d } from '@/constants/design';
const steps = [
  ['01', 'Start with evidence.', 'Review the synthetic student profile, documented competencies, and the seeded target role.', 'PROFILE'],
  ['02', 'Find your focus.', 'Compare your evidence with role requirements. Explore skill gaps, confidence, and the reasons behind your alignment.', 'ANALYSIS'],
  ['03', 'Make the next move.', 'Follow a prioritized learning roadmap. Every resource identifies live SerpApi discovery or a curated fallback.', 'ROADMAP'],
  ['04', 'Put it into practice.', 'Complete a SQL, Python, or Docker assessment. Your answers are scored by the backend and become new evidence.', 'ASSESSMENT'],
  ['05', 'See what changed.', 'Review refreshed readiness, then reanalyze the role to build a roadmap around your updated skills.', 'PROGRESS'],
];
export default function Explore() {
  return <SafeAreaView edges={['bottom']} style={s.screen}><ScrollView contentContainerStyle={s.wrap}>
    <Text style={s.eyebrow}>THE AIMORA GUIDE</Text><Text style={s.title}>Clarity, one step at a time.</Text>
    <Text style={s.intro}>A focused loop for turning career evidence into deliberate progress.</Text>
    {steps.map(([number, title, body, label]) => <View key={number} style={s.card}><View style={s.cardTop}><Text style={s.number}>{number}</Text><Text style={s.label}>{label}</Text></View><Text style={s.cardTitle}>{title}</Text><Text style={s.body}>{body}</Text></View>)}
    <Link href="/" style={s.link}>Open your journey →</Link>
    <View style={s.notice}><Text style={s.noticeTitle}>A workspace for exploration</Text><Text style={s.body}>This local prototype uses synthetic records and authenticated demo accounts. Admins can import CSV/XLSX records in the Import tab. A reachable backend is required.</Text><Text style={s.body}>Readiness describes role alignment from current evidence. It does not predict employment or placement.</Text></View>
    <Text style={s.footer}>AIMORA / Learn deliberately. Grow measurably.</Text>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, wrap: { padding: 24, paddingTop: 36, paddingBottom: 48, gap: 20, maxWidth: 880, width: '100%', alignSelf: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: d.muted }, title: { fontSize: 42, lineHeight: 48, letterSpacing: -1, fontWeight: '500', color: d.text }, intro: { fontSize: 16, color: d.muted, lineHeight: 26, marginBottom: 20 },
  card: { borderRadius: 12, padding: 24, backgroundColor: d.surface, borderColor: d.border, borderWidth: 1, gap: 16 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, number: { color: d.muted, fontSize: 13 }, label: { color: d.muted, fontSize: 10, letterSpacing: 1.4, padding: 6, backgroundColor: d.elevated, borderRadius: 4 }, cardTitle: { fontSize: 24, fontWeight: '500', letterSpacing: -0.3, color: d.text }, body: { fontSize: 14, lineHeight: 23, color: d.body }, link: { color: d.canvas, backgroundColor: d.accent, padding: 16, borderRadius: 6, textAlign: 'center', fontWeight: '500', fontSize: 14 },
  notice: { borderTopWidth: 1, borderTopColor: d.border, marginTop: 20, paddingTop: 24, gap: 12 }, noticeTitle: { color: d.text, fontSize: 16, fontWeight: '500' }, footer: { color: d.muted, fontSize: 11, marginTop: 20 },
});

