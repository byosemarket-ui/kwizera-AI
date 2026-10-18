/**
 * Phase 53.1 — Server-rendered candlestick PNG from validated OHLC.
 * Not a browser screenshot. Uses existing encodeRgbaPng (no canvas/sharp).
 */
import { createHash } from "node:crypto";
import { encodeRgbaPng } from "../../../creative-workspace/png-pixels.js";

export interface ChartRenderCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isClosed?: boolean;
}

export interface ChartRenderInput {
  instrument: string;
  timeframe: string;
  timeframeLabel: string;
  candles: ChartRenderCandle[];
  observationUtc: string;
  width?: number;
  height?: number;
}

export interface ChartRenderResult {
  ok: true;
  png: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  byteLength: number;
  imageHash: string;
  source: "server-ohlc-render";
  note: string;
  candleCount: number;
  closedCount: number;
  formingCount: number;
  firstOpenTimeSec: number | null;
  lastOpenTimeSec: number | null;
}

export interface ChartRenderFailure {
  ok: false;
  code: "CHART_RENDER_INSUFFICIENT" | "CHART_RENDER_FAILED";
  message: string;
}

function fillRect(
  rgba: Buffer,
  width: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const x1 = Math.min(width, Math.max(0, Math.floor(x0 + w)));
  const y1 = Math.min(rgba.length / (width * 4), Math.max(0, Math.floor(y0 + h)));
  const xs = Math.max(0, Math.floor(x0));
  const ys = Math.max(0, Math.floor(y0));
  for (let y = ys; y < y1; y += 1) {
    for (let x = xs; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
}

function setPixel(
  rgba: Buffer,
  width: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= width) return;
  const i = (yi * width + xi) * 4;
  if (i < 0 || i + 3 >= rgba.length) return;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function drawVLine(
  rgba: Buffer,
  width: number,
  x: number,
  y0: number,
  y1: number,
  r: number,
  g: number,
  b: number,
): void {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  for (let y = lo; y <= hi; y += 1) setPixel(rgba, width, x, y, r, g, b);
}

/** Simple 5x7 bitmap digits/letters for labels (ASCII subset). */
const GLYPH: Record<string, number[]> = {
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  ".": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b00100],
  ":": [0b00000, 0b00100, 0b00100, 0b00000, 0b00100, 0b00100, 0b00000],
  "/": [0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b00000, 0b00000],
  "-": [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  " ": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
};

function drawText(
  rgba: Buffer,
  width: number,
  x: number,
  y: number,
  text: string,
  r = 220,
  g = 230,
  b = 240,
): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const rows = GLYPH[ch] ?? GLYPH[" "]!;
    for (let row = 0; row < 7; row += 1) {
      const bits = rows[row] ?? 0;
      for (let col = 0; col < 5; col += 1) {
        if (bits & (1 << (4 - col))) setPixel(rgba, width, cx + col, y + row, r, g, b);
      }
    }
    cx += 6;
  }
}

export function renderAtMarketChartPng(
  input: ChartRenderInput,
): ChartRenderResult | ChartRenderFailure {
  const candles = (input.candles ?? [])
    .filter((c) =>
      Number.isFinite(c.open)
      && Number.isFinite(c.high)
      && Number.isFinite(c.low)
      && Number.isFinite(c.close)
      && Number.isFinite(c.time)
    )
    .slice(-80);
  if (candles.length < 8) {
    return {
      ok: false,
      code: "CHART_RENDER_INSUFFICIENT",
      message: "Need at least 8 validated OHLC candles to render a server chart image.",
    };
  }

  const width = Math.max(320, Math.min(960, input.width ?? 640));
  const height = Math.max(200, Math.min(540, input.height ?? 360));
  const padL = 8;
  const padR = 8;
  const padT = 28;
  const padB = 18;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    min = Math.min(min, c.low);
    max = Math.max(max, c.high);
  }
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return { ok: false, code: "CHART_RENDER_FAILED", message: "Invalid price range for chart render." };
  }
  const span = max - min || 1;
  const yFor = (price: number) => padT + (1 - (price - min) / span) * chartH;

  const rgba = Buffer.alloc(width * height * 4, 0);
  fillRect(rgba, width, 0, 0, width, height, 18, 22, 28);
  fillRect(rgba, width, padL, padT, chartW, chartH, 24, 28, 36);

  const slot = chartW / candles.length;
  let closedCount = 0;
  let formingCount = 0;
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i]!;
    const closed = c.isClosed !== false;
    if (closed) closedCount += 1;
    else formingCount += 1;
    const cx = padL + i * slot + slot / 2;
    const bull = c.close >= c.open;
    const r = bull ? 46 : 200;
    const g = bull ? 160 : 70;
    const b = bull ? 90 : 70;
    const alphaNote = closed ? 1 : 0.55;
    const cr = Math.round(r * alphaNote + 24 * (1 - alphaNote));
    const cg = Math.round(g * alphaNote + 28 * (1 - alphaNote));
    const cb = Math.round(b * alphaNote + 36 * (1 - alphaNote));
    drawVLine(rgba, width, cx, yFor(c.high), yFor(c.low), cr, cg, cb);
    const bodyTop = yFor(Math.max(c.open, c.close));
    const bodyBot = yFor(Math.min(c.open, c.close));
    const bodyH = Math.max(1, bodyBot - bodyTop);
    const bodyW = Math.max(2, Math.floor(slot * 0.55));
    fillRect(rgba, width, cx - bodyW / 2, bodyTop, bodyW, bodyH, cr, cg, cb);
  }

  const title = `${input.instrument} ${input.timeframeLabel}`.slice(0, 40);
  drawText(rgba, width, padL, 8, title, 200, 210, 220);
  const obs = `OBS ${input.observationUtc.slice(0, 19)}Z SERVER-OHLC`.slice(0, 52);
  drawText(rgba, width, padL, height - 12, obs, 140, 150, 160);

  try {
    const png = encodeRgbaPng(width, height, rgba);
    const imageHash = createHash("sha256").update(png).digest("hex").slice(0, 24);
    return {
      ok: true,
      png,
      mimeType: "image/png",
      width,
      height,
      byteLength: png.length,
      imageHash,
      source: "server-ohlc-render",
      note: "Server-rendered candlestick from validated ForexConnect OHLC — not a browser screenshot.",
      candleCount: candles.length,
      closedCount,
      formingCount,
      firstOpenTimeSec: candles[0]?.time ?? null,
      lastOpenTimeSec: candles[candles.length - 1]?.time ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      code: "CHART_RENDER_FAILED",
      message: err instanceof Error ? err.message.slice(0, 160) : "Chart PNG encode failed.",
    };
  }
}
