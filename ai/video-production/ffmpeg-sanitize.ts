/** Normalize on-screen copy before FFmpeg drawtext. Never pass raw objects into a filter. */
export function sanitizeRenderText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return "";
  return String(value)
    .replace(/\[object Object\]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\\/g, "")
    .replace(/'/g, "\u2019")
    .replace(/:/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 120);
}
