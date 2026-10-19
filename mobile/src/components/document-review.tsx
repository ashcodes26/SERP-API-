import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { documentsApi, session } from '@/api/client';
import { Action, Card, Details, ui } from '@/components/career-ui';
import { Check, Confirm, Field, pickResume } from '@/components/workspace-controls';
import { releasePickedResume } from '@/utils/picked-resume';
import { decisionKey, decisionRequest, documentValue } from '@/utils/document-review';
import { createLatestRequestGate } from '@/utils/latest-request';
import type { DocumentDecisionIn, DocumentExtractionResult, DocumentItemOut, DocumentOut, DocumentProposalOut, DocumentType, ProfileOut } from '@/types/contracts';

const kinds: DocumentType[] = ['resume', 'certificate', 'transcript', 'project_report', 'internship_document', 'unknown'];

function Item({ item, proposal, onDecide, disabled }: { item: DocumentItemOut; proposal: DocumentProposalOut; onDecide: (item: DocumentItemOut, body: DocumentDecisionIn) => Promise<void>; disabled: boolean }) {
  const [edit, setEdit] = useState(documentValue(item.proposed_value));
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<DocumentDecisionIn | null>(null); const lock = useRef(false);
  async function act(decision: DocumentDecisionIn['decision']) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const request = pending ?? decisionRequest(proposal, item, decision, decisionKey(), edit, confirm);
    setPending(request);
    try { await onDecide(item, request); setPending(null); }
    catch { /* Keep the original key for an explicit retry after an uncertain response. */ }
    finally { lock.current = false; setBusy(false); }
  }
  return <View style={ui.divider}><Text style={ui.heading}>{item.field_path.replaceAll('_', ' ')}</Text>
    <Text style={ui.muted}>{item.comparison_status.replaceAll('_', ' ')} · {item.decision} · explicitly found</Text>
    <Text selectable style={ui.body}>Current: {documentValue(item.current_value)}</Text><Text selectable style={ui.body}>Proposed: {documentValue(item.proposed_value)}</Text>
    {item.field_path === 'skills' && <Text style={ui.muted}>Adds source evidence; proficiency remains unchanged or unknown.</Text>}
    <Details label="Why? View source excerpts">{item.evidence.map((e, index) => <Text key={index} selectable style={ui.body}>{e.excerpt}{e.section ? ` (${e.section})` : ''}</Text>)}</Details>
    {item.decision === 'pending' && <>
      {item.comparison_status === 'conflict' && <Check label="I reviewed both values and confirm replacing the current value." checked={confirm} onChange={setConfirm} disabled={busy || !!pending} />}
      {editing && <Field label="Edited value (must be explicitly supported by the source)" value={edit} onChange={setEdit} maxLength={600} disabled={busy || !!pending} />}
      {pending && !busy ? <Text style={ui.muted}>The prior request may have reached the server. Retry reuses its original decision and key; reload to reconcile.</Text> : null}
      <View style={ui.row}>
        <Action disabled={disabled || busy || (item.comparison_status === 'conflict' && !confirm)} onPress={() => void act(editing ? 'edit' : 'accept')}>{pending ? 'Retry original decision' : editing ? 'Save edited value' : 'Accept'}</Action>
        <Action secondary disabled={disabled || busy || !!pending} onPress={() => setEditing(value => !value)}>{editing ? 'Cancel edit' : 'Edit'}</Action>
        <Action secondary disabled={disabled || busy || !!pending} onPress={() => void act('reject')}>Reject</Action>
      </View>
    </>}
  </View>;
}

export default function DocumentReview({ onApplied }: { onApplied: (profile: ProfileOut) => void }) {
  const [enabled, setEnabled] = useState(false); const [loaded, setLoaded] = useState(false);
  const [documents, setDocuments] = useState<DocumentOut[]>([]); const [selected, setSelected] = useState<DocumentOut | null>(null);
  const [preview, setPreview] = useState<DocumentExtractionResult | null>(null);
  const [storage, setStorage] = useState(false); const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const asset = useRef<DocumentPickerAsset | null>(null); const alive = useRef(true); const lock = useRef(false);
  const heading = useRef<View>(null); const revision = useRef(session.getRevision());
  const requests = useRef(createLatestRequestGate());
  const current = () => alive.current && revision.current === session.getRevision();
  async function perform(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (e) { if (current()) { setError(e instanceof Error ? e.message : 'Request failed. Reload to reconcile.'); setMessage('Request failed.'); } }
    finally { lock.current = false; if (current()) { setBusy(false); (heading.current as unknown as { focus?: () => void })?.focus?.(); } }
  }
  async function reload() {
    const token = requests.current.begin();
    const capability = await documentsApi.capabilities(); if (!current() || !requests.current.isCurrent(token)) return;
    setEnabled(capability.review_enabled); setLoaded(true);
    if (capability.review_enabled) {
      const next = await documentsApi.list(); if (!current() || !requests.current.isCurrent(token)) return;
      setDocuments(next); setSelected(value => value ? next.find(x => x.id === value.id) ?? null : null);
    }
  }
  useEffect(() => {
    alive.current = true;
    const token = requests.current.begin();
    void documentsApi.capabilities().then(async capability => {
      if (!current() || !requests.current.isCurrent(token)) return;
      setEnabled(capability.review_enabled); setLoaded(true);
      if (capability.review_enabled) { const next = await documentsApi.list(); if (current() && requests.current.isCurrent(token)) setDocuments(next); }
    }).catch(e => { if (current()) setError(e instanceof Error ? e.message : 'Could not load reviews.'); });
    return () => { alive.current = false; if (asset.current) releasePickedResume(asset.current); };
  }, []);
  function update(document: DocumentOut) { if (!current()) return; requests.current.begin(); setSelected(document); setDocuments(old => [document, ...old.filter(d => d.id !== document.id)]); setAi(false); }
  async function upload() {
    const picked = await pickResume(); if (!picked) return;
    if (asset.current) releasePickedResume(asset.current);
    asset.current = picked;
    const result = await documentsApi.preview(picked);
    if (current()) { setPreview(result); setStorage(false); setMessage('Preview ready. No document review was stored.'); }
  }
  async function decide(item: DocumentItemOut, body: DocumentDecisionIn) {
    if (!selected?.proposal) return;
    try {
      const result = await documentsApi.decide(selected.proposal.id, item.id, body);
      if (current()) { setSelected({ ...selected, proposal: result.proposal }); setMessage(`Decision recorded: ${body.decision}.`); if (body.decision !== 'reject') onApplied(result.profile); }
    } catch (e) { if (current()) setError(e instanceof Error ? e.message : 'Decision failed. Reload to reconcile.'); throw e; }
  }
  const proposal = selected?.proposal;
  return <Card><View ref={heading} tabIndex={-1}><Text accessibilityRole="header" style={ui.heading}>Documents to review</Text></View>
    <Text style={ui.body}>PDF, DOCX or TXT · up to 1 MiB · selectable text only. Preview uses deterministic extraction. Original files are never stored on the server.</Text>
    {loaded && !enabled && <Text style={ui.muted}>Preview is available. Persistent review requires deployment privacy, retention, consent and key policies to be approved and configured.</Text>}
    <Text accessibilityLiveRegion="polite" style={ui.muted}>{busy ? 'Processing…' : message}</Text>{!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <View style={ui.row}><Action disabled={busy} onPress={() => void perform(upload)}>Preview document</Action><Action secondary disabled={busy} onPress={() => void perform(reload)}>Reload reviews</Action></View>
    {preview && <View style={ui.divider}><Text style={ui.body}>Detected: {preview.document_type.replaceAll('_', ' ')} · {preview.facts.length} explicit findings</Text>
      <Details label="Preview source findings">{preview.facts.map((fact, index) => <Text key={index} selectable style={ui.body}>{fact.field}: {documentValue(fact.value)} — {fact.evidence[0]?.excerpt}</Text>)}</Details>
      <Check label="Store extracted text and review details privately for up to 30 days. Approved profile facts and minimal audit records remain after review deletion." checked={storage} onChange={setStorage} disabled={busy || !enabled} />
      <Action disabled={busy || !enabled || !storage} onPress={() => void perform(async () => { if (!asset.current) return; const doc = await documentsApi.create(asset.current, storage); releasePickedResume(asset.current); asset.current = null; if (current()) { update(doc); setPreview(null); setMessage('Review stored. Review each item before accepting.'); } })}>Create private review</Action>
    </View>}
    {enabled && !documents.length && <Text style={ui.muted}>No documents reviewed yet.</Text>}
    <View style={ui.row}>{documents.map(doc => <Action key={doc.id} secondary disabled={busy} onPress={() => { setSelected(doc); setAi(false); }}>{doc.filename ?? `Review ${doc.id}`} · {doc.status}</Action>)}</View>
    {selected && <View style={ui.divider}><Text style={ui.heading}>{selected.filename ?? 'Purged review'}</Text><Text style={ui.muted}>{selected.document_type.replaceAll('_', ' ')} · {selected.classification_status} · {selected.status} · expires {new Date(selected.expires_at + (selected.expires_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}</Text>
      {selected.warnings.map(w => <Text key={w} style={ui.muted}>{w}</Text>)}
      {!!selected.withheld_count && <Text style={ui.muted}>{selected.withheld_count} findings were withheld or deduplicated. They cannot update your profile.</Text>}
      {!!selected.suggestions.length && <Details label="Suggestions, not facts (cannot be approved)">{selected.suggestions.map(suggestion => <View key={suggestion.id}><Text style={ui.body}>{documentValue(suggestion.value)}: {suggestion.reason}</Text><Text style={ui.muted}>Inferred suggestion only. Supply explicit evidence before adding any fact.</Text></View>)}</Details>}
      {selected.status === 'active' && proposal && <>
        <Text style={ui.muted}>Provenance: document {proposal.document_id} · extraction {proposal.extraction_id} · proposal {proposal.id}</Text>
        <Details label="Correct document type (before approval)"><View style={ui.row}>{kinds.map(kind => <Action key={kind} secondary disabled={busy || proposal.items.some(i => i.decision === 'applied')} onPress={() => void perform(async () => update(await documentsApi.type(selected.id, kind, proposal.version)))}>{kind.replaceAll('_', ' ')}</Action>)}</View></Details>
        <Check label="Send bounded, redacted document text to Google Gemini for optional extraction. Redaction is best effort and does not make text anonymous." checked={ai} onChange={setAi} disabled={busy} />
        <Action secondary disabled={busy || !ai} onPress={() => void perform(async () => { const doc = await documentsApi.extract(selected.id, proposal.version, ai); update(doc); setMessage(`Gemini extraction: ${doc.extraction_status}. Review proposals individually.`); })}>Extract with Gemini</Action>
        <Text style={ui.muted}>AI status: {selected.extraction_status}. Unsupported or unverifiable output cannot update your profile.</Text>
        <Action secondary disabled={busy} onPress={() => void perform(async () => update(await documentsApi.refresh(proposal.id)))}>Refresh comparison after profile changes</Action>
        {!proposal.items.length && <Text style={ui.muted}>No supported explicit facts to propose. Unknown documents and transcripts cannot update academic results.</Text>}
        {proposal.items.map(item => <Item key={`${proposal.id}:${item.id}:${item.version}`} item={item} proposal={proposal} disabled={busy} onDecide={decide} />)}
        {proposal.refresh_recommended && <Text style={ui.body}>Profile updated. Use the existing role alignment and roadmap actions when ready; saved learning progress is preserved.</Text>}
      </>}
      <Action secondary disabled={busy || selected.status === 'deleted'} onPress={() => setDeleting(true)}>Delete retained review data</Action>
      {deleting && <Confirm title="Delete review data" message="Purge retained text, excerpts and proposals now. Approved profile facts and minimal audit records remain." onCancel={() => setDeleting(false)} busy={busy} onConfirm={() => void perform(async () => { await documentsApi.remove(selected.id); setDeleting(false); await reload(); setMessage('Review data deleted. Approved facts remain.'); })} />}
    </View>}
  </Card>;
}
