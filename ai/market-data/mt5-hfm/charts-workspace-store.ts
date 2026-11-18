/**
 * STEP 3 — durable HFM Charts drawings + templates (Admin-scoped file store).
 * No tokens/credentials. No candle/price fabrication.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveHfmChartsWorkspaceDir(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "charts-workspace");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

const DRAWING_TOOLS = new Set([
  "hline",
  "vline",
  "trendline",
  "rectangle",
  "text",
  "channel",
  "fib_retracement",
  "fib_extension",
]);

const LINE_STYLES = new Set(["solid", "dashed", "dotted"]);

export interface HfmChartWorkspaceDrawing {
  id: string;
  tool: string;
  symbol: string;
  timeframe: string;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  visible: boolean;
  locked?: boolean;
  label?: string;
  [key: string]: unknown;
}

export interface HfmChartTemplate {
  id: string;
  name: string;
  chartType: string;
  showGrid: boolean;
  indicators: Array<Record<string, unknown>>;
  preferences?: Record<string, unknown>;
  updatedAt: string;
  isDefault?: boolean;
}

/** Workspace preferences — no candles, quotes, or credentials. */
export interface HfmChartWorkspacePreferences {
  chartType: "candlestick" | "ohlc" | "line" | "area";
  showGrid: boolean;
  defaultTimeframe: string;
  lastSymbol: string | null;
  indicators: Array<Record<string, unknown>>;
  updatedAt: string;
  /** Monotonic revision for optimistic concurrency on preference writes. */
  revision: number;
}

export interface HfmChartsWorkspacePayload {
  provider: "HFM_MT5";
  version: 1 | 2;
  updatedAt: string;
  drawings: HfmChartWorkspaceDrawing[];
  templates: HfmChartTemplate[];
  defaultTemplateId: string | null;
  preferences: HfmChartWorkspacePreferences | null;
  /** Per symbol:timeframe revision for concurrent drawing saves. */
  drawingRevisions: Record<string, number>;
}

function emptyPreferences(): HfmChartWorkspacePreferences {
  return {
    chartType: "candlestick",
    showGrid: true,
    defaultTimeframe: "H4",
    lastSymbol: null,
    indicators: [],
    updatedAt: new Date().toISOString(),
    revision: 1,
  };
}

function emptyPayload(): HfmChartsWorkspacePayload {
  return {
    provider: "HFM_MT5",
    version: 2,
    updatedAt: new Date().toISOString(),
    drawings: [],
    templates: [],
    defaultTemplateId: null,
    preferences: null,
    drawingRevisions: {},
  };
}

const CHART_TYPES = new Set(["candlestick", "ohlc", "line", "area"]);

export function validateHfmChartPreferences(raw: unknown): HfmChartWorkspacePreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const chartType = typeof p.chartType === "string" && CHART_TYPES.has(p.chartType)
    ? (p.chartType as HfmChartWorkspacePreferences["chartType"])
    : "candlestick";
  const defaultTimeframe =
    typeof p.defaultTimeframe === "string" && p.defaultTimeframe.trim()
      ? p.defaultTimeframe.trim().toUpperCase().slice(0, 8)
      : "H4";
  const lastSymbol =
    typeof p.lastSymbol === "string" && p.lastSymbol.trim()
      ? p.lastSymbol.trim().toUpperCase().slice(0, 32)
      : null;
  const indicators = Array.isArray(p.indicators)
    ? p.indicators
        .filter((x) => x && typeof x === "object")
        .map((x) => {
          const row = { ...(x as Record<string, unknown>) };
          delete row.bars;
          delete row.candles;
          delete row.prices;
          delete row.bid;
          delete row.ask;
          return row;
        })
        .slice(0, 40)
    : [];
  const revision =
    typeof p.revision === "number" && Number.isFinite(p.revision) && p.revision >= 0
      ? Math.floor(p.revision)
      : 1;
  return {
    chartType,
    showGrid: p.showGrid !== false,
    defaultTimeframe,
    lastSymbol,
    indicators,
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
    revision,
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validatePoint(p: unknown): boolean {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return isFiniteNumber(o.time) && isFiniteNumber(o.price);
}

/** Validate and sanitize a drawing; returns null if corrupted. */
export function validateHfmChartDrawing(raw: unknown): HfmChartWorkspaceDrawing | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const id = typeof d.id === "string" ? d.id.trim() : "";
  const tool = typeof d.tool === "string" ? d.tool : "";
  const symbol = typeof d.symbol === "string" ? d.symbol.trim().toUpperCase() : "";
  const timeframe = typeof d.timeframe === "string" ? d.timeframe.trim().toUpperCase() : "";
  if (!id || !DRAWING_TOOLS.has(tool) || !symbol || !timeframe) return null;
  const color = typeof d.color === "string" && d.color.trim() ? d.color.trim() : "#8b5cf6";
  const lineWidth =
    typeof d.lineWidth === "number" && d.lineWidth >= 1 && d.lineWidth <= 8
      ? Math.round(d.lineWidth)
      : 1;
  const lineStyle = LINE_STYLES.has(String(d.lineStyle))
    ? (d.lineStyle as "solid" | "dashed" | "dotted")
    : "solid";
  const visible = d.visible !== false;
  const locked = d.locked === true;
  const base: HfmChartWorkspaceDrawing = {
    id,
    tool,
    symbol,
    timeframe,
    color,
    lineWidth,
    lineStyle,
    visible,
    locked,
  };
  if (typeof d.label === "string") base.label = d.label.slice(0, 120);

  switch (tool) {
    case "hline":
      if (!isFiniteNumber(d.price)) return null;
      return { ...base, price: d.price };
    case "vline":
      if (!isFiniteNumber(d.time)) return null;
      return { ...base, time: d.time };
    case "trendline":
    case "rectangle":
    case "fib_retracement":
      if (!validatePoint(d.a) || !validatePoint(d.b)) return null;
      return { ...base, a: d.a, b: d.b };
    case "channel":
      if (!validatePoint(d.a) || !validatePoint(d.b) || !isFiniteNumber(d.offsetPrice)) return null;
      return { ...base, a: d.a, b: d.b, offsetPrice: d.offsetPrice };
    case "fib_extension":
      if (!validatePoint(d.a) || !validatePoint(d.b) || !validatePoint(d.c)) return null;
      return { ...base, a: d.a, b: d.b, c: d.c };
    case "text": {
      if (!validatePoint(d.point)) return null;
      const text = typeof d.text === "string" ? d.text.slice(0, 500) : "";
      if (!text) return null;
      return { ...base, point: d.point, text };
    }
    default:
      return null;
  }
}

export function validateHfmChartTemplate(raw: unknown): HfmChartTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const id = typeof t.id === "string" ? t.id.trim() : "";
  const name = typeof t.name === "string" ? t.name.trim().slice(0, 80) : "";
  if (!id || !name) return null;
  const chartType = typeof t.chartType === "string" ? t.chartType : "candlestick";
  const allowed = new Set(["candlestick", "ohlc", "line", "area"]);
  if (!allowed.has(chartType)) return null;
  const indicators = Array.isArray(t.indicators)
    ? t.indicators.filter((x) => x && typeof x === "object").map((x) => {
        const row = { ...(x as Record<string, unknown>) };
        // Never persist fabricated market series inside templates.
        delete row.bars;
        delete row.candles;
        delete row.prices;
        return row;
      })
    : [];
  return {
    id,
    name,
    chartType,
    showGrid: t.showGrid !== false,
    indicators,
    preferences:
      t.preferences && typeof t.preferences === "object"
        ? (t.preferences as Record<string, unknown>)
        : undefined,
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : new Date().toISOString(),
    isDefault: t.isDefault === true,
  };
}

export class HfmChartsWorkspaceStore {
  readonly dir: string;

  constructor(storageRoot = resolveStorageRoot()) {
    this.dir = resolveHfmChartsWorkspaceDir(storageRoot);
  }

  private statePath(): string {
    return path.join(this.dir, "workspace.json");
  }

  async load(): Promise<HfmChartsWorkspacePayload> {
    try {
      const raw = await fs.readFile(this.statePath(), "utf8");
      const parsed = JSON.parse(raw) as Partial<HfmChartsWorkspacePayload>;
      if (parsed.provider !== "HFM_MT5") return emptyPayload();
      const drawings = Array.isArray(parsed.drawings)
        ? parsed.drawings.map(validateHfmChartDrawing).filter((d): d is HfmChartWorkspaceDrawing => Boolean(d))
        : [];
      const templates = Array.isArray(parsed.templates)
        ? parsed.templates.map(validateHfmChartTemplate).filter((t): t is HfmChartTemplate => Boolean(t))
        : [];
      const drawingRevisions =
        parsed.drawingRevisions && typeof parsed.drawingRevisions === "object"
          ? Object.fromEntries(
              Object.entries(parsed.drawingRevisions as Record<string, unknown>)
                .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
                .map(([k, v]) => [k, Math.floor(v as number)]),
            )
          : {};
      return {
        provider: "HFM_MT5",
        version: 2,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
        drawings,
        templates,
        defaultTemplateId:
          typeof parsed.defaultTemplateId === "string" ? parsed.defaultTemplateId : null,
        preferences: validateHfmChartPreferences(parsed.preferences),
        drawingRevisions,
      };
    } catch {
      return emptyPayload();
    }
  }

  async save(payload: HfmChartsWorkspacePayload): Promise<HfmChartsWorkspacePayload> {
    const next: HfmChartsWorkspacePayload = {
      provider: "HFM_MT5",
      version: 2,
      updatedAt: new Date().toISOString(),
      drawings: payload.drawings.map(validateHfmChartDrawing).filter((d): d is HfmChartWorkspaceDrawing => Boolean(d)),
      templates: payload.templates.map(validateHfmChartTemplate).filter((t): t is HfmChartTemplate => Boolean(t)),
      defaultTemplateId: payload.defaultTemplateId,
      preferences: validateHfmChartPreferences(payload.preferences) ?? payload.preferences,
      drawingRevisions: payload.drawingRevisions ?? {},
    };
    await atomicWriteJson(this.statePath(), next);
    return next;
  }

  async listDrawings(symbol?: string, timeframe?: string): Promise<HfmChartWorkspaceDrawing[]> {
    const all = await this.load();
    return all.drawings.filter((d) => {
      if (symbol && d.symbol !== symbol.toUpperCase()) return false;
      if (timeframe && d.timeframe !== timeframe.toUpperCase()) return false;
      return true;
    });
  }

  scopeKey(symbol: string, timeframe: string): string {
    return `${symbol.toUpperCase()}:${timeframe.toUpperCase()}`;
  }

  /**
   * Replace drawings for one symbol/timeframe.
   * When `expectedRevision` is provided and mismatches, returns conflict (no write).
   */
  async putDrawingsForScope(
    symbol: string,
    timeframe: string,
    drawings: unknown[],
    expectedRevision?: number | null,
  ): Promise<{
    drawings: HfmChartWorkspaceDrawing[];
    revision: number;
    conflict: boolean;
  }> {
    const state = await this.load();
    const sym = symbol.toUpperCase();
    const tf = timeframe.toUpperCase();
    const key = this.scopeKey(sym, tf);
    const currentRev = state.drawingRevisions[key] ?? 0;
    if (
      typeof expectedRevision === "number" &&
      Number.isFinite(expectedRevision) &&
      expectedRevision !== currentRev
    ) {
      return {
        drawings: state.drawings.filter((d) => d.symbol === sym && d.timeframe === tf),
        revision: currentRev,
        conflict: true,
      };
    }
    const kept = state.drawings.filter((d) => !(d.symbol === sym && d.timeframe === tf));
    const incoming = drawings
      .map(validateHfmChartDrawing)
      .filter((d): d is HfmChartWorkspaceDrawing => Boolean(d))
      .map((d) => ({ ...d, symbol: sym, timeframe: tf }))
      .slice(0, 200);
    const nextRev = currentRev + 1;
    const next = await this.save({
      ...state,
      drawings: [...kept, ...incoming].slice(0, 500),
      drawingRevisions: { ...state.drawingRevisions, [key]: nextRev },
    });
    return {
      drawings: next.drawings.filter((d) => d.symbol === sym && d.timeframe === tf),
      revision: nextRev,
      conflict: false,
    };
  }

  async getPreferences(): Promise<HfmChartWorkspacePreferences | null> {
    return (await this.load()).preferences;
  }

  async putPreferences(
    raw: unknown,
    expectedRevision?: number | null,
  ): Promise<{ preferences: HfmChartWorkspacePreferences; conflict: boolean }> {
    const state = await this.load();
    const incoming = validateHfmChartPreferences(raw) ?? emptyPreferences();
    const current = state.preferences;
    if (
      current &&
      typeof expectedRevision === "number" &&
      Number.isFinite(expectedRevision) &&
      expectedRevision !== current.revision
    ) {
      return { preferences: current, conflict: true };
    }
    const preferences: HfmChartWorkspacePreferences = {
      ...incoming,
      revision: (current?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.save({ ...state, preferences });
    return { preferences, conflict: false };
  }

  async clearDrawingsForScope(symbol: string, timeframe: string): Promise<number> {
    const state = await this.load();
    const sym = symbol.toUpperCase();
    const tf = timeframe.toUpperCase();
    const before = state.drawings.length;
    const drawings = state.drawings.filter((d) => !(d.symbol === sym && d.timeframe === tf));
    await this.save({ ...state, drawings });
    return before - drawings.length;
  }

  async listTemplates(): Promise<HfmChartTemplate[]> {
    return (await this.load()).templates;
  }

  async upsertTemplate(raw: unknown): Promise<HfmChartTemplate | null> {
    const tpl = validateHfmChartTemplate(raw);
    if (!tpl) return null;
    const state = await this.load();
    const others = state.templates.filter((t) => t.id !== tpl.id);
    let templates = [...others, tpl].slice(0, 40);
    let defaultTemplateId = state.defaultTemplateId;
    if (tpl.isDefault) {
      templates = templates.map((t) => ({ ...t, isDefault: t.id === tpl.id }));
      defaultTemplateId = tpl.id;
    }
    await this.save({ ...state, templates, defaultTemplateId });
    return tpl;
  }

  async renameTemplate(id: string, name: string): Promise<HfmChartTemplate | null> {
    const state = await this.load();
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) return null;
    const templates = state.templates.map((t) =>
      t.id === id ? { ...t, name: trimmed, updatedAt: new Date().toISOString() } : t,
    );
    if (!templates.some((t) => t.id === id)) return null;
    const next = await this.save({ ...state, templates });
    return next.templates.find((t) => t.id === id) ?? null;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const state = await this.load();
    const templates = state.templates.filter((t) => t.id !== id);
    if (templates.length === state.templates.length) return false;
    await this.save({
      ...state,
      templates,
      defaultTemplateId: state.defaultTemplateId === id ? null : state.defaultTemplateId,
    });
    return true;
  }

  async setDefaultTemplate(id: string | null): Promise<boolean> {
    const state = await this.load();
    if (id && !state.templates.some((t) => t.id === id)) return false;
    const templates = state.templates.map((t) => ({ ...t, isDefault: id != null && t.id === id }));
    await this.save({ ...state, templates, defaultTemplateId: id });
    return true;
  }
}

let storeSingleton: HfmChartsWorkspaceStore | null = null;
export function getHfmChartsWorkspaceStore(): HfmChartsWorkspaceStore {
  if (!storeSingleton) storeSingleton = new HfmChartsWorkspaceStore();
  return storeSingleton;
}
