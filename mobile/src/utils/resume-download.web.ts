export async function downloadResume(bytes: ArrayBuffer, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  // Revoke after the browser has received the download; no remote/public file URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
