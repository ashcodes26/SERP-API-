import { Text } from 'react-native';
import { ui } from '@/components/career-ui';
import type { StudentDemandSkillOut } from '@/types/contracts';
export default function MarketRadar({ skills }: { skills: StudentDemandSkillOut[] }) {
  return <Text style={ui.muted}>The radar chart is available on web. The {skills.length} skills below provide the same demand and proficiency values, including unknowns.</Text>;
}
