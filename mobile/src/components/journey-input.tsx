import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { careerApi } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import { Check } from '@/components/workspace-controls';
import { releasePickedResume } from '@/utils/picked-resume';
import { downloadResume } from '@/utils/resume-download';
import { design as d } from '@/constants/design';
import type { JourneyPreviewOut, ProfileOut } from '@/types/contracts';

const template = 'name,program,department,specialization,semester,cgpa,graduation_year,skills,summary\nAlex Sample,BSc,Computer Science,Data Science,4,8.2,2028,Python;SQL,Synthetic example: replace this row with your own details.\n';

export default function JourneyInput({ onSaved, onCancel }: { onSaved: (profile: ProfileOut) => Promise<void>; onCancel: () => void }) {
  const [preview, setPreview] = useState<JourneyPreviewOut | null>(null);
  const [filename, setFilename] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState('');
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not process your file.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function upload() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      if (!/\.(csv|xlsx)$/i.test(asset.name)) throw new Error('Choose a .csv or .xlsx file.');
      if (asset.size && asset.size > 1024 * 1024) throw new Error('Choose a file up to 1 MiB.');
      setPreview(null); setConfirmed(false);
      const next = await careerApi.previewInput(asset);
      setPreview(next); setFilename(asset.name);
    } finally { releasePickedResume(asset); }
  }
  return <>
    <Card><Text style={ui.kicker}>01 / YOUR DETAILS</Text><Text style={ui.heading}>Upload details</Text>
      <Text style={ui.body}>CSV / XLSX · one row · first sheet · 1 MiB max</Text>
      <Text selectable style={ui.muted}>Use the template · skills separated by semicolons</Text>
      <Text style={ui.muted}>Updates your profile · new skills remain unassessed</Text>
      <View style={ui.row}><Action disabled={busy} onPress={() => void perform(upload)}>Upload CSV / XLSX</Action>
        {Platform.OS === 'web' && <Action secondary disabled={busy} onPress={() => void perform(() => downloadResume(new TextEncoder().encode(template).buffer, 'skillup-journey-template.csv', 'text/csv'))}>CSV template</Action>}
      </View>
    </Card>
    {busy && <ActivityIndicator color={d.accent} accessibilityLabel="Processing journey input" />}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text></Card>}
    {preview && <Card><Text style={ui.kicker}>02 / REVIEW BEFORE SAVING</Text><Text style={ui.heading}>Preview</Text><Text style={ui.muted}>{filename}</Text>
      {Object.entries(preview.details).filter(([key, value]) => key !== 'skills' && value !== null && value !== '').map(([key, value]) => <Text style={ui.body} key={key}>{key.replaceAll('_', ' ')}: {String(value)}</Text>)}
      <Text style={ui.body}>Skills: {preview.details.skills.join(', ') || 'No additional skill mentions'}</Text>
      {!!preview.ignored_columns.length && <Text style={ui.muted}>Ignored columns: {preview.ignored_columns.join(', ')}</Text>}
      <Check label="Save these reviewed details to my profile." checked={confirmed} onChange={setConfirmed} disabled={busy} />
      <Action disabled={busy || !confirmed} onPress={() => void perform(async () => { const saved = await careerApi.saveInput({ details: preview.details, profile_digest: preview.profile_digest, confirmed }); await onSaved(saved); })}>Save & continue</Action>
    </Card>}
    <Action secondary disabled={busy} onPress={onCancel}>Back</Action>
  </>;
}
