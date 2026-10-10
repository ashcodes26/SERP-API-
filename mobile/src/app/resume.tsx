import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { jobsApi, resumeApi, session, tasksApi } from '@/api/client';
import { Action, Card, ui } from '@/components/career-ui';
import { Check, Confirm, Field, pickResume } from '@/components/workspace-controls';
import { releasePickedResume } from '@/utils/picked-resume';
import { downloadResume } from '@/utils/resume-download';
import { ResumeStatistics } from '@/components/resume-statistics';
import { design as d } from '@/constants/design';
import type { JobListingOut, ResumeWorkspaceOut } from '@/types/contracts';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export default function ResumeScreen() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ job_id?: string }>();
  const [workspaces, setWorkspaces] = useState<ResumeWorkspaceOut[]>([]);
  const [workspace, setWorkspace] = useState<ResumeWorkspaceOut | null>(null);
  const [paste, setPaste] = useState(''); const [storageConsent, setStorageConsent] = useState(false);
  const [draft, setDraft] = useState(''); const [finalReview, setFinalReview] = useState(false);
  const [format, setFormat] = useState<'docx' | 'txt'>('docx');
  const [mode, setMode] = useState<'manual' | 'listing'>('manual');
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [role, setRole] = useState('Data Analyst'); const [location, setLocation] = useState('');
  const [listings, setListings] = useState<JobListingOut[]>([]); const [job, setJob] = useState<JobListingOut | null>(null);
  const [searchStatus, setSearchStatus] = useState('');
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
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
    setWorkspace(item); setDraft(item.revised_text); setFinalReview(false); setConfirmations({});
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
  const analyze = () => {
    if (!workspace) return;
    void perform(async () => {
      const next = await resumeApi.analyze(workspace.id, mode === 'listing' && job ? { version: workspace.version, job_id: job.id } : { version: workspace.version, title: title.trim(), description: description.trim() });
      setWorkspace(next); setConfirmations({}); setFinalReview(false); await loadList();
      setNotice('Analysis saved. Review each suggestion; your edited resume has not been changed.');
    });
  };
  const analysis = workspace?.analysis;
  return <SafeAreaView edges={['bottom']} style={ui.screen}><ScrollView contentContainerStyle={[ui.content, { maxWidth: 1200 }]} keyboardShouldPersistTaps="handled">
    <Text style={ui.kicker}>FACTS FIRST / YOUR WORDS / YOUR APPROVAL</Text><Text style={ui.title}>Shape your next application.</Text><Text style={ui.body}>Upload → Choose target → Review evidence → Improve → Export. Your original text is preserved. Suggestions never add unconfirmed experience.</Text>
    {!student ? <Card><Text style={ui.body}>Sign in with a student account to use the private Resume Enhancer.</Text></Card> : <>
      {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.body}>Processing your request…</Text></View>}
      {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Text style={ui.muted}>Your local edits are kept. For a version conflict, copy any unsaved text, then reload the saved version below.</Text></Card>}
      {!!notice && <Card><Text accessibilityLiveRegion="polite" style={ui.body}>{notice}</Text></Card>}
      <Card><Text style={ui.kicker}>01 / YOUR RESUME</Text><Text style={ui.heading}>Start with what you have.</Text><Text style={ui.muted}>UTF-8 TXT or DOCX · up to 1 MiB · 30–20,000 parsed characters. PDF and images are unsupported. Parsed text is private and retained until you delete it; the uploaded binary is not retained or sent to SerpApi.</Text>
        <Check label="I consent to storing my parsed resume privately until I delete it." checked={storageConsent} onChange={setStorageConsent} disabled={busy} />
        <Action disabled={busy || !storageConsent} onPress={() => replaceEditor('Replace active resume', 'Switch to a new upload and discard the unsaved local editor text? Your saved original and revisions remain available.', async () => { const asset = await pickResume(); if (!asset) return; try { const item = await resumeApi.upload(asset, storageConsent); select(item); await loadList(); setNotice(`Parsed ${asset.name}: ${item.original_text.length} characters. Original saved separately.`); } finally { releasePickedResume(asset); } })}>Upload or replace resume</Action>
        <Field label="Or paste original resume text" value={paste} onChange={setPaste} multiline disabled={busy} />
        <Action secondary disabled={busy || !storageConsent || paste.trim().length < 30} onPress={() => replaceEditor('Replace active resume', 'Create a new saved original and discard unsaved local editor text? Existing saved resumes are preserved.', async () => { select(await resumeApi.create(paste, storageConsent)); await loadList(); setNotice('Your original resume text is saved.'); })}>Save pasted resume as a new original</Action>
        <Text style={ui.label}>Saved resumes ({workspaces.length})</Text>{workspaces.length === 0 && <Text style={ui.muted}>No saved resume yet. Upload a file or paste text to begin.</Text>}
        {workspaces.map(item => <View key={item.id} style={ui.divider}><Text style={ui.body}>{item.filename} / #{item.id}{workspace?.id === item.id ? ' / Active' : ''}</Text><Text style={ui.muted}>{new Date(item.updated_at).toLocaleString()} / {item.target.title ?? 'Target not selected'}</Text><View style={ui.row}><Action secondary disabled={busy} onPress={() => replaceEditor('Reload saved resume', 'Discard local unsaved edits and open the saved version?', async () => { select(await resumeApi.get(item.id)); })}>Open saved resume #{item.id}</Action><Action secondary disabled={busy} onPress={() => setConfirmation({ title: 'Delete resume', message: 'Permanently delete this original, revision, target description, and analysis? Your other resumes, tasks, and optional profile are preserved.', action: async () => { const latest = await resumeApi.get(item.id); await resumeApi.remove(item.id, latest.version); if (workspace?.id === item.id) { setWorkspace(null); setDraft(''); } await loadList(); setNotice('Resume and its derived analysis deleted.'); } })}>Delete resume #{item.id}</Action></View></View>)}
        {workspace && <Text style={ui.body}>Parsed {workspace.original_text.length} characters from {workspace.filename}. Review the complete original in the editor below.</Text>}
      </Card>
      {workspace && <>
        <ResumeStatistics original={workspace.original_statistics} revised={workspace.revised_statistics} dirty={dirty} />
        <Card><Text style={ui.kicker}>02 / TARGET ROLE</Text><Text style={ui.heading}>Choose the job you are writing for.</Text><View style={ui.row}><Action secondary disabled={busy} onPress={() => setMode('manual')}>Paste job description{mode === 'manual' ? ' ✓' : ''}</Action><Action secondary disabled={busy} onPress={() => setMode('listing')}>Select retrieved listing{mode === 'listing' ? ' ✓' : ''}</Action></View>
          {mode === 'manual' ? <><Text style={ui.muted}>Source: user-provided description. Skillup cannot verify the employer or opening.</Text><Field label="Manual target job title" value={title} onChange={setTitle} maxLength={200} disabled={busy} /><Field label="Manual job description" value={description} onChange={setDescription} multiline disabled={busy} /></> : <><Field label="Resume target search role" value={role} onChange={setRole} maxLength={120} disabled={busy} /><Field label="Resume target search location" value={location} onChange={setLocation} maxLength={120} disabled={busy} /><Action disabled={busy || !role.trim()} onPress={() => void perform(async () => { const result = await jobsApi.search({ role: role.trim(), location: location.trim() }); setListings(result.jobs); setSearchStatus(`${result.jobs.length} listings / ${result.cache_status.replaceAll('_', ' ')} / Retrieved ${new Date(result.retrieved_at).toLocaleString()}. ${result.warnings.join(' ')}`); })}>Search real target jobs</Action><Text style={ui.muted}>{searchStatus}</Text>{listings.map(item => <Action key={item.id} secondary disabled={busy} onPress={() => void perform(async () => setJob(await jobsApi.detail(item.id)))}>{item.title} / {item.company ?? 'Company unavailable'} / {item.location ?? 'Location unavailable'}{job?.id === item.id ? ' ✓' : ''}</Action>)}
            {job && <View style={ui.divider}><Text style={ui.heading}>{job.title}</Text><Text style={ui.body}>{job.company ?? 'Company unavailable'} / {job.location ?? 'Location unavailable'}</Text><Text style={ui.muted}>{job.provenance.replaceAll('_', ' ')} / Opening not verified active / Retrieved {new Date(job.retrieved_at).toLocaleString()}</Text>{job.source_url && <Action secondary disabled={busy} onPress={() => open(job.source_url!)}>Open target source ↗</Action>}<Text selectable style={ui.body}>{job.description || 'Description unavailable. Use the manual description option.'}</Text><Text style={ui.body}>Extracted requirements: {job.skills.filter(x => x.requirement_type !== 'mentioned').map(x => `${x.name} (${x.requirement_type})`).join(', ') || 'Insufficient explicit requirements'}</Text>{job.warnings.map(value => <Text style={ui.muted} key={value}>{value}</Text>)}{!!job.missing_fields.length && <Text style={ui.muted}>Missing fields: {job.missing_fields.join(', ')}</Text>}</View>}
          </>}
          <Action disabled={busy || (mode === 'manual' ? !title.trim() || description.trim().length < 30 : !job || job.description.length < 30)} onPress={analyze}>Analyze original resume for this target</Action><Text style={ui.muted}>Analysis uses your preserved original, not unsaved editor changes. Reanalysis resets suggestion decisions and keeps the saved revision.</Text>
        </Card>
        {analysis && <>
          <Card><Text style={ui.kicker}>03 / EXPLAINABLE TEXT CHECKS</Text><Text style={ui.heading}>{analysis.target_title}</Text><Text style={ui.muted}>Source: {analysis.target_source.replaceAll('_', ' ')} / {analysis.rubric_version}</Text><Text style={ui.score}>{analysis.score === null ? 'Insufficient data' : `${analysis.score} / 100`}</Text><Text style={ui.body}>Resume text alignment estimate</Text><Text style={ui.muted}>{analysis.rubric}</Text>{Object.entries(analysis.score_components).map(([key, value]) => <Text style={ui.body} key={key}>{key.replaceAll('_', ' ')}: {value === null ? 'Unavailable' : `${value.toFixed(1)}%`}</Text>)}<Text style={ui.body}>Detected skills: {analysis.resume_skills.join(', ') || 'None from the supported dictionary'}</Text><Text style={ui.body}>Matching: {analysis.matching_skills.join(', ') || 'None detected'}</Text><Text style={ui.body}>Relevant, not detected: {analysis.not_detected_skills.join(', ') || 'None'}</Text><Text style={ui.body}>Need stronger evidence: {analysis.stronger_evidence_skills.join(', ') || 'None identified'}</Text>{analysis.warnings.map(value => <Text style={ui.muted} key={value}>{value}</Text>)}</Card>
          <Card><Text style={ui.heading}>Evidence you can inspect.</Text><Text style={ui.muted}>Repeated excerpts retain their source labels and are not independent proof. Self-reported or student-confirmed claims do not become assessed proficiency.</Text>{analysis.unified_skills.map(item => <View style={ui.divider} key={item.name}><Text style={ui.body}>{item.name} / {item.conflict ? 'Conflicting claims — review sources' : item.requires_confirmation ? 'Confirmation needed' : 'Recorded evidence'}</Text><Text style={ui.muted}>Profile level: {item.profile_level === null ? 'Unknown' : `${item.profile_level}/5`} / {item.proficiency_assessed ? 'Explicit assessment recorded' : 'Not assessed'}</Text>{item.sources.map((source, index) => <View key={`${source.source}-${index}`}><Text style={ui.muted}>{source.source.replace('aimora_profile', 'skillup_profile').replaceAll('_', ' ')} / {source.kind.replaceAll('_', ' ')} / {source.confirmed ? 'Confirmed source' : 'Self-reported'}{source.claimed_level !== null ? ` / Claimed ${source.claimed_level}/5` : ''}</Text><Text selectable style={ui.body}>{source.excerpt}</Text></View>)}</View>)}<Text style={ui.heading}>Relevant project and experience text</Text>{analysis.relevant_excerpts.length ? analysis.relevant_excerpts.map(value => <Text selectable style={ui.body} key={value}>{value}</Text>) : <Text style={ui.muted}>No recognized job-relevant project/experience text. Review your actual background before adding claims.</Text>}<Text style={ui.heading}>Parsed sections</Text>{Object.entries(analysis.sections).map(([key, lines]) => <View key={key}><Text style={ui.label}>{key.toUpperCase()}</Text>{lines.map((line, index) => <Text selectable style={ui.body} key={index}>{line}</Text>)}</View>)}<Text style={ui.heading}>Structure and readability</Text>{analysis.structure_feedback.length ? analysis.structure_feedback.map(value => <Text style={ui.body} key={value}>{value}</Text>) : <Text style={ui.muted}>No issues detected by these limited text checks. Visual layout has not been assessed.</Text>}</Card>
          <Card><Text style={ui.kicker}>04 / REVIEW EACH CHANGE</Text><Text style={ui.heading}>Keep the facts. Improve the wording.</Text>{analysis.suggestions.length === 0 && <Text style={ui.body}>No automatic wording changes suggested. You can edit the revision below.</Text>}{analysis.suggestions.map(item => <View key={item.id} style={ui.divider}><Text style={ui.body}>{item.reason}</Text>{!!item.original && <Text selectable style={ui.muted}>Original: {item.original}</Text>}{!!item.proposed && <Text selectable style={ui.body}>Proposed: {item.proposed}</Text>}<Text style={ui.muted}>{item.kind === 'review' ? 'Review-only recommendation; accepting it inserts no text.' : item.requires_confirmation ? 'Unconfirmed addition; supply an actual example before acceptance.' : 'Wording suggestion; inspect it before accepting.'}</Text>{item.kind === 'append' && <Field label={`Actual evidence for ${item.skill}`} value={confirmations[item.id] ?? workspace.decisions[item.id]?.confirmation ?? ''} onChange={value => setConfirmations(prev => ({ ...prev, [item.id]: value }))} maxLength={2000} multiline disabled={busy} />}<Text style={ui.label}>Decision: {workspace.decisions[item.id]?.decision ?? 'pending'}</Text><View style={ui.row}>{(['accepted', 'rejected', 'pending'] as const).map(decision => <Action key={decision} secondary disabled={busy} onPress={() => void perform(async () => { setWorkspace(await resumeApi.decide(workspace.id, item.id, workspace.version, decision, confirmations[item.id] ?? workspace.decisions[item.id]?.confirmation ?? '')); })}>{decision === 'accepted' ? 'Accept' : decision === 'rejected' ? 'Reject' : 'Reset'} {item.skill ?? item.id.slice(0, 6)}</Action>)}</View></View>)}<Action disabled={busy} onPress={() => setConfirmation({ title: 'Apply approved suggestions', message: 'Rebuild the revision from the preserved original using accepted suggestions only? This replaces the current editor text, including manual edits. No rejected or pending wording is inserted.', action: async () => { select(await resumeApi.apply(workspace.id, workspace.version)); await loadList(); setNotice('Only accepted changes were applied. Review the revised text before saving and exporting.'); } })}>Apply approved suggestions to revision</Action></Card>
          <Card><Text style={ui.heading}>Your next practical steps.</Text>{analysis.career_recommendations.length ? analysis.career_recommendations.map(value => <View key={value} style={ui.divider}><Text style={ui.body}>{value}</Text><Action secondary disabled={busy} onPress={() => void perform(async () => { const name = value.split(':')[0]; await tasksApi.create({ title: `Review ${name} evidence for ${analysis.target_title}`.slice(0, 200), description: value, priority: analysis.requirements.some(x => x.name === name && x.requirement_type === 'required') ? 'high' : 'medium' }); setNotice('Evidence task saved in your roadmap to-do list. Open My journey → Roadmap to link it to an existing milestone.'); })}>Add evidence task: {value.split(':')[0]}</Action></View>) : <Text style={ui.body}>No explicit skill requirements to prioritize. Supply a fuller description.</Text>}<Action secondary disabled={busy} onPress={() => router.push('/')}>Open My journey and roadmap →</Action></Card>
        </>}
        <Card><Text style={ui.heading}>Your original. Your revised resume.</Text><Text style={ui.muted}>Original text stays intact. The editor contains your saved revision and local changes. {dirty ? 'You have unsaved edits.' : 'Editor matches the saved revision.'}</Text><View style={{ flexDirection: width >= 1000 ? 'row' : 'column', gap: 20 }}><View style={{ flex: 1, minWidth: 0, gap: 8 }}><Text style={ui.label}>Preserved original (read only)</Text><ScrollView nestedScrollEnabled style={{ maxHeight: 450 }}><Text selectable style={[ui.body, { padding: 16, backgroundColor: d.elevated }]}>{workspace.original_text}</Text></ScrollView></View><View style={{ flex: 1, minWidth: 0 }}><Field label="Revised resume editor" value={draft} onChange={value => { setDraft(value); setFinalReview(false); }} multiline disabled={busy} /></View></View>
          <Check label="I reviewed the revised text and confirm every skill, date, achievement, and other fact is accurate." checked={finalReview} onChange={setFinalReview} disabled={busy} />
          <Action disabled={busy || !finalReview || draft.trim().length < 30} onPress={() => void perform(async () => { const item = await resumeApi.save(workspace.id, workspace.version, draft, finalReview); setWorkspace(item); setDraft(item.revised_text); await loadList(); setNotice('Your approved revision is saved. It is ready to export.'); })}>Save approved revision</Action><Action secondary disabled={busy} onPress={() => setConfirmation({ title: 'Restore original', message: 'Replace the revision and local edits with the preserved original, and reset all suggestion decisions?', action: async () => { select(await resumeApi.restore(workspace.id, workspace.version)); await loadList(); setNotice('Original wording restored.'); } })}>Restore original wording</Action>
        </Card>
        <Card><Text style={ui.kicker}>05 / FINAL REVIEW AND EXPORT</Text><Text style={ui.heading}>Take your approved resume with you.</Text><Text style={ui.muted}>Download includes the saved revision only. Save your edits first and confirm the final review above. DOCX uses a simple readable document layout; your original visual design is not preserved.</Text><View style={ui.row}>{(['docx', 'txt'] as const).map(value => <Action key={value} secondary disabled={busy} onPress={() => setFormat(value)}>{value.toUpperCase()}{format === value ? ' ✓' : ''}</Action>)}</View><Action disabled={busy || dirty || !finalReview} onPress={() => void perform(async () => { const bytes = await resumeApi.export(workspace.id, workspace.version, format, finalReview); await downloadResume(bytes, `skillup-resume-${workspace.id}.${format}`, format === 'docx' ? DOCX : 'text/plain'); setNotice('Approved resume generated. Your browser download or device save/share dialog is ready.'); })}>Download approved {format.toUpperCase()} resume</Action></Card>
      </>}
    </>}
    {confirmation && <Confirm title={confirmation.title} message={confirmation.message} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={() => void perform(async () => { await confirmation.action(); setConfirmation(null); })} />}
  </ScrollView></SafeAreaView>;
}
