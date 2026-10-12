import { useEffect, useMemo, useState } from 'react';
import { PanResponder, ScrollView, Text, TextInput, View } from 'react-native';
import { Action, ui } from '@/components/career-ui';
import { highlightedRevision } from '@/utils/resume-workspace';

export default function RevisionEditor({ value, onChange, highlights, disabled = false }: { value: string; onChange: (value: string) => void; highlights: string[]; disabled?: boolean }) {
  const [height, setHeight] = useState(360);
  const controller = useMemo(() => createResizeController(setHeight), [setHeight]);
  useEffect(() => { controller.setDisabled(disabled); }, [controller, disabled]);
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>Revised resume editor</Text>
    <TextInput accessibilityLabel="Revised resume editor" value={value} onChangeText={onChange} multiline editable={!disabled} maxLength={20000} style={[ui.input, { height, textAlignVertical: 'top' }]} />
    <View {...controller.panHandlers} accessibilityLabel="Resize revised resume editor" accessibilityRole="adjustable" accessibilityValue={{ min: 180, max: 1200, now: height }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => { if (!disabled) controller.adjust(event.nativeEvent.actionName === 'increment' ? 80 : -80); }} style={[ui.row, { minHeight: 44, justifyContent: 'flex-end' }]}><Text style={ui.muted}>↕ Drag to resize</Text></View>
    <View style={ui.row}><Action secondary disabled={disabled} onPress={() => controller.adjust(-80)}>Smaller editor</Action><Action secondary disabled={disabled} onPress={() => controller.adjust(80)}>Larger editor</Action></View>
    {!!highlights.length && <><Text style={ui.muted}>Replaced passages · highlighted preview</Text><ScrollView style={{ maxHeight: 240 }}><Text selectable style={ui.body}>{highlightedRevision(value, highlights).map((part, index) => <Text key={index} style={part.highlight ? { backgroundColor: '#FFFF00', color: '#111111' } : undefined}>{part.text}</Text>)}</Text></ScrollView></>}
  </View>;
}

function createResizeController(setHeight: (height: number) => void) {
  let currentHeight = 360;
  let startHeight = 360;
  let disabled = false;
  function resize(next: number) {
    if (disabled) return;
    currentHeight = Math.max(180, Math.min(1200, next));
    setHeight(currentHeight);
  }
  const handle = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => { startHeight = currentHeight; },
    onPanResponderMove: (_, gesture) => resize(startHeight + gesture.dy),
  });
  return { panHandlers: handle.panHandlers, adjust: (delta: number) => resize(currentHeight + delta), setDisabled: (value: boolean) => { disabled = value; } };
}
