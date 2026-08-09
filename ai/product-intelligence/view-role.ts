import type { ProductViewRole } from "./types.js";

/** Infer a product view role from an uploaded image file name. */
export function detectViewRole(fileName: string): ProductViewRole {
  const lower = fileName.toLowerCase();
  if (/\bfront\b|frontal|_f\./.test(lower)) return "front";
  if (/\bback\b|rear|_b\./.test(lower)) return "back";
  if (/\bleft\b|_l\./.test(lower)) return "left";
  if (/\bright\b|_r\./.test(lower)) return "right";
  if (/\btop\b|overhead|bird.?eye/.test(lower)) return "top";
  if (/\bbottom\b|underside|base.?view/.test(lower)) return "bottom";
  if (/close[-_ ]?up|macro/.test(lower)) return "close-up";
  if (/\bdetail\b|texture|logo.?shot/.test(lower)) return "detail";
  if (/\bside\b/.test(lower)) return "side";
  return "unknown";
}
