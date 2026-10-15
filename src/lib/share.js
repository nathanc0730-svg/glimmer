/**
 * Opens the iOS share sheet for a file (Save to Files, AirDrop, Photos…). Falls back to a
 * download where file sharing isn't supported. Must be called straight from a tap.
 * Resolves true if she completed the share/download, false if she cancelled.
 */
export async function shareFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err?.name !== 'AbortError') console.warn(err);
      return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
