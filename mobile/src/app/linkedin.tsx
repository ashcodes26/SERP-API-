import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { linkedinApi, session, tasksApi } from '@/api/client';
import { LinkedInInsights } from '@/components/linkedin-insights';
import { Action, Card, ui } from '@/components/career-ui';
import { Check, Confirm, Field, pickResume } from '@/components/workspace-controls';
import { releasePickedResume } from '@/utils/picked-resume';
import { design as d } from '@/constants/design';
import type { LinkedInOut, LinkedInAuthorizationOut, LinkedInConnectionOut, LinkedInPublicSearchOut, LinkedInAnalysisOut, LinkedInTargetRole } from '@/types/contracts';

const TARGET_ROLES: LinkedInTargetRole[] = ['Data Analyst', 'Machine Learning Engineer', 'Full Stack Developer', 'Backend Developer', 'Cloud / DevOps Engineer'];

export default function LinkedInScreen() {
  const [profile, setProfile] = useState<LinkedInOut | null>(null);
  const [profileUrl, setProfileUrl] = useState(''); const [profileText, setProfileText] = useState('');
  const [consent, setConsent] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const [authorization, setAuthorization] = useState<LinkedInAuthorizationOut | null>(null);
  const [connection, setConnection] = useState<LinkedInConnectionOut | null>(null);
  const [publicPreview, setPublicPreview] = useState<LinkedInPublicSearchOut | null>(null);
  const [lookupDraftId, setLookupDraftId] = useState<string | null>(null);
  const [lookupConsent, setLookupConsent] = useState(false);
  const [targetRole, setTargetRole] = useState<LinkedInTargetRole>('Data Analyst');
  const [jobDescription, setJobDescription] = useState('');
  const [targetedAnalysis, setTargetedAnalysis] = useState<LinkedInAnalysisOut | null>(null);
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
  function setImported(value: LinkedInOut) {
    setTargetedAnalysis(null);
    setLookupDraftId(null);
    setProfile(value); setProfileUrl(value.profile_url ?? ''); setProfileText(value.profile_text); setConfirmed(value.confirmed); setConsent(!!value.consent_at);
  }
  useEffect(() => {
    let active = true;
    if (!student) return;
    void Promise.all([linkedinApi.get(), linkedinApi.latestConnection(), linkedinApi.latestPublicSearch()]).then(([profile, connection, preview]) => {
      if (active) { setImported(profile); setConnection(connection); setPublicPreview(preview); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load your LinkedIn workspace.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [student]);
  useEffect(() => {
    const attemptId = authorization?.id ?? connection?.id;
    if (!attemptId || !student || connection?.status === 'connected' || connection?.status === 'failed') return;
    let active = true; let running = false;
    const poll = async () => {
      if (running || !active) return;
      running = true;
      try {
        const value = await linkedinApi.connection(attemptId);
        if (!active) return;
        setConnection(value);
        if (value.status === 'connected' || value.status === 'failed') clearInterval(timer);
      } catch (e) {
        if (active) { clearInterval(timer); setError(e instanceof Error ? e.message : 'LinkedIn connection unavailable. Connect again.'); }
      } finally { running = false; }
    };
    const timer = setInterval(() => void poll(), 3000);
    void poll();
    return () => { active = false; clearInterval(timer); };
  }, [authorization?.id, connection?.id, connection?.status, student]);
  const profileBody = () => ({ profile_url: profileUrl.trim() || null, profile_text: profileText, consent, confirmed, lookup_id: lookupDraftId });
  async function adoptPublicPreview(value: LinkedInPublicSearchOut) {
    setProfileUrl(value.profile_url); setProfileText(value.profile_text); setLookupDraftId(value.id); setConfirmed(false);
    setNotice('Retrieved text added to the editor. Correct it, confirm it describes your own background, and save to include it in resume analysis.');
  }
  const open = (url: string) => void perform(async () => { if (!/^https:\/\//i.test(url)) throw new Error('This source URL is unavailable.'); await Linking.openURL(url); });
  return <SafeAreaView edges={['bottom']} style={ui.screen}><ScrollView contentContainerStyle={[ui.content, { maxWidth: 1200 }]} keyboardShouldPersistTaps="handled">
    <Text style={ui.kicker}>PROFILE / SOURCES / YOUR REVIEW</Text><Text style={ui.title}>LinkedIn Profile Analyzer</Text>
    <Text style={ui.body}>Retrieve public profile excerpts, review the detected skills, or supply your own career details. Saved, reviewed information can support evidence checks in Resume Enhancer.</Text>
    {!student ? <Card><Text style={ui.body}>Sign in with a student account to use your private LinkedIn analyzer.</Text></Card> : <>
      {busy && <View style={ui.row}><ActivityIndicator color={d.accent} /><Text style={ui.body}>Processing your request...</Text></View>}
      {!!error && <Card><Text accessibilityRole="alert" style={ui.error}>{error}</Text></Card>}
      {!!notice && <Card><Text accessibilityLiveRegion="polite" style={ui.body}>{notice}</Text></Card>}
      <Card>
        <Text style={ui.kicker}>PERSONALIZED PROFILE COACH</Text><Text style={ui.heading}>Analyze your career direction.</Text>
        <Text style={ui.muted}>Choose a target to compare your saved profile evidence. Paste a specific job description to replace the template skill list.</Text>
        <View style={ui.row}>{TARGET_ROLES.map(role => <Action secondary disabled={busy} key={role} onPress={() => { setTargetRole(role); setTargetedAnalysis(null); }}>{role}{targetRole === role ? ' (selected)' : ''}</Action>)}</View>
        <Field label="LinkedIn target job description (optional)" value={jobDescription} onChange={value => { setJobDescription(value); setTargetedAnalysis(null); }} multiline disabled={busy} placeholder="Paste the responsibilities and required skills for your target opening." />
        <Action disabled={busy || !profile?.profile_text || (!!jobDescription.trim() && jobDescription.trim().length < 30)} onPress={() => void perform(async () => { setTargetedAnalysis(await linkedinApi.analyze(targetRole, jobDescription)); setNotice('Career analysis updated using your saved profile text and selected target.'); })}>Analyze my LinkedIn profile</Action>
        <Text style={ui.muted}>{profileText !== profile?.profile_text ? 'Your editor has unsaved changes. Save below to include them in analysis.' : 'Analysis uses your saved career text.'}</Text>
        {!profile?.profile_text && <Text style={ui.body}>Retrieve and save profile excerpts or supply your career information below to unlock evidence-based insights.</Text>}
      </Card>
      {!!profile?.profile_text && <LinkedInInsights analysis={targetedAnalysis ?? profile.analysis} busy={busy} addTask={(title, description, priority) => void perform(async () => { await tasksApi.create({ title: `LinkedIn: ${title}`.slice(0, 200), description, priority }); setNotice('Profile improvement added to your roadmap to-do list in My journey.'); })} />}
      <Card><Text style={ui.kicker}>YOUR PROFILE / CAREER EVIDENCE</Text><Text style={ui.heading}>Retrieve and review your profile</Text><Text style={ui.body}>{profile?.message ?? 'Supply your profile summary or TXT/DOCX export.'}</Text>
        <Field label="LinkedIn profile URL (optional)" value={profileUrl} onChange={setProfileUrl} maxLength={500} disabled={busy} placeholder="https://www.linkedin.com/in/your-name/" />
        <Check label="I consent to searching this public profile URL and storing its preview." checked={lookupConsent} onChange={setLookupConsent} disabled={busy} />
        <Action disabled={busy || !lookupConsent || !profileUrl.trim()} onPress={() => void perform(async () => { setPublicPreview(await linkedinApi.publicSearch(profileUrl.trim(), lookupConsent)); })}>Retrieve public profile information</Action>
        {publicPreview && <View style={ui.divider}>
          <Text style={ui.heading}>{publicPreview.status === 'found' ? 'Public profile results' : 'No indexed profile information found'}</Text>
          <Text style={ui.muted}>Source: SerpApi / Google public search / {publicPreview.provenance.replaceAll('_', ' ')} / {publicPreview.cache_status} / Retrieved {new Date(publicPreview.retrieved_at).toLocaleString()}</Text>
          <Text selectable style={ui.body}>{publicPreview.profile_url}</Text>
          <Text style={ui.body}>Skills mentioned: {publicPreview.detected_skills.join(', ') || 'Not available in the retrieved text'}</Text>
          {publicPreview.warnings.map(value => <Text style={ui.muted} key={value}>{value}</Text>)}
          {publicPreview.sources.map((source, index) => <View style={ui.divider} key={`${source.url}-${index}`}><Text style={ui.body}>{source.title}</Text><Text selectable style={ui.body}>{source.snippet}</Text><Action secondary disabled={busy} onPress={() => open(source.url)}>Open profile source {index + 1}</Action></View>)}
          {publicPreview.status === 'found' && <Action secondary disabled={busy} onPress={() => {
            if (profileText.trim()) setConfirmation({ title: 'Replace profile editor text', message: 'Replace the current editor text with public search excerpts? Your saved profile stays unchanged until you review and save.', action: () => adoptPublicPreview(publicPreview) });
            else void perform(() => adoptPublicPreview(publicPreview));
          }}>Use retrieved text in profile editor</Action>}
        </View>}
        <Field label="Your profile information (editable)" value={profileText} onChange={setProfileText} multiline disabled={busy} placeholder="Skills, experience, projects, education, certifications, and actual outcomes. Use clear section headings." />
        <Check label="I consent to connecting my LinkedIn account and analyzing my supplied profile data." checked={consent} onChange={setConsent} disabled={busy} /><Check label="I reviewed this information and confirm it describes my own background." checked={confirmed} onChange={setConfirmed} disabled={busy} />
        <View style={ui.row}><Action secondary disabled={busy || !consent || (!!lookupDraftId && !confirmed) || (!profileUrl.trim() && profileText.trim().length < 30)} onPress={() => void perform(async () => { setImported(await linkedinApi.save(profileBody())); setNotice(profileText.trim() ? 'Your reviewed profile is saved. Reanalyze the resume to review updated source evidence.' : 'Profile URL saved. Click Retrieve public profile information to search for indexed career details.'); })}>Save profile information</Action><Action secondary disabled={busy || !consent} onPress={() => void perform(async () => { const asset = await pickResume(); if (!asset) return; try { setImported(await linkedinApi.upload(asset, profileBody())); setNotice('Your own profile export was parsed and saved. Reanalyze to review its evidence.'); } finally { releasePickedResume(asset); } })}>Upload own profile TXT/DOCX</Action></View>
        <Text style={ui.muted}>Connect to retrieve your name from LinkedIn. Add experience, education, and skills in the profile editor for career analysis.</Text>
        <Action secondary disabled={busy || !consent} onPress={() => void perform(async () => { const next = await linkedinApi.automatic(profileBody()); setConnection(null); setAuthorization(next); })}>Connect with LinkedIn</Action>
        {(authorization || connection) && <View style={ui.divider}>
          {authorization && (!connection || connection.status === 'pending') && <><Action disabled={busy || !consent} onPress={() => open(authorization.authorization_url)}>Continue on LinkedIn</Action><Text style={ui.muted}>Approve access on LinkedIn, then return to this tab. This authorization expires after 10 minutes.</Text></>}
          {!authorization && connection?.status === 'pending' && <Text style={ui.body}>Waiting for LinkedIn authorization. Complete it in your LinkedIn tab, or connect again to start a new attempt.</Text>}
          {connection?.status === 'exchanging' && <Text style={ui.body}>Retrieving LinkedIn member details...</Text>}
          {connection?.status === 'connected' && <><Text style={ui.heading}>Connected: {connection.name}</Text><Text style={ui.muted}>Source: official LinkedIn API</Text></>}
          {!!connection?.message && <Text accessibilityLiveRegion="polite" style={connection.status === 'failed' ? ui.error : ui.body}>{connection.message}</Text>}
          <Action secondary disabled={busy} onPress={() => void perform(async () => { const attemptId = authorization?.id ?? connection?.id; if (attemptId) await linkedinApi.cancel(attemptId); setAuthorization(null); setConnection(null); })}>Clear LinkedIn connection</Action>
        </View>}
        {(profile?.consent_at || publicPreview) && <>{profile?.consent_at && <Text style={ui.muted}>Saved {new Date(profile.updated_at!).toLocaleString()} / {profile.import_method?.replaceAll('_', ' ') ?? 'URL only; no import'} / {profile.confirmed ? 'Student confirmed, not externally verified' : 'Self-reported; confirmation needed'}</Text>}<Action secondary disabled={busy} onPress={() => setConfirmation({ title: 'Remove profile data', message: 'Delete your LinkedIn URL, supplied text and public preview, and invalidate source-derived resume analyses? Previously approved resume text is preserved; delete a resume to remove that copy.', action: async () => { const result = await linkedinApi.remove(); setImported(await linkedinApi.get()); setPublicPreview(null); setAuthorization(null); setConnection(null); setNotice(result.message); } })}>Remove LinkedIn data</Action></>}
      </Card>
      {!!profile?.profile_text && <Card>
        <Text style={ui.kicker}>SAVED PROFILE ANALYSIS</Text><Text style={ui.heading}>Your career information.</Text>
        <Text style={ui.body}>{profile.detected_skills.length} supported skill mentions: {profile.detected_skills.join(', ') || 'None detected'}</Text>
        <Text style={ui.muted}>Based on the saved text. Mentions describe supplied or reviewed information and do not establish assessed proficiency. Save editor changes to update this analysis.</Text>
        {Object.entries(profile.sections).filter(([, lines]) => lines.length > 0).map(([section, lines]) => <View style={ui.divider} key={section}>
          <Text style={ui.label}>{section.toUpperCase()}</Text>{lines.map((line, index) => <Text selectable style={ui.body} key={index}>{line}</Text>)}
        </View>)}
      </Card>}
    </>}
    {confirmation && <Confirm title={confirmation.title} message={confirmation.message} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={() => void perform(async () => { await confirmation.action(); setConfirmation(null); })} />}
  </ScrollView></SafeAreaView>;
}
