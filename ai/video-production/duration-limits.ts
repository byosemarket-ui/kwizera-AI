/**
 * Pure timing limits shared by the render pipeline and customer workspaces (no Node imports).
 */

/** ENGINE 1 standard renders append a professional end card of this length after the scenes. */
export const END_CARD_DURATION_MS = 5000;

/** Cinematic image-to-video clips are generated per scene within this range and concatenated as-is. */
export const I2V_MIN_CLIP_SECONDS = 2;
export const I2V_MAX_CLIP_SECONDS = 10;
