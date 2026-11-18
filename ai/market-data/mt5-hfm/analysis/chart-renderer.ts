/**
 * Backend HFM Analysis candlestick PNG renderer (no browser / Chromium).
 */
import { createHash } from "node:crypto";
import {
  HFM_ANALYSIS_CHART_DISPLAY_CANDLES,
  HFM_ANALYSIS_IMAGE_HEIGHT,
  HFM_ANALYSIS_IMAGE_MAX_BYTES,
  HFM_ANALYSIS_IMAGE_WIDTH,
  HFM_ANALYSIS_PROVIDER,
  HFM_ANALYSIS_RENDERER_VERSION,
} from "./constants.js";
import { encodeRgbaPng, isValidPngBuffer } from "./png-encode.js";
import type { HfmAnalysisChartImageMeta, HfmAnalysisNormalizedCandle } from "./types.js";

const BG = [18, 22, 28, 255] as const;
const GRID = [40, 48, 58, 255] as const;
const BULL = [46, 204, 113, 255] as const;
const BEAR = [231, 76, 60, 255] as const;
const TEXT = [220, 228, 236, 255] as const;
const AXIS = [120, 132, 148, 255] as const;

/** Minimal 5x7 glyphs for A-Z 0-9 .:- / space */
const GLYPHS: Record<string, number[]> = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 31, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 4, 0],
  ":": [0, 4, 0, 0, 0, 4, 0],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [1, 1, 1, 1, 17, 17, 14],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
};

function setPx(buf: Buffer, w: number, x: number, y: number, rgba: readonly number[]): void {
  if (x < 0 || y < 0 || x >= w) return;
  const h = buf.length / (w * 4);
  if (y >= h) return;
  const i = (y * w + x) * 4;
  buf[i] = rgba[0]!;
  buf[i + 1] = rgba[1]!;
  buf[i + 2] = rgba[2]!;
  buf[i + 3] = rgba[3]!;
}

function fillRect(
  buf: Buffer,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: readonly number[],
): void {
  const xa = Math.max(0, Math.min(x0, x1));
  const xb = Math.min(w - 1, Math.max(x0, x1));
  const h = buf.length / (w * 4);
  const ya = Math.max(0, Math.min(y0, y1));
  const yb = Math.min(h - 1, Math.max(y0, y1));
  for (let y = ya; y <= yb; y += 1) {
    for (let x = xa; x <= xb; x += 1) setPx(buf, w, x, y, rgba);
  }
}

function drawText(
  buf: Buffer,
  w: number,
  x: number,
  y: number,
  text: string,
  rgba: readonly number[],
  scale = 1,
): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "]!;
    for (let row = 0; row < 7; row += 1) {
      const bits = g[row]!;
      for (let col = 0; col < 5; col += 1) {
        if (bits & (16 >> col)) {
          fillRect(
            buf,
            w,
            cx + col * scale,
            y + row * scale,
            cx + col * scale + scale - 1,
            y + row * scale + scale - 1,
            rgba,
          );
        }
      }
    }
    cx += 6 * scale;
  }
}

function formatPrice(p: number): string {
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(5);
}

function formatTime(sec: number): string {
  const d = new Date(sec * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export interface RenderChartInput {
  symbol: string;
  timeframe: string;
  candles: HfmAnalysisNormalizedCandle[];
  snapshotId: string;
  snapshotHash: string;
  capturedAt: string;
  width?: number;
  height?: number;
  displayCount?: number;
}

export interface RenderChartResult {
  ok: boolean;
  png: Buffer | null;
  meta: HfmAnalysisChartImageMeta | null;
  error: string | null;
  renderMs: number;
}

export function renderHfmAnalysisCandlestickPng(input: RenderChartInput): RenderChartResult {
  const started = Date.now();
  const width = input.width ?? HFM_ANALYSIS_IMAGE_WIDTH;
  const height = input.height ?? HFM_ANALYSIS_IMAGE_HEIGHT;
  const displayCount = input.displayCount ?? HFM_ANALYSIS_CHART_DISPLAY_CANDLES;

  try {
    if (!input.candles.length) {
      return {
        ok: false,
        png: null,
        meta: null,
        error: "No candles to render",
        renderMs: Date.now() - started,
      };
    }

    const slice = input.candles.slice(-displayCount);
    const rgba = Buffer.alloc(width * height * 4);
    // background
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = BG[0];
      rgba[i + 1] = BG[1];
      rgba[i + 2] = BG[2];
      rgba[i + 3] = BG[3];
    }

    const padL = 72;
    const padR = 16;
    const padT = 40;
    const padB = 36;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    let minP = Infinity;
    let maxP = -Infinity;
    for (const c of slice) {
      minP = Math.min(minP, c.low);
      maxP = Math.max(maxP, c.high);
    }
    if (!Number.isFinite(minP) || !Number.isFinite(maxP) || maxP <= minP) {
      maxP = minP + 1e-6;
    }
    const pad = (maxP - minP) * 0.05;
    minP -= pad;
    maxP += pad;

    // grid
    for (let g = 0; g <= 4; g += 1) {
      const y = padT + Math.round((plotH * g) / 4);
      fillRect(rgba, width, padL, y, width - padR, y, GRID);
      const price = maxP - ((maxP - minP) * g) / 4;
      drawText(rgba, width, 4, y - 4, formatPrice(price), AXIS, 1);
    }

    const n = slice.length;
    const slot = plotW / Math.max(1, n);
    for (let i = 0; i < n; i += 1) {
      const c = slice[i]!;
      const cx = padL + slot * (i + 0.5);
      const yHigh = padT + ((maxP - c.high) / (maxP - minP)) * plotH;
      const yLow = padT + ((maxP - c.low) / (maxP - minP)) * plotH;
      const yOpen = padT + ((maxP - c.open) / (maxP - minP)) * plotH;
      const yClose = padT + ((maxP - c.close) / (maxP - minP)) * plotH;
      const bull = c.close >= c.open;
      const color = bull ? BULL : BEAR;
      const x = Math.round(cx);
      fillRect(rgba, width, x, Math.round(yHigh), x, Math.round(yLow), color);
      const bodyTop = Math.round(Math.min(yOpen, yClose));
      const bodyBot = Math.round(Math.max(yOpen, yClose));
      const half = Math.max(1, Math.floor(slot * 0.3));
      fillRect(rgba, width, x - half, bodyTop, x + half, Math.max(bodyTop + 1, bodyBot), color);
    }

    // time labels
    const first = slice[0]!;
    const last = slice[slice.length - 1]!;
    drawText(rgba, width, padL, height - 22, formatTime(first.timestamp), AXIS, 1);
    const lastLabel = formatTime(last.timestamp);
    drawText(rgba, width, width - padR - lastLabel.length * 6 - 4, height - 22, lastLabel, AXIS, 1);

    const title = `${input.symbol} ${input.timeframe}  ${HFM_ANALYSIS_PROVIDER}`;
    drawText(rgba, width, padL, 10, title, TEXT, 2);
    drawText(rgba, width, padL, 28, `CAPTURE ${input.capturedAt.slice(0, 19)}Z`, AXIS, 1);

    const png = encodeRgbaPng(width, height, rgba);
    if (!isValidPngBuffer(png)) {
      return {
        ok: false,
        png: null,
        meta: null,
        error: "PNG encode produced invalid buffer",
        renderMs: Date.now() - started,
      };
    }
    if (png.length > HFM_ANALYSIS_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        png: null,
        meta: null,
        error: `PNG exceeds max size ${HFM_ANALYSIS_IMAGE_MAX_BYTES}`,
        renderMs: Date.now() - started,
      };
    }

    const imageHash = createHash("sha256").update(png).digest("hex");
    const imageId = createHash("sha256")
      .update(`${input.snapshotId}:${input.timeframe}:${imageHash}`)
      .digest("hex")
      .slice(0, 32);

    const meta: HfmAnalysisChartImageMeta = {
      imageId,
      provider: HFM_ANALYSIS_PROVIDER,
      symbol: input.symbol.toUpperCase(),
      timeframe: input.timeframe.toUpperCase(),
      snapshotId: input.snapshotId,
      snapshotHash: input.snapshotHash,
      imageHash,
      capturedAt: input.capturedAt,
      candleStart: first.timestamp,
      candleEnd: last.timestamp,
      imageFormat: "png",
      imageWidth: width,
      imageHeight: height,
      imageSizeBytes: png.length,
      rendererVersion: HFM_ANALYSIS_RENDERER_VERSION,
      validationStatus: "ok",
      validationErrors: [],
    };

    return { ok: true, png, meta, error: null, renderMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      png: null,
      meta: null,
      error: err instanceof Error ? err.message : String(err),
      renderMs: Date.now() - started,
    };
  }
}
