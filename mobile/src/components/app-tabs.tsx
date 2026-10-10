import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { design as d } from '@/constants/design';

export default function AppTabs({ role }: { role: 'admin' | 'student' }) {
  return (
    <NativeTabs
      backgroundColor={d.surface}
      indicatorColor={d.elevated}
      labelStyle={{ color: d.muted, selected: { color: d.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>My journey</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Guide</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      {role === 'admin' && <NativeTabs.Trigger name="admin-import">
        <NativeTabs.Trigger.Label>Import</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={require('@/assets/images/tabIcons/explore.png')} renderingMode="template" />
      </NativeTabs.Trigger>}
    </NativeTabs>
  );
}
