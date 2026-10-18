import { useState } from 'react';
import { Text, View } from 'react-native';
import { Action, Card, ui } from '@/components/career-ui';
import type { CandidateExtractionOut } from '@/types/contracts';

export function CandidateEvidence({ profile }: { profile: CandidateExtractionOut }) {
  const [expanded, setExpanded] = useState(false);
  return <Card><Text style={ui.kicker}>SAVED PROFILE EVIDENCE</Text><Text style={ui.heading}>What the supplied profile text supports</Text>
    <Text style={ui.muted}>Extracted from saved text · proficiency unassessed · review conflicts before using this information</Text>
    <Text style={ui.body}>Skills: {profile.skills.map(item => item.name).join(', ') || 'No supported skills detected'}</Text>
    {!!profile.conflicts.length && <Text style={ui.error}>Review conflicting sources: {profile.conflicts.join(', ')}</Text>}
    <Action secondary onPress={() => setExpanded(value => !value)}>{expanded ? 'Hide sources' : 'View sources'}</Action>
    {expanded && <>
      {Object.entries(profile.fields).filter(([, values]) => values.length).map(([key, values]) => <View key={key} style={ui.divider}>
        <Text style={ui.label}>{key.replaceAll('_', ' ').toUpperCase()}</Text>
        {values.map((item, index) => <View key={index}><Text selectable style={ui.body}>{item.value}</Text><Text style={ui.muted}>{item.source.replaceAll('_', ' ')} · {item.status} · extraction confidence {Math.round(item.confidence * 100)}%</Text></View>)}
      </View>)}
      <Text style={ui.muted}>Not extracted: {profile.missing_fields.join(', ').replaceAll('_', ' ') || 'All supported sections present'}</Text>
      {profile.warnings.map(value => <Text key={value} style={ui.muted}>{value}</Text>)}
    </>}
  </Card>;
}
