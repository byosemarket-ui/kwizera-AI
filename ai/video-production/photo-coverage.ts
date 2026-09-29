import type { VideoTimelineClip } from "./types.js";

/** Primary photo keeps at least this much of a montage scene; each extra photo gets at least one frame slot. */
export const MONTAGE_PRIMARY_MIN_MS = 1_000;
export const MONTAGE_FRAME_MS = 400;
export const MONTAGE_FRAME_MIN_MS = 250;

export interface PhotoCoverage {
  requestedPhotoCount: number;
  usedPhotoCount: number;
  omittedPhotoCount: number;
  /** Photos shown as their own scene vs. as montage frames inside a scene. */
  scenePhotoCount: number;
  montagePhotoCount: number;
  montageSceneCount: number;
  strategy: "ONE_PHOTO_PER_SCENE" | "SCENES_AND_MONTAGE" | "INSUFFICIENT_DURATION" | "NO_PHOTOS";
  /** What the last final render actually drew (planned coverage can differ, e.g. cinematic scenes). */
  rendered?: { requestedPhotoCount: number; usedPhotoCount: number; omittedPhotoCount: number; renderJobId: string };
}

export function renderedPhotoCoverage(validPhotoIds: string[], renderedIds: string[], renderJobId: string): NonNullable<PhotoCoverage["rendered"]> {
  const requested = [...new Set(validPhotoIds)];
  const drawn = new Set(renderedIds);
  const usedPhotoCount = requested.filter((id) => drawn.has(id)).length;
  return { requestedPhotoCount: requested.length, usedPhotoCount, omittedPhotoCount: requested.length - usedPhotoCount, renderJobId };
}

function closingScene(clip: VideoTimelineClip): boolean {
  return clip.text.some((layer) => layer.kind === "cta" || layer.kind === "price" || layer.kind === "price_was" || layer.kind === "price_save")
    || /call to action|\bcta\b/i.test(clip.purpose);
}

function capacity(clip: VideoTimelineClip, frameMs: number): number {
  return montageCapacity(clip.durationMs, frameMs);
}

export function montageCapacity(durationMs: number, frameMs = MONTAGE_FRAME_MIN_MS): number {
  return Math.max(0, Math.floor((durationMs - MONTAGE_PRIMARY_MIN_MS) / frameMs));
}

/**
 * Guarantees every valid customer photo is on screen: photos not already a scene's primary image are
 * distributed as montage frames over showcase scenes (closing price/CTA scenes only when needed).
 * Scene durations never change, so audio, beat sync and duration contracts are unaffected.
 */
export function ensurePhotoCoverage(
  clips: VideoTimelineClip[],
  validPhotoIds: string[],
): { clips: VideoTimelineClip[]; coverage: PhotoCoverage } {
  const requested = [...new Set(validPhotoIds)];
  const valid = new Set(requested);
  const next = clips.map((clip) => {
    const { montageAssetIds: _drop, ...rest } = clip;
    return rest as VideoTimelineClip;
  });
  const primary = new Set(next.map((clip) => clip.assetId).filter((id) => valid.has(id)));
  const uncovered = requested.filter((id) => !primary.has(id));
  const assign = (frameMs: number): string[] | null => {
    const showcase = next.map((clip, index) => ({ clip, index })).filter(({ clip }) => !closingScene(clip));
    const closing = next.map((clip, index) => ({ clip, index })).filter(({ clip }) => closingScene(clip));
    const slots = new Map<number, number>();
    for (const { clip, index } of [...showcase, ...closing]) slots.set(index, capacity(clip, frameMs));
    const order = [...showcase, ...closing].map(({ index }) => index);
    const showcaseCapacity = showcase.reduce((sum, { index }) => sum + slots.get(index)!, 0);
    const pool = showcaseCapacity >= uncovered.length ? showcase.map(({ index }) => index) : order;
    const total = pool.reduce((sum, index) => sum + slots.get(index)!, 0);
    if (total < uncovered.length) return null;
    const lists = new Map<number, string[]>();
    let cursor = 0;
    for (const id of uncovered) {
      for (let tries = 0; tries < pool.length; tries += 1) {
        const index = pool[cursor % pool.length]!;
        cursor += 1;
        const used = lists.get(index)?.length ?? 0;
        if (used < slots.get(index)!) {
          lists.set(index, [...(lists.get(index) ?? []), id]);
          break;
        }
      }
    }
    for (const [index, ids] of lists) next[index] = { ...next[index]!, montageAssetIds: ids };
    return [...lists.values()].flat();
  };
  const placed = uncovered.length ? (assign(MONTAGE_FRAME_MS) ?? assign(MONTAGE_FRAME_MIN_MS) ?? partial()) : [];

  function partial(): string[] {
    const ids: string[] = [];
    next.forEach((clip, index) => {
      const room = capacity(clip, MONTAGE_FRAME_MIN_MS);
      const take = uncovered.slice(ids.length, ids.length + room);
      if (take.length) {
        next[index] = { ...clip, montageAssetIds: take };
        ids.push(...take);
      }
    });
    return ids;
  }

  const montagePhotoCount = new Set(placed).size;
  const usedPhotoCount = primary.size + montagePhotoCount;
  const omittedPhotoCount = requested.length - usedPhotoCount;
  const montageSceneCount = next.filter((clip) => clip.montageAssetIds?.length).length;
  return {
    clips: next,
    coverage: {
      requestedPhotoCount: requested.length,
      usedPhotoCount,
      omittedPhotoCount,
      scenePhotoCount: primary.size,
      montagePhotoCount,
      montageSceneCount,
      strategy: !requested.length
        ? "NO_PHOTOS"
        : omittedPhotoCount > 0
          ? "INSUFFICIENT_DURATION"
          : montagePhotoCount > 0 ? "SCENES_AND_MONTAGE" : "ONE_PHOTO_PER_SCENE",
    },
  };
}

/** Splits a montage scene into primary + frame durations that sum exactly to the scene duration. */
export function montageFrameDurations(durationMs: number, frameCount: number): number[] {
  if (frameCount <= 0) return [durationMs];
  const primary = Math.max(MONTAGE_PRIMARY_MIN_MS, Math.round(durationMs * 0.4));
  const primaryMs = Math.min(primary, durationMs - frameCount * MONTAGE_FRAME_MIN_MS);
  const rest = durationMs - primaryMs;
  const each = Math.floor(rest / frameCount);
  const frames = Array.from({ length: frameCount }, (_, i) => (i === frameCount - 1 ? rest - each * (frameCount - 1) : each));
  return [primaryMs, ...frames];
}
