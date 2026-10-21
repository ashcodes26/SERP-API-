import { View } from 'react-native';
import { WorkspaceSubNavigation } from '@/components/app-navigation';
import { PageHeading } from '@/components/screen-layout';
import { StudentDemoHeader } from '@/components/student-demo-header';
import type { StudentDemoSection } from '@/types/contracts';

export function OpportunitiesHeader({ title, description, section }: { title: string; description: string; section: Extract<StudentDemoSection, 'jobs' | 'market'> }) {
  return <View style={{ gap: 24 }}><WorkspaceSubNavigation group="opportunities" /><StudentDemoHeader section={section}><PageHeading eyebrow="OPPORTUNITIES" title={title} description={description} /></StudentDemoHeader></View>;
}
