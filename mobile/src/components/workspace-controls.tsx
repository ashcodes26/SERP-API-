import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Action, ui } from '@/components/career-ui';
import { design as d, radii, spacing as s, sizes } from '@/constants/design';
import { validateResumeFile } from '@/utils/resume-workspace';
import { releasePickedResume } from '@/utils/picked-resume';

export function Check({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={checked} aria-disabled={disabled} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={[ui.row, { paddingVertical: s.one, minHeight: sizes.compactControl, opacity: disabled ? 0.6 : 1 }]}><View style={{ width: 22, height: 22, borderWidth: 1, borderColor: checked ? d.accent : d.strongBorder, borderRadius: 4, backgroundColor: checked ? d.accent : d.elevated, alignItems: 'center', justifyContent: 'center' }}><Text style={[ui.label, { color: d.text }]}>{checked ? '✓' : ''}</Text></View><Text style={[ui.body, { flex: 1 }]}>{label}</Text></Pressable>;
}
export function Field({ label, value, onChange, multiline = false, disabled = false, maxLength = 20000, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; disabled?: boolean; maxLength?: number; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: s.one }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} accessibilityState={{ disabled }} value={value} onChangeText={onChange} multiline={multiline} editable={!disabled} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={d.muted} autoCapitalize="none" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[ui.input, focused && { borderColor: d.accent }, disabled && { color: d.muted, backgroundColor: d.higher }, multiline && { minHeight: 160, textAlignVertical: 'top' }]} /></View>;
}
export function Confirm({ title, message, onConfirm, onCancel, busy = false }: { title: string; message: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return <Modal visible transparent animationType="fade" onRequestClose={onCancel}><View style={{ flex: 1, backgroundColor: d.scrim, justifyContent: 'center', padding: s.four }}><View accessibilityViewIsModal style={[ui.card, { backgroundColor: d.overlay, borderColor: d.strongBorder, borderRadius: radii.dialog, maxWidth: 520, width: '100%', alignSelf: 'center' }]}><Text accessibilityRole="header" style={ui.heading}>{title}</Text><Text style={ui.body}>{message}</Text><Action busy={busy} onPress={onConfirm}>Confirm {title.toLowerCase()}</Action><Action secondary disabled={busy} onPress={onCancel}>Cancel</Action></View></View></Modal>;
}
export async function pickResume(): Promise<DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const failure = validateResumeFile(asset.name, asset.size);
  if (failure) { releasePickedResume(asset); throw new Error(failure); }
  if (asset.mimeType && !['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'].includes(asset.mimeType)) { releasePickedResume(asset); throw new Error('Unsupported resume file type.'); }
  return asset;
}
