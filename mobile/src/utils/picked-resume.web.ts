import type { DocumentPickerAsset } from 'expo-document-picker';
export function releasePickedResume(asset: DocumentPickerAsset) {
  if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
}
