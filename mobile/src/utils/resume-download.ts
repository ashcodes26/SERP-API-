import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function downloadResume(bytes: ArrayBuffer, filename: string, mime: string) {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device. Your saved revision is preserved.');
  const file = new File(Paths.cache, filename);
  try {
    file.create({ overwrite: true }); file.write(new Uint8Array(bytes));
    await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Save your approved resume', UTI: filename.endsWith('.docx') ? 'org.openxmlformats.wordprocessingml.document' : 'public.plain-text' });
  } finally { if (file.exists) file.delete(); }
}
