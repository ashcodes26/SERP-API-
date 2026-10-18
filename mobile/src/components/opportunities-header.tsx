import { Text, View } from 'react-native';
import { WorkspaceSubNavigation } from '@/components/app-navigation';
import { ui } from '@/components/career-ui';

export function OpportunitiesHeader({ title, description }: { title: string; description: string }) {
  return <View style={{ gap: 14 }}>
    <Text style={ui.kicker}>OPPORTUNITIES</Text>
    <Text style={ui.title}>{title}</Text>
    <WorkspaceSubNavigation group="opportunities" />
    <Text style={ui.muted}>{description}</Text>
  </View>;
}
