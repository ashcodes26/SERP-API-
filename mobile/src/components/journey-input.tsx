import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { careerApi } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import { releasePickedResume } from '@/utils/picked-resume';
import { design as d } from '@/constants/design';
import type { JourneyPreviewOut, ProfileOut } from '@/types/contracts';

export default function JourneyInput({ onSaved, onCancel }: { onSaved: (profile: ProfileOut) => Promise<void>; onCancel: () => void }) {
  const [preview, setPreview] = useState<JourneyPreviewOut | null>(null);
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
      setPreview(null);
      const next = await careerApi.previewInput(asset);
      setPreview(next);
    } finally { releasePickedResume(asset); }
  }
  return <>
    <Card><Text style={ui.kicker}>01 / UPLOAD</Text><Text style={ui.heading}>Add profile evidence</Text>
      <Text style={ui.body}>Choose a text-based PDF or DOCX, then select Save details to add the extracted profile details and skill mentions to your profile.</Text>
      <View style={{ gap: 4, padding: 14, borderWidth: 1, borderColor: d.border, borderRadius: 6, backgroundColor: d.elevated }}><Text style={ui.label}>Accepted files</Text><Text style={ui.muted}>PDF or DOCX · text-based content · up to 1 MiB</Text><Text style={ui.muted}>New skill mentions stay unassessed until you add evidence or complete an assessment.</Text></View>
      <View style={ui.row}><Action disabled={busy} onPress={() => void perform(upload)}>{preview ? 'Choose another document' : 'Upload PDF / DOCX'}</Action></View>
    </Card>
    {busy && <View style={{ alignItems: 'center', padding: 12, gap: 8 }}><ActivityIndicator color={d.accent} accessibilityLabel="Processing journey input" /><Text style={ui.muted}>Processing your document…</Text></View>}
    {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>We could not complete that request</Text><Text style={ui.body}>{error}</Text><Action secondary disabled={busy} onPress={() => void perform(upload)}>Try another document</Action></Card>}
    {preview && <Action disabled={busy} onPress={() => void perform(async () => { const saved = await careerApi.saveInput({ details: preview.details, profile_digest: preview.profile_digest, confirmed: true }); await onSaved(saved); })}>Save details</Action>}
    <Action secondary disabled={busy} onPress={onCancel}>Back to profile</Action>
  </>;
}
