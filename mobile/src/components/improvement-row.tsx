import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Details, ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';

export function ImprovementRow({ index, title, status, summary, children, actions }: { index: number; title: string; status?: string; summary?: string; children?: ReactNode; actions?: ReactNode }) {
  return <View style={[ui.divider, { gap: 12, paddingBottom: 12 }]}>
    <View style={[ui.row, { alignItems: 'flex-start', gap: 18 }]}>
      <Text style={[ui.label, { color: d.highlight, paddingTop: 4 }]}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text style={ui.body}>{title}</Text>
        {!!status && <Text style={ui.muted}>{status}</Text>}
        {!!summary && <Text numberOfLines={2} style={ui.muted}>{summary}</Text>}
      </View>
    </View>
    {children && <Details label="View change">{children}</Details>}
    {actions && <View style={ui.row}>{actions}</View>}
  </View>;
}
