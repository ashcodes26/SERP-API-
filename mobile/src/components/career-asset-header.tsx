import { Text, View } from 'react-native';
import { WorkspaceSubNavigation } from '@/components/app-navigation';
import { ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';

type AssetName = 'resume' | 'linkedin';

export function CareerAssetHeader({ asset, description, steps, currentStep }: { asset: AssetName; description: string; steps: string[]; currentStep: number }) {
  return <View style={{ gap: 14 }}>
    <Text style={ui.kicker}>CAREER ASSETS</Text>
    <Text style={ui.title}>{asset === 'resume' ? 'Resume Analyzer' : 'LinkedIn Analyzer'}</Text>
    <WorkspaceSubNavigation group="assets" />
    <Text style={ui.muted}>{description}</Text>
    <View accessibilityLabel={`${asset === 'resume' ? 'Resume' : 'LinkedIn'} workflow progress`} style={ui.row}>
      {steps.map((step, index) => <View key={step} style={{ borderBottomWidth: 2, borderBottomColor: index === currentStep ? d.accent : d.border, paddingBottom: 6 }}>
        <Text style={[ui.muted, { color: index === currentStep ? d.text : d.muted }]}>{index < currentStep ? 'Done: ' : index === currentStep ? 'Current: ' : ''}{step}</Text>
      </View>)}
    </View>
  </View>;
}
