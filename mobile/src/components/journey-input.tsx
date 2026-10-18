import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { careerApi } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import { Check } from '@/components/workspace-controls';
import { releasePickedResume } from '@/utils/picked-resume';
import { design as d } from '@/constants/design';
import type { JourneyPreviewOut, ProfileOut } from '@/types/contracts';

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
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      if (!/\.(pdf|docx)$/i.test(asset.name)) throw new Error('Choose a .pdf or .docx file.');
      if (asset.size && asset.size > 1024 * 1024) throw new Error('Choose a file up to 1 MiB.');
      setPreview(null); setConfirmed(false);
      const next = await careerApi.previewInput(asset);
      setPreview(next); setFilename(asset.name);
    } finally { releasePickedResume(asset); }
  }
  return <>
    <Card><Text style={ui.kicker}>01 / UPLOAD</Text><Text style={ui.heading}>Add profile evidence</Text>
      <Text style={ui.body}>Choose a text-based PDF or DOCX. SkillUp extracts profile details and skill mentions for you to review before anything is saved.</Text>
      <View style={{ gap: 4, padding: 14, borderWidth: 1, borderColor: d.border, borderRadius: 6, backgroundColor: d.elevated }}><Text style={ui.label}>Accepted files</Text><Text style={ui.muted}>PDF or DOCX · text-based content · up to 1 MiB</Text><Text style={ui.muted}>New skill mentions stay unassessed until you add evidence or complete an assessment.</Text></View>
      <View style={ui.row}><Action disabled={busy} onPress={() => void perform(upload)}>{preview ? 'Choose another document' : 'Upload PDF / DOCX'}</Action></View>
    </Card>
    {busy && <View style={{ alignItems: 'center', padding: 12, gap: 8 }}><ActivityIndicator color={d.accent} accessibilityLabel="Processing journey input" /><Text style={ui.muted}>Reading your document securely…</Text></View>}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>We could not read that document</Text><Text style={ui.body}>{error}</Text><Action secondary disabled={busy} onPress={() => void perform(upload)}>Try another document</Action></Card>}
    {preview && <Card><Text style={ui.kicker}>02 / REVIEW</Text><Text style={ui.heading}>Confirm what was detected</Text><Text style={ui.muted}>{filename}</Text>
      <Text style={ui.body}>Only the details you confirm below will update your saved profile.</Text>
      <View style={{ gap: 8 }}>{Object.entries(preview.details).filter(([key, value]) => key !== 'skills' && value !== null && value !== '').map(([key, value]) => <View key={key} style={{ gap: 2 }}><Text style={ui.label}>{key.replaceAll('_', ' ')}</Text><Text style={ui.body}>{String(value)}</Text></View>)}</View>
      <View style={{ gap: 8 }}><Text style={ui.label}>Detected skill mentions</Text>{preview.details.skills.length ? <View style={ui.row}>{preview.details.skills.map(skill => <View key={skill} style={{ paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: d.border, borderRadius: 14 }}><Text style={ui.muted}>{skill}</Text></View>)}</View> : <Text style={ui.muted}>No additional skill mentions were detected. You can still save the reviewed profile details.</Text>}</View>
      <Check label="I reviewed these details and want to save them to my profile." checked={confirmed} onChange={setConfirmed} disabled={busy} />
      <Action disabled={busy || !confirmed} onPress={() => void perform(async () => { const saved = await careerApi.saveInput({ details: preview.details, profile_digest: preview.profile_digest, confirmed }); await onSaved(saved); })}>Save confirmed details</Action>
    </Card>}
    <Action secondary disabled={busy} onPress={onCancel}>Back to profile</Action>
  </>;
}
