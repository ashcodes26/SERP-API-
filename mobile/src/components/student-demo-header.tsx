import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, ScrollView, Pressable, Text, View } from 'react-native';
import { careerApi } from '@/api/client';
import { StatStrip } from '@/components/analytics';
import { cp } from '@/components/career-plan-design';
import { ui } from '@/components/career-ui';
import type { StudentDemoOut, StudentDemoSection } from '@/types/contracts';

export function StudentDemoHeader({ section, children, toolbar = false }: { section: StudentDemoSection; children?: ReactNode; toolbar?: boolean }) {
  const [demo, setDemo] = useState<StudentDemoOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const lock = useRef(false);
  useEffect(() => () => { request.current += 1; }, []);

  async function loadDemo() {
    if (lock.current) return;
    lock.current = true;
    const current = ++request.current;
    setBusy(true); setError('');
    try {
      const result = await careerApi.demo(section);
      if (current === request.current) setDemo(result);
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : 'Could not load demo records.');
    } finally {
      if (current === request.current) { setBusy(false); lock.current = false; }
    }
  }

  const content = <View style={{ gap: 20 }}>
    {!toolbar && <View style={[ui.row, { alignItems: 'flex-start', justifyContent: 'space-between' }]}>
      <View style={{ flex: 1, minWidth: 180 }}>{children}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Load demo records" accessibilityState={{ disabled: busy, busy, expanded: !!demo }} disabled={busy} onPress={() => void loadDemo()} style={({ pressed }) => [ui.secondary, { minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: busy || pressed ? 0.5 : 1 }]}>
        {busy ? <ActivityIndicator accessibilityLabel="Loading demo records" /> : <Text style={[ui.body, { fontSize: 13 }]}>Demo</Text>}
      </Pressable>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {demo && <View style={[ui.chip, { gap: 20, padding: 20 }]}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1, minWidth: 180, gap: 6 }}><Text style={ui.heading}>{demo.title}</Text><Text style={ui.muted}>Demo fixture · fictional records · read only</Text></View>
        <Pressable accessibilityRole="button" onPress={() => setDemo(null)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={ui.body}>Close demo</Text></Pressable>
      </View>
      <StatStrip items={demo.metrics} />
      {demo.records.map(record => <View key={record.title} style={ui.divider}>
        <Text style={ui.body}>{record.title}</Text>
        {Object.entries(record.fields).map(([label, value]) => <View key={label} style={{ gap: 4 }}><Text style={ui.muted}>{label}</Text><Text selectable style={ui.body}>{value}</Text></View>)}
      </View>)}
    </View>}
  </View>;
  if (toolbar) return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Load demo records" accessibilityState={{ disabled: busy, busy, expanded: !!demo }} disabled={busy} onPress={() => void loadDemo()} style={{ minHeight: 36, borderWidth: 1, borderColor: '#363639', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, justifyContent: 'center', backgroundColor: '#16161a' }}><Text style={[cp.label, { color: '#bdbdbd' }]}>{busy ? 'Loading…' : <><Text style={{ color: '#ffb829' }}>●</Text> Demo Mode</>}</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <Modal visible={!!demo} transparent onRequestClose={() => setDemo(null)} animationType="fade"><View style={{ flex: 1, padding: 24, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 760, maxHeight: '90%', alignSelf: 'center', backgroundColor: '#0d0d0f', borderRadius: 8, padding: 16 }}><ScrollView>{content}</ScrollView></View></View></Modal>
  </>;
  return content;
}
