import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { jobsApi, resumeApi, session } from '@/api/client';
import { Action, Card, Details, ui } from '@/components/career-ui';
import { Check, Confirm, Field, pickResume } from '@/components/workspace-controls';
import { releasePickedResume } from '@/utils/picked-resume';
import { downloadResume } from '@/utils/resume-download';
import { replaceSuggestedText, resumeAnalysisRequirements, suggestionIsApplied } from '@/utils/resume-workspace';
import RevisionEditor from '@/components/revision-editor';
import { BarChart } from '@/components/analytics';
import { CareerAssetHeader } from '@/components/career-asset-header';
import { design as d } from '@/constants/design';
import { resumeAssetStage } from '@/utils/career-asset-stage';
import type { JobListingOut, ResumeWorkspaceOut, ResumeSuggestionOut } from '@/types/contracts';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export default function ResumeScreen() {
  const params = useLocalSearchParams<{ job_id?: string }>();
  const [workspaces, setWorkspaces] = useState<ResumeWorkspaceOut[]>([]);
  const [workspace, setWorkspace] = useState<ResumeWorkspaceOut | null>(null);
  const [paste, setPaste] = useState(''); const [storageConsent, setStorageConsent] = useState(false);
  const [draft, setDraft] = useState(''); const [finalReview, setFinalReview] = useState(false);
  const [format, setFormat] = useState<'docx' | 'txt'>('docx');
  const [mode, setMode] = useState<'manual' | 'listing'>('manual');
  const [aiConsent, setAiConsent] = useState(false);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [role, setRole] = useState('Data Analyst'); const [location, setLocation] = useState('');
  const [listings, setListings] = useState<JobListingOut[]>([]); const [job, setJob] = useState<JobListingOut | null>(null);
  const [searchStatus, setSearchStatus] = useState('');
  const [operationBusy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const busy = operationBusy || loading; const lock = useRef(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const student = session.getStudentId();
  const perform = useCallback(async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Request unsuccessful. Your saved work and local edits are preserved.'); }
    finally { lock.current = false; setBusy(false); }
  }, []);
  const loadList = async () => setWorkspaces(await resumeApi.list());
  function select(item: ResumeWorkspaceOut) {
    setAiConsent(false);
    setWorkspace(item); setDraft(item.revised_text); setFinalReview(false);
    if (item.target.title) setTitle(item.target.title);
    if (item.target.description) setDescription(item.target.description);
    setMode(item.target.job_id || (!item.target.title && job) ? 'listing' : 'manual');
  }
  const savedJobId = workspace?.target.job_id;
  useEffect(() => {
    if (!savedJobId) return;
    let active = true;
    void jobsApi.detail(savedJobId).then(value => { if (active) setJob(value); }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Selected listing is unavailable; use a manual description.'); });
    return () => { active = false; };
  }, [savedJobId]);
  const dirty = !!workspace && draft !== workspace.revised_text;
  function replaceEditor(title: string, message: string, action: () => Promise<void>) {
    if (dirty) setConfirmation({ title, message, action });
    else void perform(action);
  }
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!student) return;
    void resumeApi.list().then(saved => {
      if (active) {
        setWorkspaces(saved);
        // Profile edits in the separate tab invalidate analyses and increment versions.
        // Refresh persisted state on return while preserving the local editor draft.
        setWorkspace(current => current ? saved.find(item => item.id === current.id && item.version >= current.version) ?? current : null);
      }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load your workspace.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [student]));
  useEffect(() => {
    if (!params.job_id || !student) return;
    let active = true;
    void jobsApi.detail(Number(params.job_id)).then(value => { if (active) { setJob(value); setMode('listing'); } }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load the selected listing.'); });
    return () => { active = false; };
  }, [params.job_id, student]);
  const open = (url: string) => void perform(async () => { if (!/^https:\/\//i.test(url)) throw new Error('This source URL is unavailable.'); await Linking.openURL(url); });
  const analysisRequirements = resumeAnalysisRequirements({ mode, title, description, job, consent: aiConsent });
  const analyze = () => {
    if (!workspace || busy || analysisRequirements.length) return;
    void perform(async () => {
      const next = await resumeApi.analyze(workspace.id, mode === 'listing' && job ? { version: workspace.version, ai_consent: aiConsent, job_id: job.id } : { version: workspace.version, ai_consent: aiConsent, title: title.trim(), description: description.trim() });
      setWorkspace(next); setFinalReview(false); await loadList();
      setNotice('Analysis saved. Review each suggestion; your edited resume has not been changed.');
    });
  };
  const analysis = workspace?.analysis;
  const stage = resumeAssetStage(!!workspace, !!analysis, dirty, finalReview);
  const stageIndex = (['input', 'target', 'review', 'revise', 'export'] as const).indexOf(stage);
  function replaceSuggestion(item: ResumeSuggestionOut, undo = false) {
    if (!workspace) return;
    void perform(async () => {
      // Update the controlled editor before waiting for the decision request.
      // Replace only this exact span in the current draft, never rebuild it.
      const next = replaceSuggestedText(draft, undo ? item.proposed : item.original, undo ? item.original : item.proposed);
      setDraft(next); setFinalReview(false);
      setNotice(undo ? 'Replacement undone in the editor. Save revision to keep your changes.' : 'Replaced in the revised resume editor. Review the text and Save revision to keep it.');
      setWorkspace(await resumeApi.decide(workspace.id, item.id, workspace.version, undo ? 'pending' : 'accepted', ''));
    });
  }
  return <SafeAreaView edges={['bottom']} style={ui.screen}><ScrollView contentContainerStyle={[ui.content, { maxWidth: 800 }]} keyboardShouldPersistTaps="handled">
    <CareerAssetHeader asset="resume" description="Optimize the document you submit with an original resume, a target, and edits you approve." steps={['Add resume', 'Choose target', 'Review feedback', 'Revise', 'Export']} currentStep={stageIndex} />
    {!student ? <Card><Text style={ui.body}>Sign in with a student account to use the private Resume Enhancer.</Text></Card> : <>
      {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.body}>Processing your request…</Text></View>}
      {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Text style={ui.muted}>Your saved resume and local editor text are preserved. For a version conflict, copy local edits before reloading the saved resume.</Text></Card>}
      {!!notice && <Card><Text accessibilityLiveRegion="polite" style={ui.body}>{notice}</Text></Card>}
      <Card><Text style={ui.kicker}>STEP 1 / ORIGINAL DOCUMENT</Text><Details label={workspace ? `Resume: ${workspace.filename} · upload or manage` : "Add your resume"}><Text style={ui.muted}>PDF / DOCX / TXT · 1 MiB max · text-based content only. The preserved original is never overwritten by suggested edits.</Text>
        <Check label="Store my resume text privately until I delete it." checked={storageConsent} onChange={setStorageConsent} disabled={busy} />
        <Action disabled={busy || !storageConsent} onPress={() => replaceEditor('Replace active resume', 'Switch to a new upload and discard the unsaved local editor text? Your saved original and revisions remain available.', async () => { const asset = await pickResume(); if (!asset) return; try { const item = await resumeApi.upload(asset, storageConsent); select(item); await loadList(); setNotice(`Parsed ${asset.name}: ${item.original_text.length} characters. Original saved separately.`); } finally { releasePickedResume(asset); } })}>Upload resume</Action>
        <Field label="Or paste original resume text" value={paste} onChange={setPaste} multiline disabled={busy} />
        <Action secondary disabled={busy || !storageConsent || paste.trim().length < 30} onPress={() => replaceEditor('Replace active resume', 'Create a new saved original and discard unsaved local editor text? Existing saved resumes are preserved.', async () => { select(await resumeApi.create(paste, storageConsent)); await loadList(); setNotice('Your original resume text is saved.'); })}>Save resume</Action>
        <Text style={ui.label}>SAVED RESUMES ({workspaces.length})</Text>{workspaces.length === 0 && <Text style={ui.muted}>No saved resumes yet. Add one above to begin.</Text>}
        {workspaces.map(item => <View key={item.id} style={ui.divider}><Text style={ui.body}>{item.filename} / #{item.id}{workspace?.id === item.id ? ' / Active' : ''}</Text><Text style={ui.muted}>{new Date(item.updated_at).toLocaleString()} / {item.target.title ?? 'Target not selected'}</Text><View style={ui.row}><Action secondary disabled={busy} onPress={() => replaceEditor('Reload saved resume', 'Discard local unsaved edits and open the saved version?', async () => { select(await resumeApi.get(item.id)); })}>Open saved resume #{item.id}</Action><Action secondary disabled={busy} onPress={() => setConfirmation({ title: 'Delete resume', message: 'Permanently delete this original, revision, target description, and analysis? Your other resumes, tasks, and optional profile are preserved.', action: async () => { const latest = await resumeApi.get(item.id); await resumeApi.remove(item.id, latest.version); if (workspace?.id === item.id) { setWorkspace(null); setDraft(''); } await loadList(); setNotice('Resume and its derived analysis deleted.'); } })}>Delete resume #{item.id}</Action></View></View>)}
        {workspace && <Text style={ui.body}>Parsed {workspace.original_text.length} characters from {workspace.filename}. Review the complete original in the editor below.</Text>}
      </Details></Card>
      {workspace && <>
        <Card><Text style={ui.kicker}>STEP 2 / TARGET</Text><Text style={ui.heading}>Choose what this resume should address</Text><Text style={ui.muted}>Use your own job description or select a retrieved listing. A retrieved opening may no longer be active.</Text><View style={ui.row}><Action secondary disabled={busy} onPress={() => setMode('manual')}>Paste job description{mode === 'manual' ? ' ✓' : ''}</Action><Action secondary disabled={busy} onPress={() => setMode('listing')}>Select retrieved listing{mode === 'listing' ? ' ✓' : ''}</Action></View>
          {mode === 'manual' ? <><Text style={ui.muted}>Source: your description · unverified opening. Both fields are required for Gemini feedback.</Text><Field label="Manual target job title" value={title} onChange={setTitle} maxLength={200} disabled={busy} /><Field label="Manual job description" value={description} onChange={setDescription} multiline disabled={busy} /><Text style={ui.muted}>{description.trim().length} characters · minimum 30</Text></> : <><Field label="Resume target search role" value={role} onChange={setRole} maxLength={120} disabled={busy} /><Field label="Resume target search location" value={location} onChange={setLocation} maxLength={120} disabled={busy} /><Action disabled={busy || !role.trim()} onPress={() => void perform(async () => { const result = await jobsApi.search({ role: role.trim(), location: location.trim() }); setListings(result.jobs); setSearchStatus(`${result.jobs.length} listings / ${result.cache_status.replaceAll('_', ' ')} / Retrieved ${new Date(result.retrieved_at).toLocaleString()}. ${result.warnings.join(' ')}`); })}>Search jobs</Action><Text style={ui.muted}>{searchStatus}</Text>{listings.map(item => <Action key={item.id} secondary disabled={busy} onPress={() => void perform(async () => setJob(await jobsApi.detail(item.id)))}>{item.title} / {item.company ?? 'Company unavailable'} / {item.location ?? 'Location unavailable'}{job?.id === item.id ? ' ✓' : ''}</Action>)}
            {job && <View style={ui.divider}><Text style={ui.heading}>{job.title}</Text><Text style={ui.body}>{job.company ?? 'Company unavailable'} / {job.location ?? 'Location unavailable'}</Text><Text style={ui.muted}>{job.provenance.replaceAll('_', ' ')} / Opening not verified active / Retrieved {new Date(job.retrieved_at).toLocaleString()}</Text>{job.source_url && <Action secondary disabled={busy} onPress={() => open(job.source_url!)}>Open target source ↗</Action>}<Text selectable style={ui.body}>{job.description || 'Description unavailable. Use the manual description option.'}</Text><Text style={ui.body}>Extracted requirements: {job.skills.filter(x => x.requirement_type !== 'mentioned').map(x => `${x.name} (${x.requirement_type})`).join(', ') || 'Insufficient explicit requirements'}</Text>{job.warnings.map(value => <Text style={ui.muted} key={value}>{value}</Text>)}{!!job.missing_fields.length && <Text style={ui.muted}>Missing fields: {job.missing_fields.join(', ')}</Text>}</View>}
          </>}
          <Text style={ui.muted}>Gemini feedback is optional. It sends the original resume and target description to Google. We remove recognizable email, phone, address and contact headers where feasible, but this is not complete anonymization. Do not send sensitive, confidential, or personal information on the free tier.</Text>
          <Check label="Send my de-identified resume and job description to Google for Gemini feedback." checked={aiConsent} onChange={setAiConsent} disabled={busy} />
          <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
            <Text style={ui.label}>{busy ? 'Wait for the current request to finish.' : analysisRequirements.length ? 'To enable Gemini analysis:' : 'Ready to analyze with Gemini.'}</Text>
            {!busy && analysisRequirements.map(message => <Text key={message} style={ui.body}>• {message}</Text>)}
          </View>
          <Action disabled={busy || analysisRequirements.length > 0} onPress={analyze}>{operationBusy ? 'Working…' : 'Analyze with Gemini'}</Action><Text style={ui.muted}>Gemini reviews the preserved original. Reanalysis resets edit decisions.</Text>
        </Card>
        {analysis && <>
          <Card><Text style={ui.kicker}>STEP 3 / REVIEW</Text><Text style={ui.heading}>Gemini feedback</Text>
            <Text accessibilityLiveRegion="polite" style={ui.body}>{analysis.ai_review.message}</Text>
            <Text style={ui.muted}>{analysis.ai_review.status.replaceAll('_', ' ')} / {analysis.ai_review.model ?? 'No model'}</Text>
            {analysis.ai_review.feedback && <>
              <Text style={ui.body}>{analysis.ai_review.feedback.summary}</Text>
              <Text style={ui.heading}>Gemini rating: {analysis.ai_review.feedback.scores.overall.value === null ? 'Insufficient information' : `${analysis.ai_review.feedback.scores.overall.value}/100`}</Text>
              <Text style={ui.muted}>{analysis.disclaimer} This is feedback on supplied text, not an ATS score or hiring prediction.</Text>
              <Text style={ui.body}>{analysis.ai_review.feedback.scores.overall.reason}</Text>
              <BarChart unit="/100" rows={(['relevance', 'evidence', 'clarity', 'structure'] as const).map(key => ({ label: key.charAt(0).toUpperCase() + key.slice(1), value: analysis.ai_review.feedback!.scores[key].value }))} />
              <Details label="Why these ratings?">{Object.entries(analysis.ai_review.feedback.scores).map(([key, rating]) => <View key={key} style={ui.divider}><Text style={ui.label}>{key.toUpperCase()} / {rating.value ?? 'Not rated'}</Text><Text style={ui.body}>{rating.reason}</Text>{rating.excerpts.map((excerpt: string, i: number) => <Text selectable key={i} style={ui.muted}>Resume evidence: {excerpt}</Text>)}</View>)}</Details>
              <Details label="Strengths">{analysis.ai_review.feedback.strengths.map((item, i) => <View key={i} style={ui.divider}><Text style={ui.body}>{item.strength}</Text><Text selectable style={ui.muted}>{item.excerpt}</Text></View>)}</Details>
              <Details label="Requirements needing more evidence">{analysis.ai_review.feedback.gaps.map((text, i) => <Text key={i} style={ui.body}>{text}</Text>)}</Details>
              <Details label="Improvements">{analysis.ai_review.feedback.improvements.map((text, i) => <Text key={i} style={ui.body}>{text}</Text>)}</Details>
              <Details label="Questions for you">{analysis.ai_review.feedback.questions.map((text, i) => <Text key={i} style={ui.body}>{text}</Text>)}</Details>
            </>}
            {!!analysis.ai_review.rejected_rewrites && <Text style={ui.muted}>{analysis.ai_review.rejected_rewrites} rewrites did not pass factual or overlap checks and were discarded.</Text>}
            {(analysis.ai_review.validation_warnings ?? []).map((warning, index) => <Text key={index} style={ui.muted}>{warning}</Text>)}
            {!!analysis.ai_review.rewrite_message && <Text accessibilityLiveRegion="polite" style={ui.muted}>{analysis.ai_review.rewrite_message}</Text>}
          </Card>
          {analysis.ai_review.status === 'available' && <Card><Text style={ui.heading}>Suggested edits to approve</Text><Text style={ui.muted}>These are optional drafts from Gemini. Nothing changes until you replace text and save the revision yourself.</Text>
            {!analysis.suggestions.length && <Text style={ui.muted}>{analysis.ai_review.rewrite_validation_status === 'unavailable' ? 'Rewrite verification was unavailable. Reanalyze later to request replaceable edits.' : analysis.ai_review.rejected_rewrites ? 'The proposed edits did not pass factual checks. Reanalyze for different wording, or review the improvements above.' : 'Gemini returned no wording edits in this review. Reanalyze to request clearer summaries and bullets; missing facts still need your input.'}</Text>}
            {analysis.suggestions.map(item => <View key={item.id} style={ui.divider}>
              <Text style={ui.label}>BEFORE</Text><Text selectable style={ui.muted}>{item.original}</Text>
              <Text style={ui.label}>AFTER</Text><Text selectable style={ui.body}>{item.proposed}</Text>
              <Text style={ui.muted}>{item.reason}</Text>
              <Text style={ui.muted}>{suggestionIsApplied(draft, item.original, item.proposed) ? `Replaced in editor${dirty ? ' · unsaved' : ' · saved'}` : workspace.decisions[item.id]?.decision === 'rejected' ? 'Rejected' : 'Ready to replace'}</Text>
              <View style={ui.row}><Action disabled={busy || suggestionIsApplied(draft, item.original, item.proposed)} onPress={() => replaceSuggestion(item)}>{suggestionIsApplied(draft, item.original, item.proposed) ? 'Replaced' : 'Replace'}</Action>
                {suggestionIsApplied(draft, item.original, item.proposed) ? <Action secondary disabled={busy} onPress={() => replaceSuggestion(item, true)}>Undo replacement</Action> : <Action secondary disabled={busy || workspace.decisions[item.id]?.decision === 'rejected'} onPress={() => void perform(async () => { setWorkspace(await resumeApi.decide(workspace.id, item.id, workspace.version, 'rejected', '')); })}>Reject</Action>}
              </View>
            </View>)}
          </Card>}
        </>}
        <Card><Text style={ui.kicker}>STEP 4 / REVISE</Text><Text style={ui.heading}>Your approved revision</Text><Text accessibilityLiveRegion="polite" style={ui.muted}>Replace updates this editor immediately. The original stays intact. {dirty ? 'You have unsaved edits.' : 'Editor matches the saved revision.'}</Text><Details label="View preserved original (read only)"><ScrollView nestedScrollEnabled style={{ maxHeight: 450 }}><Text selectable style={[ui.body, { padding: 16, backgroundColor: d.elevated }]}>{workspace.original_text}</Text></ScrollView></Details><RevisionEditor key={workspace.id} value={draft} onChange={value => { setDraft(value); setFinalReview(false); }} highlights={(analysis?.suggestions ?? []).filter(item => suggestionIsApplied(draft, item.original, item.proposed)).map(item => item.proposed)} disabled={busy} />
          <Check label="I reviewed the revised text and confirm every skill, date, achievement, and other fact is accurate." checked={finalReview} onChange={setFinalReview} disabled={busy} />
          <Action disabled={busy || !finalReview || draft.trim().length < 30} onPress={() => void perform(async () => { const item = await resumeApi.save(workspace.id, workspace.version, draft, finalReview); setWorkspace(item); setDraft(item.revised_text); await loadList(); setNotice('Your approved revision is saved. It is ready to export.'); })}>Save revision</Action><Action secondary disabled={busy} onPress={() => setConfirmation({ title: 'Restore original', message: 'Replace the revision and local edits with the preserved original, and reset all suggestion decisions?', action: async () => { select(await resumeApi.restore(workspace.id, workspace.version)); await loadList(); setNotice('Original wording restored.'); } })}>Restore original</Action>
        </Card>
        <Card><Text style={ui.kicker}>STEP 5 / EXPORT</Text><Details label="Export approved resume"><Text style={ui.muted}>{dirty ? 'Save the current revision before exporting.' : finalReview ? 'Approved saved revision · choose a format.' : 'Confirm factual accuracy before saving and exporting.'} DOCX uses a simple layout.</Text><View style={ui.row}>{(['docx', 'txt'] as const).map(value => <Action key={value} secondary disabled={busy} onPress={() => setFormat(value)}>{value.toUpperCase()}{format === value ? ' ✓' : ''}</Action>)}</View><Action disabled={busy || dirty || !finalReview} onPress={() => void perform(async () => { const bytes = await resumeApi.export(workspace.id, workspace.version, format, finalReview); await downloadResume(bytes, `skillup-resume-${workspace.id}.${format}`, format === 'docx' ? DOCX : 'text/plain'); setNotice('Approved resume generated. Your browser download or device save/share dialog is ready.'); })}>Download approved {format.toUpperCase()} resume</Action></Details></Card>
      </>}
    </>}
    {confirmation && <Confirm title={confirmation.title} message={confirmation.message} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={() => void perform(async () => { await confirmation.action(); setConfirmation(null); })} />}
  </ScrollView></SafeAreaView>;
}
