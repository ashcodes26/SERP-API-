import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Action, ui } from '@/components/career-ui';
import { design as d } from '@/constants/design';
import { validateResumeFile } from '@/utils/resume-workspace';

export function Check({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={checked} aria-disabled={disabled} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={[ui.row, { paddingVertical: 8, minHeight: 44 }]}><Text style={ui.body}>{checked ? '☑' : '☐'}</Text><Text style={[ui.body, { flex: 1 }]}>{label}</Text></Pressable>;
}
export function Field({ label, value, onChange, multiline = false, disabled = false, maxLength = 20000, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; disabled?: boolean; maxLength?: number; placeholder?: string }) {
  return <View style={{ gap: 8 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} editable={!disabled} maxLength={maxLength} placeholder={placeholder} placeholderTextColor={d.muted} autoCapitalize="none" style={[ui.input, multiline && { minHeight: 160, textAlignVertical: 'top' }]} /></View>;
}
export function Confirm({ title, message, onConfirm, onCancel, busy = false }: { title: string; message: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return <Modal visible transparent animationType="fade" onRequestClose={onCancel}><View style={{ flex: 1, backgroundColor: '#030617cc', justifyContent: 'center', padding: 24 }}><View accessibilityViewIsModal style={[ui.card, { maxWidth: 520, width: '100%', alignSelf: 'center' }]}><Text style={ui.heading}>{title}</Text><Text style={ui.body}>{message}</Text><Action disabled={busy} onPress={onConfirm}>Confirm {title.toLowerCase()}</Action><Action secondary disabled={busy} onPress={onCancel}>Cancel</Action></View></View></Modal>;
}
export async function pickResume(): Promise<DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const failure = validateResumeFile(asset.name, asset.size);
  if (failure) throw new Error(failure);
  if (asset.mimeType && !['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'].includes(asset.mimeType)) throw new Error('Unsupported resume file type.');
  return asset;
}
