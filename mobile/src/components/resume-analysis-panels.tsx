import { useState, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { design as d } from '@/constants/design';
import { PlanIcon } from '@/components/career-plan-design';
import { r, ResumeAction, ResumeCard, ResumeColumns, ResumeDetails, ResumeTag } from '@/components/resume-design';
import type { GeminiRatingOut, ResumeAnalysisOut, ResumeSuggestionOut } from '@/types/contracts';

export function ResumeFeedback({ analysis }: { analysis: ResumeAnalysisOut }) {
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const review = analysis.ai_review;
  const feedback = review.feedback;
  return <View style={{ gap: 16 }}>
    {feedback && <View style={{ flexDirection: width >= 768 ? 'row' : 'column', gap: 24 }}>{([
      ['Target Relevance', feedback.scores.relevance, 'shield', d.successText],
      ['Action & Evidence', feedback.scores.evidence, 'chart', d.highlight],
      ['Clarity', feedback.scores.clarity, 'spark', '#cdbdff'],
    ] as const).map(([label, rating, icon, color]) => <ResumeCard key={label} style={{ flex: 1, gap: 12 }}><View style={r.spread}><Text style={[r.kicker, { color: d.body, letterSpacing: 0.5 }]}>{label.toUpperCase()}</Text><PlanIcon name={icon} size={18} color={color} /></View><Text style={r.metric}>{rating.value === null ? '—' : rating.value}<Text style={[r.small, { color: d.muted }]}> /100</Text></Text><RatingBar rating={rating} label={label} color={color} /><Text numberOfLines={2} style={r.small}>{rating.reason}</Text></ResumeCard>)}</View>}
    <View style={r.notice}>
      <View style={[r.row, { flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }]}><PlanIcon name="spark" size={22} /><View style={[r.column, { gap: 8 }]}><View style={r.spread}><Text accessibilityRole="header" style={r.subheading}>Gemini Resume Feedback</Text><View style={r.row}>{feedback && <ResumeTag tone="accent">Overall: {feedback.scores.overall.value === null ? 'Not rated' : `${feedback.scores.overall.value}/100`}</ResumeTag>}<ResumeTag tone={review.status === 'available' ? 'success' : 'warning'}>{review.status.replaceAll('_', ' ')}</ResumeTag>{feedback && <ResumeAction secondary onPress={() => setExpanded(value => !value)}>{expanded ? 'Close full feedback' : 'Full feedback & rationale'}</ResumeAction>}</View></View>{feedback ? <Text numberOfLines={3} style={r.body}>{feedback.summary}</Text> : <Text accessibilityLiveRegion="polite" style={r.small}>{review.message}</Text>}</View></View>
      {feedback && <ResumeDetails hideTrigger open={expanded} label="Full feedback, rating rationale & questions">
        <Text style={r.small}>{review.message}</Text>
        <Text style={r.small}>{analysis.disclaimer} This is feedback on supplied text, not an ATS score or hiring prediction.</Text>
        <Text style={r.body}>{feedback.summary}</Text>
        {Object.entries(feedback.scores).map(([key, rating]) => <View key={key} style={r.divider}><Text style={r.label}>{key.toUpperCase()} · {rating.value === null ? 'Not rated' : `${rating.value}/100`}</Text><Text style={r.body}>{rating.reason}</Text>{rating.excerpts.map((excerpt: string, i: number) => <Text selectable key={i} style={r.small}>Resume evidence: {excerpt}</Text>)}</View>)}
        <ResumeDetails label="Strengths">{feedback.strengths.map((item, i) => <View key={i} style={r.divider}><Text style={r.body}>{item.strength}</Text><Text selectable style={r.small}>{item.excerpt}</Text></View>)}</ResumeDetails>
        {([['Requirements needing more evidence', feedback.gaps], ['Improvements', feedback.improvements], ['Questions for you', feedback.questions]] as const).map(([label, values]) => <ResumeDetails key={label} label={label}>{values.length ? values.map((value, i) => <Text key={i} style={r.body}>{value}</Text>) : <Text style={r.small}>None returned in this review.</Text>}</ResumeDetails>)}
        <Text style={r.small}>Model: {review.model ?? 'No model'}</Text>
      </ResumeDetails>}
      {!!review.rejected_rewrites && <Text style={r.small}>{review.rejected_rewrites} rewrites did not pass factual or overlap checks and were discarded.</Text>}
      {(review.validation_warnings ?? []).map((warning, i) => <Text key={i} style={r.small}>{warning}</Text>)}
      {!!review.rewrite_message && <Text accessibilityLiveRegion="polite" style={r.small}>{review.rewrite_message}</Text>}
    </View>
  </View>;
}

function RatingBar({ rating, label, color }: { rating: GeminiRatingOut; label: string; color: string }) {
  return <View accessibilityRole="progressbar" aria-label={`${label} AI estimate`} aria-valuemin={rating.value === null ? undefined : 0} aria-valuemax={rating.value === null ? undefined : 100} aria-valuenow={rating.value ?? undefined} aria-valuetext={rating.value === null ? 'Not rated' : `${rating.value}/100`} style={{ height: 6, backgroundColor: d.border, borderRadius: 3, overflow: 'hidden' }}>{rating.value !== null && <View style={{ width: `${Math.max(0, Math.min(100, rating.value))}%`, height: 6, backgroundColor: color }} />}</View>;
}

export function ResumeSuggestionCard({ item, applied, rejected, dirty, children }: { item: ResumeSuggestionOut; applied: boolean; rejected: boolean; dirty: boolean; children: ReactNode }) {
  return <ResumeCard style={{ borderColor: applied ? '#216754' : rejected ? d.border : '#493365', gap: 12 }}>
    <View style={r.spread}><View style={r.row}><ResumeTag>Replacement · Gemini</ResumeTag><ResumeTag tone={applied ? 'success' : rejected ? 'neutral' : 'warning'}>{applied ? `Applied to revision · ${dirty ? 'unsaved' : 'saved'}` : rejected ? 'Rejected' : 'Pending review'}</ResumeTag>{item.skill && <ResumeTag>{item.skill}</ResumeTag>}</View><Text style={r.small}>{item.factual_validation === 'equivalent_wording' ? 'Equivalent wording' : 'Gemini wording verification'}</Text></View>
    <ResumeColumns><View style={[r.column, r.inset]}><Text style={[r.kicker, { color: d.muted, letterSpacing: 0.5 }]}>ORIGINAL PASSAGE</Text><Text selectable style={[r.body, applied && { textDecorationLine: 'line-through', color: d.muted }]}>{item.original}</Text></View><View style={[r.column, r.inset, applied && { borderColor: '#216754' }]}><Text style={[r.kicker, { color: applied ? d.successText : '#cdbdff', letterSpacing: 0.5 }]}>{applied ? 'APPLIED ROLE-ALIGNED REVISION' : 'PROPOSED REVISION'}</Text><Text selectable style={r.body}>{item.proposed}</Text></View></ResumeColumns>
    <Text style={r.small}>{item.reason}</Text>
    <View style={[r.row, { justifyContent: 'flex-end' }]}>{children}</View>
  </ResumeCard>;
}
