/**
 * Phase 6 — analysis session state with stale-response / duplicate protection.
 */
import { useCallback, useRef, useState } from "react";
import type { ParsedAnalysisView } from "./parse-hfm-analysis-result";
import { parseHfmAnalysisRecord } from "./parse-hfm-analysis-result";

export type AnalysisSessionMode = "live" | "history";

export interface AnalysisPackagesState {
  intelligence: Record<string, unknown> | null;
  intelligenceStatus: string | null;
  scenarioPackage: Record<string, unknown> | null;
  scenarioStatus: string | null;
  loadError: string | null;
}

export interface HfmAnalysisSessionState {
  mode: AnalysisSessionMode;
  busy: boolean;
  stage: string;
  error: string | null;
  analysisRaw: Record<string, unknown> | null;
  view: ParsedAnalysisView | null;
  packages: AnalysisPackagesState;
  requestGeneration: number;
  chartSymbol: string;
  analysisSymbol: string | null;
  staleForSymbol: boolean;
}

export function emptyAnalysisPackages(): AnalysisPackagesState {
  return {
    intelligence: null,
    intelligenceStatus: null,
    scenarioPackage: null,
    scenarioStatus: null,
    loadError: null,
  };
}

export function useHfmAnalysisSession(chartSymbol: string) {
  const genRef = useRef(0);
  const manualGenAtCompleteRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisSessionMode>("live");
  const [analysisRaw, setAnalysisRaw] = useState<Record<string, unknown> | null>(null);
  const [packages, setPackages] = useState<AnalysisPackagesState>(emptyAnalysisPackages);
  const [requestGeneration, setRequestGeneration] = useState(0);
  const [analysisSymbol, setAnalysisSymbol] = useState<string | null>(null);

  const view = analysisRaw ? parseHfmAnalysisRecord(analysisRaw) : null;
  const staleForSymbol = Boolean(
    analysisSymbol && analysisSymbol.toUpperCase() !== chartSymbol.toUpperCase(),
  );

  const beginRequest = useCallback(() => {
    genRef.current += 1;
    const gen = genRef.current;
    setRequestGeneration(gen);
    setBusy(true);
    setError(null);
    setMode("live");
    return gen;
  }, []);

  const isCurrent = useCallback((gen: number) => gen === genRef.current, []);

  const finishRequest = useCallback((gen: number) => {
    if (gen === genRef.current) setBusy(false);
  }, []);

  const applyAnalysis = useCallback((
    gen: number,
    analysis: Record<string, unknown> | null,
    opts?: { fromAuto?: boolean; markManualComplete?: boolean },
  ) => {
    if (gen !== genRef.current) return false;
    // Auto results must not overwrite a newer manual completion.
    if (opts?.fromAuto && gen < manualGenAtCompleteRef.current) return false;
    setAnalysisRaw(analysis);
    const parsed = analysis ? parseHfmAnalysisRecord(analysis) : null;
    setAnalysisSymbol(parsed?.symbol ?? null);
    if (opts?.markManualComplete) {
      manualGenAtCompleteRef.current = gen;
    }
    return true;
  }, []);

  const applyPackages = useCallback((
    gen: number,
    next: AnalysisPackagesState,
  ) => {
    if (gen !== genRef.current) return false;
    setPackages(next);
    return true;
  }, []);

  const markSymbolStale = useCallback(() => {
    // Keep last analysis but UI will show stale banner via staleForSymbol.
  }, []);

  const clearForSymbolChange = useCallback(() => {
    // Soft-stale: do not wipe immediately; banner handles it.
    markSymbolStale();
  }, [markSymbolStale]);

  const loadHistoryView = useCallback((
    analysis: Record<string, unknown>,
    pkgs: AnalysisPackagesState,
  ) => {
    genRef.current += 1;
    setRequestGeneration(genRef.current);
    setMode("history");
    setBusy(false);
    setError(null);
    setStage("HISTORY");
    setAnalysisRaw(analysis);
    setPackages(pkgs);
    const parsed = parseHfmAnalysisRecord(analysis);
    setAnalysisSymbol(parsed?.symbol ?? null);
  }, []);

  const returnToLive = useCallback(() => {
    setMode("live");
  }, []);

  return {
    state: {
      mode,
      busy,
      stage,
      error,
      analysisRaw,
      view,
      packages,
      requestGeneration,
      chartSymbol,
      analysisSymbol,
      staleForSymbol,
    } satisfies HfmAnalysisSessionState,
    setStage,
    setError,
    beginRequest,
    isCurrent,
    finishRequest,
    applyAnalysis,
    applyPackages,
    clearForSymbolChange,
    loadHistoryView,
    returnToLive,
    emptyPackages: emptyAnalysisPackages,
  };
}
