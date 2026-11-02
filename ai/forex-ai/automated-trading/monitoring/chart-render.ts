/**
 * Phase 53.1 / 53.3 / 4.18F.7 — Server-rendered multi-panel chart from validated OHLC + indicators.
 * Source: SERVER_OHLC_RENDER — not a Trading Station / broker-platform screenshot.
 * Uses encodeRgbaPng (no canvas/sharp). Draws only validated overlay series.
 */
import { createHash } from "node:crypto";
import { encodeRgbaPng } from "../../../creative-workspace/png-pixels.js";
import type { AtObservationSnapshot } from "../analysis/observation-snapshot.js";

export interface ChartRenderCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isClosed?: boolean;
}

export interface ChartRenderOverlays {
  bid?: number | null;
  ask?: number | null;
  spread?: number | null;
  quoteTsUtc?: string | null;
  tickTsUtc?: string | null;
  observationId?: string | null;
  atrLabel?: string | null;
  rsiValue?: number | null;
  macdValue?: number | null;
  adxValue?: number | null;
  sma9?: Array<number | null>;
  sma21?: Array<number | null>;
  sma50?: Array<number | null>;
  sma200?: Array<number | null>;
  ema9?: Array<number | null>;
  ema21?: Array<number | null>;
  bbUpper?: Array<number | null>;
  bbMid?: Array<number | null>;
  bbLower?: Array<number | null>;
  rsi14?: Array<number | null>;
  macd?: Array<number | null>;
  macdSignal?: Array<number | null>;
  macdHist?: Array<number | null>;
  structureLevels?: Array<{ price: number; label: string }>;
}

export interface ChartRenderInput {
  instrument: string;
  timeframe: string;
  timeframeLabel: string;
  candles: ChartRenderCandle[];
  observationUtc: string;
  width?: number;
  height?: number;
  overlays?: ChartRenderOverlays | null;
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
  imageSourceLabel: "SERVER_OHLC_RENDER";
  note: string;
  candleCount: number;
  closedCount: number;
  formingCount: number;
  firstOpenTimeSec: number | null;
  lastOpenTimeSec: number | null;
  overlaysDrawn: string[];
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

function drawHLine(
  rgba: Buffer,
  width: number,
  y: number,
  x0: number,
  x1: number,
  r: number,
  g: number,
  b: number,
): void {
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  for (let x = lo; x <= hi; x += 1) setPixel(rgba, width, x, y, r, g, b);
}

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
  "+": [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
  "=": [0b00000, 0b00000, 0b11111, 0b00000, 0b11111, 0b00000, 0b00000],
  " ": [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
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

function drawSeries(
  rgba: Buffer,
  width: number,
  values: Array<number | null> | undefined,
  n: number,
  padL: number,
  slot: number,
  yFor: (v: number) => number,
  r: number,
  g: number,
  b: number,
): boolean {
  if (!values || values.length === 0) return false;
  let drawn = false;
  let prevX: number | null = null;
  let prevY: number | null = null;
  for (let i = 0; i < n; i += 1) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) {
      prevX = null;
      prevY = null;
      continue;
    }
    const x = padL + i * slot + slot / 2;
    const y = yFor(v);
    if (prevX != null && prevY != null) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x - prevX, y - prevY)));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        setPixel(rgba, width, prevX + (x - prevX) * t, prevY + (y - prevY) * t, r, g, b);
      }
      drawn = true;
    }
    prevX = x;
    prevY = y;
  }
  return drawn;
}

export function overlaysFromObservationSnapshot(
  snap: AtObservationSnapshot,
): ChartRenderOverlays {
  const s = snap.chartSeries;
  const lastRsi = [...s.rsi14].reverse().find((v) => v != null) ?? null;
  const lastMacd = [...s.macd].reverse().find((v) => v != null) ?? null;
  return {
    bid: snap.quote.bid,
    ask: snap.quote.ask,
    spread: snap.quote.spread,
    quoteTsUtc: snap.quote.sourceTimestampMs
      ? new Date(snap.quote.sourceTimestampMs).toISOString()
      : null,
    tickTsUtc: snap.ticks.lastAcceptedAtMs
      ? new Date(snap.ticks.lastAcceptedAtMs).toISOString()
      : null,
    observationId: snap.observationId,
    atrLabel: "ATR SMA_OF_TR",
    rsiValue: lastRsi,
    macdValue: lastMacd,
    adxValue: snap.technical?.indicators.adx.adx.value ?? null,
    sma9: s.sma9,
    sma21: s.sma21,
    sma50: s.sma50,
    sma200: s.sma200,
    ema9: s.ema9,
    ema21: s.ema21,
    bbUpper: s.bbUpper,
    bbMid: s.bbMid,
    bbLower: s.bbLower,
    rsi14: s.rsi14,
    macd: s.macd,
    macdSignal: s.macdSignal,
    macdHist: s.macdHist,
    structureLevels: snap.structureLevels,
  };
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

  const ov = input.overlays ?? null;
  const width = Math.max(480, Math.min(1100, input.width ?? 860));
  const height = Math.max(320, Math.min(720, input.height ?? 520));
  const padL = 58;
  const padR = 10;
  const padT = 34;
  const padB = 22;
  const gap = 6;
  const chartW = width - padL - padR;
  const usableH = height - padT - padB - gap * 2;
  const priceH = Math.floor(usableH * 0.62);
  const rsiH = Math.floor(usableH * 0.16);
  const macdH = usableH - priceH - rsiH;
  const priceTop = padT;
  const rsiTop = priceTop + priceH + gap;
  const macdTop = rsiTop + rsiH + gap;

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    min = Math.min(min, c.low);
    max = Math.max(max, c.high);
  }
  for (const series of [ov?.bbUpper, ov?.bbLower, ov?.sma200, ov?.sma50]) {
    for (const v of series ?? []) {
      if (v != null && Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  for (const lvl of ov?.structureLevels ?? []) {
    if (Number.isFinite(lvl.price)) {
      min = Math.min(min, lvl.price);
      max = Math.max(max, lvl.price);
    }
  }
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return { ok: false, code: "CHART_RENDER_FAILED", message: "Invalid price range for chart render." };
  }
  const span = max - min || 1;
  const yPrice = (price: number) => priceTop + (1 - (price - min) / span) * priceH;
  const formatAxisPrice = (p: number): string => {
    const a = Math.abs(p);
    if (a >= 1000) return p.toFixed(1);
    if (a >= 100) return p.toFixed(2);
    if (a >= 10) return p.toFixed(3);
    if (a >= 1) return p.toFixed(4);
    return p.toFixed(5);
  };

  const rgba = Buffer.alloc(width * height * 4, 0);
  fillRect(rgba, width, 0, 0, width, height, 18, 22, 28);
  fillRect(rgba, width, padL, priceTop, chartW, priceH, 24, 28, 36);
  fillRect(rgba, width, padL, rsiTop, chartW, rsiH, 22, 26, 34);
  fillRect(rgba, width, padL, macdTop, chartW, macdH, 22, 26, 34);

  const slot = chartW / candles.length;
  let closedCount = 0;
  let formingCount = 0;
  const overlaysDrawn: string[] = ["OHLC"];

  // Bollinger / MA overlays (validated series only)
  if (drawSeries(rgba, width, ov?.bbUpper, candles.length, padL, slot, yPrice, 90, 120, 160)) overlaysDrawn.push("BB");
  drawSeries(rgba, width, ov?.bbMid, candles.length, padL, slot, yPrice, 90, 120, 160);
  drawSeries(rgba, width, ov?.bbLower, candles.length, padL, slot, yPrice, 90, 120, 160);
  if (drawSeries(rgba, width, ov?.sma9, candles.length, padL, slot, yPrice, 80, 200, 220)) overlaysDrawn.push("SMA9");
  if (drawSeries(rgba, width, ov?.sma21, candles.length, padL, slot, yPrice, 220, 180, 80)) overlaysDrawn.push("SMA21");
  if (drawSeries(rgba, width, ov?.sma50, candles.length, padL, slot, yPrice, 160, 120, 220)) overlaysDrawn.push("SMA50");
  if (drawSeries(rgba, width, ov?.sma200, candles.length, padL, slot, yPrice, 220, 100, 100)) overlaysDrawn.push("SMA200");
  if (drawSeries(rgba, width, ov?.ema9, candles.length, padL, slot, yPrice, 100, 220, 160)) overlaysDrawn.push("EMA9");
  if (drawSeries(rgba, width, ov?.ema21, candles.length, padL, slot, yPrice, 180, 220, 100)) overlaysDrawn.push("EMA21");

  for (const lvl of (ov?.structureLevels ?? []).slice(0, 6)) {
    if (!Number.isFinite(lvl.price)) continue;
    const y = yPrice(lvl.price);
    drawHLine(rgba, width, y, padL, padL + chartW, 180, 140, 90);
    drawText(rgba, width, padL + 2, y - 8, String(lvl.label).slice(0, 4), 180, 140, 90);
    if (!overlaysDrawn.includes("STRUCTURE")) overlaysDrawn.push("STRUCTURE");
  }

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
    drawVLine(rgba, width, cx, yPrice(c.high), yPrice(c.low), cr, cg, cb);
    const bodyTop = yPrice(Math.max(c.open, c.close));
    const bodyBot = yPrice(Math.min(c.open, c.close));
    const bodyH = Math.max(1, bodyBot - bodyTop);
    const bodyW = Math.max(2, Math.floor(slot * 0.55));
    fillRect(rgba, width, cx - bodyW / 2, bodyTop, bodyW, bodyH, cr, cg, cb);
  }

  // RSI panel
  const yRsi = (v: number) => rsiTop + (1 - Math.max(0, Math.min(100, v)) / 100) * rsiH;
  drawHLine(rgba, width, yRsi(70), padL, padL + chartW, 80, 80, 90);
  drawHLine(rgba, width, yRsi(30), padL, padL + chartW, 80, 80, 90);
  if (drawSeries(rgba, width, ov?.rsi14, candles.length, padL, slot, yRsi, 120, 200, 255)) {
    overlaysDrawn.push("RSI14");
  }
  drawText(rgba, width, padL + 2, rsiTop + 2, "RSI14", 140, 160, 180);

  // MACD panel
  let macdMin = 0;
  let macdMax = 0;
  for (const series of [ov?.macd, ov?.macdSignal, ov?.macdHist]) {
    for (const v of series ?? []) {
      if (v != null && Number.isFinite(v)) {
        macdMin = Math.min(macdMin, v);
        macdMax = Math.max(macdMax, v);
      }
    }
  }
  if (macdMax === macdMin) {
    macdMax = 1;
    macdMin = -1;
  }
  const macdSpan = macdMax - macdMin || 1;
  const yMacd = (v: number) => macdTop + (1 - (v - macdMin) / macdSpan) * macdH;
  drawHLine(rgba, width, yMacd(0), padL, padL + chartW, 70, 75, 85);
  if (ov?.macdHist) {
    for (let i = 0; i < candles.length; i += 1) {
      const h = ov.macdHist[i];
      if (h == null || !Number.isFinite(h)) continue;
      const x = padL + i * slot + slot / 2;
      const y0 = yMacd(0);
      const y1 = yMacd(h);
      drawVLine(
        rgba,
        width,
        x,
        y0,
        y1,
        h >= 0 ? 46 : 200,
        h >= 0 ? 160 : 70,
        h >= 0 ? 90 : 70,
      );
    }
    overlaysDrawn.push("MACD");
  }
  drawSeries(rgba, width, ov?.macd, candles.length, padL, slot, yMacd, 200, 200, 120);
  drawSeries(rgba, width, ov?.macdSignal, candles.length, padL, slot, yMacd, 120, 160, 220);
  drawText(rgba, width, padL + 2, macdTop + 2, "MACD", 140, 160, 180);

  const title = `${input.instrument} ${input.timeframeLabel}`.slice(0, 36);
  drawText(rgba, width, padL, 8, title, 200, 210, 220);
  drawText(rgba, width, padL + title.length * 6 + 8, 8, "SERVER-OHLC", 140, 160, 180);
  const mid = (min + max) / 2;
  drawText(rgba, width, 2, priceTop - 2, formatAxisPrice(max), 160, 170, 180);
  drawText(rgba, width, 2, priceTop + priceH / 2 - 3, formatAxisPrice(mid), 160, 170, 180);
  drawText(rgba, width, 2, priceTop + priceH - 8, formatAxisPrice(min), 160, 170, 180);

  const bidAsk =
    ov?.bid != null && ov?.ask != null
      ? `B ${formatAxisPrice(ov.bid)} A ${formatAxisPrice(ov.ask)}`
      : "B/A N/A";
  const meta = [
    `OBS ${input.observationUtc.slice(0, 19)}Z`,
    bidAsk,
    ov?.atrLabel ?? "ATR SMA_OF_TR",
    ov?.rsiValue != null ? `RSI ${ov.rsiValue.toFixed(1)}` : null,
    ov?.adxValue != null ? `ADX ${ov.adxValue.toFixed(1)}` : null,
  ].filter(Boolean).join(" | ").slice(0, 90);
  drawText(rgba, width, padL, height - 14, meta, 140, 150, 160);

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
      imageSourceLabel: "SERVER_OHLC_RENDER",
      note:
        "Server-rendered multi-panel chart from validated ForexConnect OHLC + indicators — NOT a broker Trading Station screenshot.",
      candleCount: candles.length,
      closedCount,
      formingCount,
      firstOpenTimeSec: candles[0]?.time ?? null,
      lastOpenTimeSec: candles[candles.length - 1]?.time ?? null,
      overlaysDrawn,
    };
  } catch (err) {
    return {
      ok: false,
      code: "CHART_RENDER_FAILED",
      message: err instanceof Error ? err.message.slice(0, 160) : "Chart PNG encode failed.",
    };
  }
}
