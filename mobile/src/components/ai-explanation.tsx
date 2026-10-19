import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { request, session } from '@/api/client';
import { Action, Details, ui } from '@/components/career-ui';
import { Check } from '@/components/workspace-controls';
import type { AiExplanationOut } from '@/types/contracts';

export default function AiExplanation({ path, label, notice }: { path: string; label: string; notice: string }) {
  const [consent, setConsent] = useState(false); const [result, setResult] = useState<AiExplanationOut | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const lock = useRef(false); const mounted = useRef(true); const heading = useRef<View>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function generate() {
    if (lock.current || !consent) return;
    lock.current = true; setBusy(true); setError(''); setResult(null);
    const revision = session.getRevision();
    const current = () => mounted.current && revision === session.getRevision();
    try {
      const next = await request<AiExplanationOut>(path, { method: 'POST', body: JSON.stringify({ ai_consent: consent }) }, 60000);
      if (current()) { setResult(next); setConsent(false); }
    } catch (e) { if (current()) setError(e instanceof Error ? e.message : 'AI request failed.'); }
    finally { lock.current = false; if (current()) { setBusy(false); (heading.current as unknown as { focus?: () => void })?.focus?.(); } }
  }
  return <View style={ui.divider}><View ref={heading} tabIndex={-1}><Text accessibilityRole="header" style={ui.heading}>{label}</Text></View>
    <Text style={ui.muted}>{notice} Gemini selects source references and conditional actions. Scores and facts remain deterministic. Nothing is saved to your profile.</Text>
    <Check label="I consent to sending the described evidence context to Google Gemini for this request. Redaction is best effort, not anonymization." checked={consent} onChange={setConsent} disabled={busy} />
    <Action secondary disabled={busy || !consent} onPress={() => void generate()}>{busy ? 'Requesting explanation…' : 'Explain with Gemini'}</Action>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {result && <View style={{ gap: 12 }}><Text accessibilityLiveRegion="polite" style={ui.body}>{result.status.replaceAll('_', ' ')}: {result.message}{result.cache_hit ? ' Reused your matching validated result.' : ''}</Text>
      {result.insights.map(insight => <Text key={insight.source_id} selectable style={ui.body}>{insight.explanation}</Text>)}
      <Details label="Evidence and source references">{result.sources.map(source => <View key={source.id}><Text selectable style={ui.body}>{source.label}: {source.detail}</Text><Text selectable style={ui.muted}>Source {source.id} · Evidence IDs: {source.evidence_ids.join(', ') || 'No approved evidence linked'}{source.source_url ? ` · ${source.source_url}` : ''}</Text></View>)}</Details>
      {!!result.recommendations.length && <Details label="Learning recommendations from your roadmap services">{result.recommendations.map(item => <View key={item.skill_id}><Text style={ui.body}>{item.task} · {item.status.replaceAll('_', ' ')}</Text><Text selectable style={ui.muted}>{item.resource_title} · {item.resource_provenance}{item.resource_url ? ` · ${item.resource_url}` : ''}</Text></View>)}</Details>}
    </View>}
  </View>;
}
