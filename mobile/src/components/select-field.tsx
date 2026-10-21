import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Action, ui } from '@/components/career-ui';
import { design as d, sizes } from '@/constants/design';

/** Searchable selection for stored options; selecting never creates a new value. */
export function SelectField<T extends string | number>({ label, values, selected, onSelect, disabled = false }: {
  label: string; values: { value: T; label: string }[]; selected: T | null; onSelect: (value: T) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState('');
  const current = values.find(item => item.value === selected);
  const options = values.filter(item => item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled: disabled || !values.length }} disabled={disabled || !values.length} onPress={() => { setQuery(''); setOpen(true); }} style={[ui.chip, ui.row, { minHeight: sizes.control, backgroundColor: d.canvas, borderColor: d.strongBorder, justifyContent: 'space-between', opacity: disabled ? 0.6 : 1 }]}><Text numberOfLines={2} style={[ui.body, { flex: 1 }]}>{current?.label ?? (values.length ? 'Choose an option' : 'No options available')}</Text><Text style={ui.muted}>▾</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, padding: 24, backgroundColor: d.scrim, justifyContent: 'center' }}><View accessibilityViewIsModal style={[ui.card, { maxWidth: 600, maxHeight: '85%', width: '100%', alignSelf: 'center', backgroundColor: d.overlay, borderColor: d.strongBorder }]}>
      <Text accessibilityRole="header" style={ui.heading}>{label}</Text><TextInput accessibilityLabel={`Search ${label.toLowerCase()} options`} value={query} onChangeText={setQuery} placeholder="Find an option" placeholderTextColor={d.muted} style={ui.input} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }} style={{ flexShrink: 1 }}>{options.map(item => <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: selected === item.value, disabled }} disabled={disabled} onPress={() => { onSelect(item.value); setOpen(false); }} style={[ui.chip, selected === item.value && ui.selected]}><Text style={ui.body}>{item.label}{selected === item.value ? ' ✓' : ''}</Text></Pressable>)}{!options.length && <Text style={ui.body}>No matching options.</Text>}</ScrollView><Action secondary onPress={() => setOpen(false)}>Close options</Action>
    </View></View></Modal>
  </View>;
}
