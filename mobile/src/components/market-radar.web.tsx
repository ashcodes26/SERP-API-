import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from 'recharts';
import { Text, View } from 'react-native';
import { ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';
import { palette } from '@/constants/palette';
import type { StudentDemandSkillOut } from '@/types/contracts';
import { radarData } from '@/utils/market-data';
export default function MarketRadar({ skills }: { skills: StudentDemandSkillOut[] }) {
  const data = radarData(skills);
  if (data.length < 3) return <Text style={ui.muted}>Radar requires three skills with known proficiency.</Text>;
  return <View style={{ gap: 12 }}><Text style={ui.muted}>Demand vs proficiency · separate measures · unknowns excluded</Text>
    <div role="img" aria-label="Sample demand and evidenced student proficiency radar; exact values follow in the skill list" style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer width="100%" height="100%"><RadarChart data={data} outerRadius="55%" accessibilityLayer>
        <PolarGrid stroke={d.strongBorder} /><PolarAngleAxis dataKey="subject" tickFormatter={value => value === 'Machine Learning' ? 'ML' : value === 'PostgreSQL' ? 'Postgres' : value} tick={{ fill: d.body, fontSize: 12, fontFamily: 'system-ui' }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fill: d.muted, fontSize: 10 }} />
        <Radar name="Sample demand %" dataKey="demand" stroke={d.accent} fill={d.accent} fillOpacity={0.12} isAnimationActive={false} />
        <Radar name="Evidenced proficiency %" dataKey="student" stroke={palette.saffron} fill={palette.saffron} fillOpacity={0.12} isAnimationActive={false} />
        <Tooltip contentStyle={{ backgroundColor: d.surface, borderColor: d.border, color: d.text }} /><Legend wrapperStyle={{ fontFamily: 'system-ui', fontSize: 12 }} />
      </RadarChart></ResponsiveContainer>
    </div></View>;
}
