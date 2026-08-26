/**
 * Convert Electron-picked image payloads into browser File objects for the existing import queue.
 */
export function desktopPicksToFiles(
  picks: Array<{ name: string; mimeType: string; size: number; dataBase64: string; error?: string }>,
): { files: File[]; rejected: Array<{ name: string; reason: string }> } {
  const files: File[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const pick of picks) {
    if (pick.error || !pick.dataBase64) {
      rejected.push({ name: pick.name, reason: pick.error ?? "File could not be read" });
      continue;
    }
    try {
      const binary = atob(pick.dataBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      files.push(new File([bytes], pick.name, { type: pick.mimeType || "application/octet-stream" }));
    } catch {
      rejected.push({ name: pick.name, reason: "Could not decode image data" });
    }
  }
  return { files, rejected };
}
