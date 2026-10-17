/**
 * Phase 49B — Selection fingerprint (client + server shared).
 * Changing the selected set invalidates any prior confirmation.
 */
import { createHash } from "node:crypto";
import {
  MULTI_IMAGE_MAX_CAPTURES,
  MULTI_IMAGE_MIN_CAPTURES,
} from "./limits.js";

export function normalizeCaptureIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  return [...new Set(ids)];
}

export function computeSelectionFingerprint(captureIds: string[]): string {
  const sorted = [...normalizeCaptureIds(captureIds)].sort();
  return createHash("sha256").update(sorted.join("|"), "utf8").digest("hex");
}

export function validateCaptureIdList(raw: unknown): {
  ok: true;
  captureIds: string[];
  fingerprint: string;
} | { ok: false; error: string } {
  const captureIds = normalizeCaptureIds(raw);
  if (captureIds.length < MULTI_IMAGE_MIN_CAPTURES) {
    return { ok: false, error: "Select at least one chart capture." };
  }
  if (captureIds.length > MULTI_IMAGE_MAX_CAPTURES) {
    return {
      ok: false,
      error: `At most ${MULTI_IMAGE_MAX_CAPTURES} images may be sent. Reduce the selection.`,
    };
  }
  return {
    ok: true,
    captureIds,
    fingerprint: computeSelectionFingerprint(captureIds),
  };
}
