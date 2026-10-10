import { File, Paths } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';

export function releasePickedResume(asset: DocumentPickerAsset) {
  // Only remove the picker-created copy in this app's cache, never an external source.
  if (asset.uri.startsWith(Paths.cache.uri)) {
    const temporary = new File(asset.uri);
    if (temporary.exists) temporary.delete();
  }
}
