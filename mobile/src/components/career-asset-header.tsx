import { Text, View } from 'react-native';
import { WorkspaceSubNavigation } from '@/components/app-navigation';
import { ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';
import { StudentDemoHeader } from '@/components/student-demo-header';
import { PageHeading, page } from '@/components/screen-layout';

type AssetName = 'resume' | 'linkedin';

export function CareerAssetHeader({ asset, description, steps, currentStep }: { asset: AssetName; description: string; steps: string[]; currentStep: number }) {
  return <View style={{ gap: 24 }}>
    <WorkspaceSubNavigation group="assets" />
    <StudentDemoHeader section={asset}><PageHeading eyebrow="CAREER ASSETS" title={asset === 'resume' ? 'Resume Analyzer' : 'LinkedIn Analyzer'} description={description} /></StudentDemoHeader>
    <View accessibilityLabel={`${asset === 'resume' ? 'Resume' : 'LinkedIn'} workflow progress`} style={[ui.row, { padding: 12, backgroundColor: d.elevated, borderWidth: 1, borderColor: d.border, borderRadius: 8, alignItems: 'stretch' }]}>
      {steps.map((step, index) => <View key={step} style={{ flex: 1, minWidth: 105, borderWidth: 1, borderRadius: 6, borderColor: index === currentStep ? d.accent : d.border, backgroundColor: index === currentStep ? d.higher : d.elevated, padding: 12, gap: 6 }}>
        <Text style={[ui.label, { color: index === currentStep ? d.text : d.muted }]}>{index + 1}. {step}</Text><Text style={page.caption}>{index === currentStep ? 'Current step' : index < currentStep ? 'Earlier step' : 'Next step'}</Text>
      </View>)}
    </View>
  </View>;
}
