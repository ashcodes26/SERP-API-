import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { breakpoints, design as d, layout, radii, spacing as s, typography as t } from '@/constants/design';
import { SafeAreaView } from 'react-native-safe-area-context';

export function useScreenLayout() {
  const { width } = useWindowDimensions();
  return { width, desktop: width >= breakpoints.desktop, tablet: width >= breakpoints.tablet, gutter: width < breakpoints.tablet ? s.medium : s.four };
}

export function WorkspacePage({ children, maxWidth = layout.workspace }: { children: ReactNode; maxWidth?: number }) {
  const { gutter } = useScreenLayout();
  return <SafeAreaView edges={['bottom']} style={page.screen}><ScrollView style={page.screen} contentContainerStyle={[page.content, { maxWidth, paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>;
}

export function PageHeading({ title, description, eyebrow }: { title: string; description?: string; eyebrow?: string }) {
  const { tablet } = useScreenLayout();
  return <View style={{ gap: s.two }}>{eyebrow && <Text style={page.eyebrow}>{eyebrow}</Text>}<Text accessibilityRole="header" style={[page.title, !tablet && t.titleMobile]}>{title}</Text>{description && <Text style={page.body}>{description}</Text>}</View>;
}

export function StatusTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'error' }) {
  const color = { neutral: d.muted, accent: d.text, success: d.successText, warning: d.highlight, error: d.error }[tone];
  return <View style={[page.tag, tone === 'accent' && { borderColor: d.accent }]}><Text style={[page.caption, { color }]}>{children}</Text></View>;
}

export function SectionHeading({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return <View style={page.sectionHeader}><View style={{ flex: 1, minWidth: 160, gap: s.one }}><Text accessibilityRole="header" style={page.heading}>{title}</Text>{description && <Text style={page.caption}>{description}</Text>}</View>{aside}</View>;
}

export function AdaptiveColumns({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { desktop } = useScreenLayout();
  return <View style={[{ flexDirection: desktop ? 'row' : 'column', alignItems: 'stretch', gap: s.four }, style]}>{children}</View>;
}

export const page = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, content: { paddingTop: s.five, paddingBottom: s.shelf, width: '100%', alignSelf: 'center', gap: s.four },
  title: { ...t.title, color: d.text }, heading: { ...t.heading, color: d.text }, body: { ...t.body, color: d.body }, caption: { ...t.caption, color: d.muted }, eyebrow: { ...t.kicker, color: d.muted },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: s.two },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: d.strongBorder, borderRadius: radii.pill, backgroundColor: d.higher, paddingHorizontal: 10, paddingVertical: 2 },
  notice: { backgroundColor: d.higher, padding: s.medium, borderWidth: 1, borderColor: d.strongBorder, borderLeftWidth: 3, borderLeftColor: d.accent, borderRadius: radii.control, gap: s.one },
  column: { flex: 1, minWidth: 0, gap: s.four }, metric: { flex: 1, minWidth: 150, backgroundColor: d.higher, padding: s.medium, gap: s.two, borderRadius: radii.control, borderWidth: 1, borderColor: d.border },
});
