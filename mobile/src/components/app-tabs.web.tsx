import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { design as d } from '@/constants/design';

export default function AppTabs({ role }: { role: 'admin' | 'student' }) {
  return <Tabs style={s.root}><TabList style={s.list}>
    <TabTrigger name="home" href="/" asChild><TabButton>Journey</TabButton></TabTrigger>
    <TabTrigger name="jobs" href="/jobs" asChild><TabButton>Job Search</TabButton></TabTrigger>
    <TabTrigger name="market" href="/market" asChild><TabButton>Skill Demand</TabButton></TabTrigger>
    {role === 'student' && <TabTrigger name="resume" href="/resume" asChild><TabButton>Resume</TabButton></TabTrigger>}
    {role === 'student' && <TabTrigger name="linkedin" href="/linkedin" asChild><TabButton>LinkedIn</TabButton></TabTrigger>}
    {role === 'admin' && <TabTrigger name="admin-import" href="/admin-import" asChild><TabButton>Import</TabButton></TabTrigger>}
  </TabList><TabSlot style={s.slot} /></Tabs>;
}
function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return <Pressable {...props} style={({ pressed }) => [s.button, isFocused && s.active, pressed && { opacity: 0.6 }]}><View><Text style={[s.text, isFocused && s.activeText]}>{children}</Text></View></Pressable>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: d.canvas }, slot: { flex: 1 }, list: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: d.border, backgroundColor: d.surface },
  button: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 6 }, active: { backgroundColor: d.elevated, borderBottomWidth: 2, borderBottomColor: d.accent }, text: { color: d.muted, fontSize: 13 }, activeText: { color: d.text },
});
