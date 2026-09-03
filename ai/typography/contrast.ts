import type { ContrastStrategy } from "./types.js";

export function contrastForBackground(input: {
  meanLuminance?: number;
  backgroundType?: string;
  complexity?: string;
}): { color: string; contrastStrategy: ContrastStrategy } {
  const dark = (input.meanLuminance != null && input.meanLuminance < 0.45)
    || /dark/i.test(input.backgroundType ?? "");
  const complex = /high|complex|clutter/i.test(input.complexity ?? "")
    || /lifestyle|cluttered/i.test(input.backgroundType ?? "");
  if (complex) {
    return { color: "white", contrastStrategy: "panel" };
  }
  if (dark) {
    return { color: "white", contrastStrategy: "outline" };
  }
  return { color: "white", contrastStrategy: "shadow" };
}
