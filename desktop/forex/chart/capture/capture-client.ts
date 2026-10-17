/**
 * Phase 49A — Client API helpers for chart captures (no secrets).
 */
import type {
  ChartCaptureListItem,
  ChartCaptureRecord,
  ChartCaptureSessionConfig,
  ChartCaptureSessionState,
} from "../../../../ai/forex-chart-capture/types";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, error: { message: "Invalid JSON response." } };
  }
}

export async function fetchCaptureMeta(): Promise<Record<string, unknown>> {
  const res = await fetch("/api/forex/chart-captures/meta");
  return parseJson(res);
}

export async function listCaptures(params?: {
  limit?: number;
  instrument?: string;
  timeframe?: string;
  sessionId?: string;
  mode?: string;
}): Promise<{ ok: boolean; items: ChartCaptureListItem[]; error?: string }> {
  const q = new URLSearchParams();
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.instrument) q.set("instrument", params.instrument);
  if (params?.timeframe) q.set("timeframe", params.timeframe);
  if (params?.sessionId) q.set("sessionId", params.sessionId);
  if (params?.mode) q.set("mode", params.mode);
  const res = await fetch(`/api/forex/chart-captures?${q.toString()}`);
  const body = await parseJson(res);
  if (!res.ok || body.ok === false) {
    const err = body.error as { message?: string } | undefined;
    return { ok: false, items: [], error: err?.message ?? `List failed (${res.status})` };
  }
  return { ok: true, items: Array.isArray(body.items) ? body.items as ChartCaptureListItem[] : [] };
}

export async function uploadCapture(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  capture?: ChartCaptureRecord;
  error?: string;
}> {
  const res = await fetch("/api/forex/chart-captures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!res.ok || body.ok === false) {
    const err = body.error as { message?: string } | undefined;
    return { ok: false, error: err?.message ?? `Upload failed (${res.status})` };
  }
  return { ok: true, capture: body.capture as ChartCaptureRecord };
}

export async function deleteCapture(captureId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/forex/chart-captures/${encodeURIComponent(captureId)}`, {
    method: "DELETE",
  });
  const body = await parseJson(res);
  if (!res.ok || body.ok === false) {
    const err = body.error as { message?: string } | undefined;
    return { ok: false, error: err?.message ?? `Delete failed (${res.status})` };
  }
  return { ok: true };
}

export async function setCaptureSelected(
  captureId: string,
  selectedForAi: boolean,
): Promise<{ ok: boolean; capture?: ChartCaptureRecord; error?: string }> {
  const res = await fetch(`/api/forex/chart-captures/${encodeURIComponent(captureId)}/selection`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedForAi }),
  });
  const body = await parseJson(res);
  if (!res.ok || body.ok === false) {
    const err = body.error as { message?: string } | undefined;
    return { ok: false, error: err?.message ?? `Selection update failed (${res.status})` };
  }
  return { ok: true, capture: body.capture as ChartCaptureRecord };
}

export function captureImageUrl(captureId: string): string {
  return `/api/forex/chart-captures/${encodeURIComponent(captureId)}/image`;
}

export async function createCaptureSession(
  config: ChartCaptureSessionConfig,
): Promise<{ ok: boolean; session?: ChartCaptureSessionState; error?: string }> {
  const res = await fetch("/api/forex/chart-captures/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config }),
  });
  const body = await parseJson(res);
  if (!res.ok || body.ok === false) {
    const err = body.error as { message?: string } | undefined;
    return { ok: false, error: err?.message ?? `Session create failed (${res.status})` };
  }
  return { ok: true, session: body.session as ChartCaptureSessionState };
}

export async function patchCaptureSession(
  sessionId: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; session?: ChartCaptureSessionState; error?: string }> {
  const res = await fetch(`/api/forex/chart-captures/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await parseJson(res);
  if (!res.ok || json.ok === false) {
    const err = json.error as { message?: string } | undefined;
    return { ok: false, error: err?.message ?? `Session update failed (${res.status})` };
  }
  return { ok: true, session: json.session as ChartCaptureSessionState };
}

export function canvasToPngBase64(canvas: HTMLCanvasElement): {
  ok: true;
  base64: string;
  width: number;
  height: number;
  byteLength: number;
} | { ok: false; error: string } {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!match) return { ok: false, error: "Chart export did not produce a PNG data URL." };
    const base64 = match[1];
    const byteLength = Math.floor((base64.length * 3) / 4)
      - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    return {
      ok: true,
      base64,
      width: canvas.width,
      height: canvas.height,
      byteLength,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to encode chart screenshot.",
    };
  }
}
