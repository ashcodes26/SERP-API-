import { BarChart, StatStrip } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { importApi, type ImportSummary, type ImportUpload } from '@/api/client';

const fields = ['student_id', 'name', 'first_name', 'last_name', 'email', 'department', 'program', 'specialization', 'semester', 'cgpa', 'graduation_year'];
export default function AdminImport() {
  const [uploaded, setUploaded] = useState<ImportUpload | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Import request failed'); }
    finally { setBusy(false); }
  }
  const pick = () => perform(async () => {
    const selection = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], copyToCacheDirectory: true });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (!/\.(csv|xlsx)$/i.test(asset.name)) { setError('Choose a .csv or .xlsx file.'); return; }
    setUploaded(null); setMapping({}); setResult(null); setEditing(null);
    const response = await importApi.upload(asset);
    setUploaded(response); setMapping(response.suggested_mapping);
  });
  return <SafeAreaView edges={['bottom']} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>ADMIN</Text>
    <Text style={styles.title}>Student import</Text><View style={styles.steps}><Text style={styles.step}>01 / Upload</Text><Text style={styles.step}>02 / Map columns</Text><Text style={styles.step}>03 / Review & import</Text></View>

    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={pick} style={[uploaded ? styles.secondary : styles.primary, busy && { opacity: 0.5 }]}><Text style={uploaded ? styles.field : styles.primaryText}>{uploaded ? 'Choose another file' : 'Choose CSV / XLSX'}</Text></Pressable>
    {uploaded && <View style={styles.card}><Text style={styles.heading}>{uploaded.total_rows} rows · {uploaded.headers.length} columns</Text><Text style={styles.note}>{uploaded.headers.join(', ')}</Text>
      <Text style={styles.heading}>Column mapping</Text>
      {uploaded.headers.map(header => <View key={header} style={styles.mapping}><Text style={styles.field}>{header}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(editing === header ? null : header)} style={styles.chip}><Text style={styles.chipText}>{mapping[header] ?? 'Ignore'} ▾</Text></Pressable>
        {editing === header && <View style={styles.options}>{['', ...fields].map(field => <Pressable accessibilityRole="button" key={field} disabled={busy} onPress={() => { setMapping(previous => { const next = { ...previous }; delete next[header]; for (const key of Object.keys(next)) if (next[key] === field) delete next[key]; if (field) next[header] = field; return next; }); setEditing(null); setResult(null); }} style={styles.option}><Text style={styles.field}>{field || 'Ignore'}</Text></Pressable>)}</View>}
      </View>)}
      <Pressable accessibilityRole="button" disabled={busy} style={[result ? styles.secondary : styles.primary, busy && { opacity: 0.5 }]} onPress={() => perform(async () => setResult(await importApi.preview(uploaded.job_id, mapping)))}><Text style={result ? styles.field : styles.primaryText}>Validate and preview</Text></Pressable>
    </View>}
    {result && <View style={styles.card}><Text style={styles.heading}>Import status: {result.job.status.replaceAll('_', ' ')}</Text>
      <StatStrip items={[{ label: "Valid", value: result.job.valid_rows }, { label: "Duplicates", value: result.job.duplicate_rows }, { label: "Errors", value: result.job.error_rows }, { label: "Imported", value: result.job.imported_rows }]} /><BarChart max={Math.max(1, result.job.valid_rows, result.job.duplicate_rows, result.job.error_rows, result.job.imported_rows)} unit=" rows" rows={[{ label: "Valid", value: result.job.valid_rows }, { label: "Errors", value: result.job.error_rows, color: d.error }, { label: "Imported", value: result.job.imported_rows, color: d.success }]} />
      {result.issues.slice(0, 100).map((issue, index) => <Text style={styles.issue} key={`${issue.row_number}-${issue.field}-${index}`}>Row {issue.row_number}: {issue.issue_code} — {issue.message}</Text>)}
      {result.issues.length > 100 && <Text style={styles.note}>Showing first 100 issues of {result.issues.length}.</Text>}
      {result.job.status === 'validated' && <><Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => perform(async () => setResult(await importApi.confirm(result.job.id)))}><Text style={styles.primaryText}>Import valid rows (skip duplicates)</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => perform(async () => setResult(await importApi.confirm(result.job.id, true)))}><Text style={styles.field}>Import and update matching synthetic records</Text></Pressable></>}
      {result.job.status.startsWith('completed') && <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => perform(async () => setResult(await importApi.retry(result.job.id)))}><Text style={styles.field}>Revalidate remaining rows</Text></Pressable>}
    </View>}
    {busy && <ActivityIndicator accessibilityLabel="Processing import" size="large" color={d.accent}/>}
    {!!error && <View style={styles.card}><Text style={styles.error}>{error}</Text><Text style={styles.note}>Check the backend and retry your last action.</Text></View>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, content: { padding: 24, paddingTop: 36, paddingBottom: 48, maxWidth: 880, width: '100%', alignSelf: 'center', gap: 20 }, kicker: { fontWeight: '500', letterSpacing: 2, color: d.muted, fontSize: 11 }, title: { fontSize: 40, lineHeight: 46, letterSpacing: -1, fontWeight: '500', color: d.text }, note: { fontSize: 14, color: d.muted, lineHeight: 23 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, step: { paddingVertical: 12, paddingHorizontal: 8, color: d.body, fontSize: 12, borderBottomWidth: 1, borderBottomColor: d.border }, card: { backgroundColor: d.surface, borderWidth: 1, borderColor: d.border, borderRadius: 12, padding: 24, gap: 16 }, heading: { fontSize: 20, fontWeight: '500', color: d.text }, primary: { padding: 16, minHeight: 48, backgroundColor: d.accent, borderRadius: 24, alignItems: 'center' }, primaryText: { fontWeight: '500', color: d.text }, secondary: { borderWidth: 1, borderColor: d.strongBorder, borderRadius: 6, padding: 16, minHeight: 48, alignItems: 'center' }, count: { fontSize: 15, fontWeight: '500', color: d.body, lineHeight: 24 },
  issue: { fontSize: 12, color: d.body, lineHeight: 20, borderBottomWidth: 1, borderBottomColor: d.border, paddingBottom: 8 }, error: { color: d.error, fontWeight: '500' }, mapping: { gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: d.border }, field: { fontSize: 13, color: d.body, fontWeight: '500' }, chip: { backgroundColor: d.elevated, padding: 14, minHeight: 48, borderRadius: 6, borderWidth: 1, borderColor: d.strongBorder }, chipText: { color: d.body, fontWeight: '500' }, options: { backgroundColor: d.elevated, borderRadius: 6, borderWidth: 1, borderColor: d.strongBorder }, option: { padding: 14, minHeight: 48, borderBottomWidth: 1, borderBottomColor: d.border },
});
