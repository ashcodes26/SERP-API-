import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Action, ui } from '@/components/career-ui';
import { BarChart, StatStrip } from '@/components/analytics';
import { design as d } from '@/constants/design';
import { filterDemandSkills } from '@/utils/market-data';
import type { MarketDemandOut } from '@/types/contracts';

export default function DemandRanking({ sample, busy, open }: { sample: MarketDemandOut; busy: boolean; open: (url: string) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = filterDemandSkills(sample.skills, query);
  return <View style={{ gap: 24 }}>
    <Text style={ui.heading}>Top skills</Text>
    <TextInput accessibilityLabel="Filter skills" placeholder="Find a skill" placeholderTextColor={d.muted} value={query} onChangeText={setQuery} style={ui.input} />
    {!rows.length && <Text style={ui.muted}>{sample.skills.length ? 'No matching skills.' : 'No recognized skills in this sample.'}</Text>}
    {rows.map(({ skill, rank }) => {
      const expanded = selected === skill.name;
      const jobs = sample.jobs.filter(job => skill.job_ids.includes(job.id));
      return <View key={skill.name} style={{ gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${rank}. ${skill.name}, ${skill.distinct_job_count} listings, ${skill.demand_percentage ?? 'unavailable'} percent demand`} accessibilityState={{ expanded }} onPress={() => setSelected(expanded ? null : skill.name)} style={({ pressed }) => [{ paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: expanded ? d.elevated : d.canvas, opacity: pressed ? 0.7 : 1, gap: 12 }]}>
          <View style={[ui.row, { gap: 18 }]}><Text style={[ui.label, { color: d.highlight }]}>{String(rank).padStart(2, '0')}</Text><Text style={[ui.body, { flex: 1 }]}>{skill.name}</Text><Text style={ui.muted}>{skill.distinct_job_count} jobs · {expanded ? '−' : '+'}</Text></View>
          <BarChart rows={[{ label: 'Demand', value: skill.demand_percentage }]} />
        </Pressable>
        {expanded && <View style={[ui.divider, { paddingHorizontal: 12 }]}>
          <StatStrip items={[{ label: 'Required', value: skill.required_count }, { label: 'Preferred', value: skill.preferred_count }, { label: 'Other mentions', value: skill.distinct_job_count - skill.required_count - skill.preferred_count }]} />
          <Text style={ui.muted}>{skill.distinct_job_count} of {sample.sample_size} sampled jobs</Text>
          {jobs.map(job => <View key={job.id} style={ui.divider}>
            <Text style={ui.body}>{job.title}</Text><Text style={ui.muted}>{job.company ?? 'Unknown company'} · {job.location ?? 'Unknown location'}</Text>
            {job.skills.filter(requirement => requirement.name === skill.name).map((requirement, index) => <Text key={index} numberOfLines={3} style={ui.muted}>{requirement.requirement_type}: {requirement.excerpt}</Text>)}
            <Text style={ui.muted}>{job.provenance.replaceAll('_', ' ')} · opening unverified</Text>
            {job.source_url && <Action secondary disabled={busy} onPress={() => open(job.source_url!)}>View posting ↗</Action>}
          </View>)}
          {!jobs.length && <Text style={ui.muted}>Source details unavailable · IDs: {skill.job_ids.join(', ')}</Text>}
        </View>}
      </View>;
    })}
  </View>;
}
