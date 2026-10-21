import { Action, Card, ui } from '@/components/career-ui';
import { AdaptiveColumns, PageHeading, page, SectionHeading, StatusTag, WorkspacePage, useScreenLayout } from '@/components/screen-layout';
import { BarChart, StatStrip } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { placementApi } from '@/api/placement';
import { Choices } from '@/components/placement-ui';
import type { CohortOut } from '@/types/contracts';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { importApi, type ImportSummary, type ImportUpload } from '@/api/client';

const fields = ['student_id', 'name', 'first_name', 'last_name', 'email', 'department', 'program', 'specialization', 'semester', 'cgpa', 'graduation_year', 'batch', 'section'];
export default function AdminImport() {
  const { desktop } = useScreenLayout();
  const mutation = useRef(false);
  const [cohorts, setCohorts] = useState<CohortOut[]>([]);
  const [cohortId, setCohortId] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<ImportUpload | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { placementApi.cohorts().then(setCohorts).catch(err => setError(err instanceof Error ? err.message : 'Could not load cohorts')); }, []));
  async function perform(action: () => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setRetry(() => () => void perform(action));
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Import request failed'); }
    finally { mutation.current = false; setBusy(false); }
  }
  const pick = () => perform(async () => {
    if (!cohortId) { setError('Select a cohort before uploading.'); return; }
    const selection = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], copyToCacheDirectory: true });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (!/\.(csv|xlsx)$/i.test(asset.name)) { setError('Choose a .csv or .xlsx file.'); return; }
    setUploaded(null); setMapping({}); setResult(null); setEditing(null);
    const response = await importApi.upload(asset, cohortId);
    setUploaded(response); setMapping(response.suggested_mapping);
  });
  const stage = !uploaded ? 0 : !result ? 1 : result.job.status.startsWith('completed') ? 3 : 2;
  return <WorkspacePage maxWidth={1080}>
    <PageHeading title="Student cohort import" eyebrow="FACULTY CONSOLE / STUDENTS & COHORTS" description="Upload, map and validate student records before confirming an import into an authorized cohort." />
    <View style={ui.row}>{['Upload source', 'Map columns', 'Validate rows', 'Confirm import'].map((label, index) => <View key={label} style={[ui.chip, { flexGrow: 1, gap: 6, backgroundColor: d.elevated }, index === stage && ui.selected]}><Text style={ui.label}>{index + 1}. {label}</Text><Text style={ui.muted}>{index === stage ? 'Current step' : index < stage ? 'Earlier step' : 'Next step'}</Text></View>)}</View>
    <View style={page.notice}><Text style={ui.label}>AUTHORIZED IMPORT SCOPE</Text><Text style={ui.muted}>Only your assigned cohort can receive records. Preview validates staged rows before any student-record changes. Existing unassigned students do not become accessible through import. CGPA remains on the 0–10 scale.</Text></View>
    <AdaptiveColumns><View style={page.column}><Card><SectionHeading title="Target cohort" /><Choices disabled={busy} label="Import into assigned cohort" values={cohorts.map(x => ({ value: x.id, label: `${x.name} (${x.students})` }))} selected={cohortId} onSelect={id => { setCohortId(id); setUploaded(null); setResult(null); }} />{!cohorts.length && <Text style={ui.body}>Create a cohort in the faculty overview before importing students.</Text>}<Action secondary onPress={() => router.push('/admin?section=students')}>Back to Students & Cohorts</Action></Card></View>
    <View style={page.column}><Card><SectionHeading title={uploaded ? 'Staged source' : 'Upload student records'} description="CSV or XLSX · 1–5,000 data rows · up to 40 columns. The server enforces its configured file-size limit." />{uploaded && <><StatusTag>Import #{uploaded.job_id}</StatusTag><Text style={ui.body}>{uploaded.total_rows} staged rows · {uploaded.headers.length} columns</Text></>}<Action disabled={busy || !cohortId} onPress={() => void pick()}>{uploaded ? 'Choose another file' : 'Choose CSV / XLSX'}</Action>{!cohortId && <Text style={ui.muted}>Select an assigned cohort to enable upload.</Text>}</Card></View></AdaptiveColumns>
    {uploaded && <View style={styles.card}><Text style={styles.heading}>Map the uploaded columns</Text><Text style={styles.note}>{uploaded.total_rows} rows · {uploaded.headers.length} columns. Each destination field can be used once; leave unneeded columns as Ignore.</Text><Text style={styles.note}>{uploaded.headers.join(', ')}</Text>
      <View style={[ui.row, { alignItems: 'stretch' }]}>{uploaded.headers.map(header => <View key={header} style={[styles.mapping, { flexBasis: desktop ? '47%' : '100%', flexGrow: 1, minWidth: 0 }]}><Text style={styles.field}>{header}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Map source column ${header}`} accessibilityState={{ expanded: editing === header, disabled: busy }} disabled={busy} onPress={() => setEditing(editing === header ? null : header)} style={styles.chip}><Text style={styles.chipText}>{mapping[header] ?? 'Ignore'} ▾</Text></Pressable>
        {editing === header && <View style={styles.options}>{['', ...fields].map(field => <Pressable accessibilityRole="button" key={field} disabled={busy} onPress={() => { setMapping(previous => { const next = { ...previous }; delete next[header]; for (const key of Object.keys(next)) if (next[key] === field) delete next[key]; if (field) next[header] = field; return next; }); setEditing(null); setResult(null); }} style={styles.option}><Text style={styles.field}>{field || 'Ignore'}</Text></Pressable>)}</View>}
      </View>)}</View>
      <Pressable accessibilityRole="button" disabled={busy} style={[result ? styles.secondary : styles.primary, busy && { opacity: 0.5 }]} onPress={() => perform(async () => setResult(await importApi.preview(uploaded.job_id, mapping)))}><Text style={result ? styles.field : styles.primaryText}>Validate and preview</Text></Pressable>
    </View>}
    {result && <View style={styles.card}><Text style={styles.heading}>Import status: {result.job.status.replaceAll('_', ' ')}</Text><Text style={styles.note}>{result.job.status === 'validated' ? 'Review row counts and issues before confirming. Confirmation imports valid rows only and keeps duplicate handling explicit.' : result.job.status.startsWith('completed') ? 'Review completed counts and any remaining issues. You can revalidate remaining rows without changing the original file.' : 'Review validation messages below before continuing.'}</Text>
      <StatStrip items={[{ label: "Valid", value: result.job.valid_rows }, { label: "Duplicates", value: result.job.duplicate_rows }, { label: "Errors", value: result.job.error_rows }, { label: "Imported", value: result.job.imported_rows }]} /><BarChart max={Math.max(1, result.job.valid_rows, result.job.duplicate_rows, result.job.error_rows, result.job.imported_rows)} unit=" rows" rows={[{ label: "Valid", value: result.job.valid_rows }, { label: "Errors", value: result.job.error_rows, color: d.error }, { label: "Imported", value: result.job.imported_rows, color: d.success }]} />
      {result.issues.slice(0, 100).map((issue, index) => <Text style={styles.issue} key={`${issue.row_number}-${issue.field}-${index}`}>Row {issue.row_number}: {issue.issue_code} — {issue.message}</Text>)}
      {result.issues.length > 100 && <Text style={styles.note}>Showing first 100 issues of {result.issues.length}.</Text>}
      {result.job.status === 'validated' && <><Pressable accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => perform(async () => setResult(await importApi.confirm(result.job.id)))}><Text style={styles.primaryText}>Import valid rows (skip duplicates)</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => perform(async () => setResult(await importApi.confirm(result.job.id, true)))}><Text style={styles.field}>Import and update matching assigned records</Text></Pressable><Text style={styles.note}>Use update matching records only when you intend to update existing students in this assigned cohort.</Text></>}
      {result.job.status.startsWith('completed') && <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={() => perform(async () => setResult(await importApi.retry(result.job.id)))}><Text style={styles.field}>Revalidate remaining rows</Text></Pressable>}
    </View>}
    {busy && <ActivityIndicator accessibilityLabel="Processing import" size="large" color={d.accent}/>}
    {!!error && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Text style={styles.note}>No student records are changed until a confirmation succeeds. Check the file, mapping, or connection, then retry.</Text>{retry && <Pressable accessibilityRole="button" disabled={busy} style={styles.secondary} onPress={retry}><Text style={styles.field}>Retry last action</Text></Pressable>}</View>}
  </WorkspacePage>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: d.canvas }, content: { padding: 24, paddingTop: 36, paddingBottom: 48, maxWidth: 880, width: '100%', alignSelf: 'center', gap: 20 }, kicker: { fontWeight: '500', letterSpacing: 2, color: d.muted, fontSize: 11 }, title: { fontSize: 40, lineHeight: 46, letterSpacing: -1, fontWeight: '500', color: d.text }, note: { fontSize: 14, color: d.muted, lineHeight: 23 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, step: { paddingVertical: 12, paddingHorizontal: 8, color: d.body, fontSize: 12, borderBottomWidth: 1, borderBottomColor: d.border }, currentStep: { borderBottomColor: d.accent, color: d.text }, card: { backgroundColor: d.elevated, borderWidth: 1, borderColor: d.border, borderRadius: 12, padding: 24, gap: 16 }, heading: { fontSize: 20, fontWeight: '500', color: d.text }, primary: { padding: 16, minHeight: 48, backgroundColor: d.accent, borderRadius: 24, alignItems: 'center' }, primaryText: { fontWeight: '500', color: d.text }, secondary: { borderWidth: 1, borderColor: d.strongBorder, borderRadius: 6, padding: 16, minHeight: 48, alignItems: 'center' }, count: { fontSize: 15, fontWeight: '500', color: d.body, lineHeight: 24 },
  issue: { fontSize: 12, color: d.body, lineHeight: 20, borderBottomWidth: 1, borderBottomColor: d.border, paddingBottom: 8 }, error: { color: d.error, fontWeight: '500' }, mapping: { gap: 8, padding: 16, backgroundColor: d.higher, borderRadius: 6, borderBottomWidth: 1, borderBottomColor: d.border }, field: { fontSize: 13, color: d.body, fontWeight: '500' }, chip: { backgroundColor: d.elevated, padding: 14, minHeight: 48, borderRadius: 6, borderWidth: 1, borderColor: d.strongBorder }, chipText: { color: d.body, fontWeight: '500' }, options: { backgroundColor: d.elevated, borderRadius: 6, borderWidth: 1, borderColor: d.strongBorder }, option: { padding: 14, minHeight: 48, borderBottomWidth: 1, borderBottomColor: d.border },
});
