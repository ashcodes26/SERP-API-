import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { pickResume } from '@/components/workspace-controls';
import { releasePickedResume } from '@/utils/picked-resume';
import { uploadResume } from '@/api/client';
import { Action, ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';
import type { ResumeUploadOut } from '@/types/contracts';
export default function ResumeUpload({ jobId, studentId, disabled }: { jobId: number; studentId: number; disabled: boolean }) {
  const [busy, setBusy] = useState(false); const guard = useRef(false);
  const [error, setError] = useState(''); const [result, setResult] = useState<ResumeUploadOut | null>(null);
  async function pick() {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError('');
    try {
      const asset = await pickResume();
      if (!asset) return;
      try { setResult(await uploadResume(jobId, studentId, asset)); }
      finally { releasePickedResume(asset); }

    } catch (e) { setError(e instanceof Error ? e.message : 'Resume processing failed.'); }
    finally { guard.current = false; setBusy(false); }
  }
  return <View style={ui.divider}><Text style={ui.heading}>Upload a resume</Text><Text style={ui.muted}>UTF-8 TXT or DOCX · maximum 1 MiB · 30–20,000 extracted characters. File and text are not retained or sent to SerpApi. Pasted text above is preserved.</Text>
    <Action secondary disabled={disabled || busy} onPress={() => void pick()}>{busy ? 'Uploading and reading resume…' : '↑ Choose TXT / DOCX resume'}</Action>
    {busy && <ActivityIndicator color={d.accent} accessibilityLabel="Reading resume and generating advice" />}{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {result && <View style={ui.divider}><Text style={ui.body}>{result.filename} · {result.extracted_character_count} characters read</Text>{result.advice.suggestions.map((v, i) => <Text style={ui.body} key={i}>{v}</Text>)}{result.advice.limitations.map(v => <Text style={ui.muted} key={v}>{v}</Text>)}</View>}
  </View>;
}
