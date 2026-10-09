import { useEffect, useState } from "react";
import { forexIntelligenceApi, forexProvidersApi } from "./api";

function Badge({ value, tone }: { value: string; tone?: "ok" | "warn" | "danger" }) {
  return <span className="fxa-badge" data-tone={tone}>{value}</span>;
}

export function ForexAdminAiConfigurationPage() {
  const [readOnly, setReadOnly] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<{
    knowledgeRagEnabled: boolean;
    memoryRetrievalEnabled: boolean;
    memoryMaxExamples: number;
    compactPromptMode: boolean;
    promptCharBudget: number;
  } | null>(null);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState<Array<{ info: Record<string, unknown>; health: Record<string, unknown> }>>([]);
  const [unifiedNote, setUnifiedNote] = useState<string>("");

  const load = () => {
    void forexIntelligenceApi.configuration()
      .then((res) => {
        setReadOnly(res.readOnly);
        setSettings(res.configurable);
        setAudit(res.audit);
        setNote(res.note);
      })
      .catch((err: Error) => setError(err.message));
    void forexProvidersApi.list()
      .then((res) => setProviders(res.providers))
      .catch(() => setProviders([]));
    void forexProvidersApi.unifiedStatus()
      .then((res) => setUnifiedNote(res.note ?? `Phase ${res.phase} unified market-data health.`))
      .catch(() => setUnifiedNote(""));
  };

  useEffect(() => { load(); }, []);

  if (error) return <div className="fxa-error" role="alert">{error}</div>;
  if (!readOnly || !settings) return <p className="fxa-muted">Loading AI configuration…</p>;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await forexIntelligenceApi.updateConfiguration(settings);
      setSettings(res.settings as typeof settings);
      setMessage(res.changed.length ? `Saved ${res.changed.length} change(s).` : "No changes.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-forex-admin-ai-configuration>
      <section className="fxa-card">
        <h2>AI Configuration</h2>
        <p className="fxa-muted">
          Control panel for existing Forex AI infrastructure. External memory + knowledge only.
        </p>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Badge value="MODEL TRAINING: Not active" tone="warn" />
          <Badge value="MEMORY LEARNING: Active" tone="ok" />
          <Badge value="KNOWLEDGE RETRIEVAL: Active" tone="ok" />
        </div>
      </section>

      <section className="fxa-card">
        <h3>Read-only system information</h3>
        <p className="fxa-muted">{note}</p>
        <ul>
          <li>Provider: {String(readOnly.provider)}</li>
          <li>Model ID: {String(readOnly.modelId)}</li>
          <li>Preferred: {String(readOnly.preferredModel)}</li>
          <li>Model status: {String(readOnly.modelStatus)}</li>
          <li>Ollama exposure: {String(readOnly.ollamaExposure)}</li>
          <li>Ollama host: {String(readOnly.ollamaHostDisplay)}</li>
          <li>Prompt version: {String(readOnly.promptVersion)}</li>
          <li>Decision engines: scenario / confirmation / invalidation / risk — ACTIVE</li>
        </ul>
      </section>

      <section className="fxa-card" data-forex-admin-market-providers>
        <h3>Market Data Providers</h3>
        <p className="fxa-muted">
          Phase 31 unified registry — BINANCE + FXCM. Trading disabled. No cross-provider fallback.
          {unifiedNote ? ` ${unifiedNote}` : ""}
        </p>
        {providers.length === 0 ? (
          <p className="fxa-muted">Loading provider status…</p>
        ) : providers.map((p) => {
          const info = p.info;
          const health = p.health;
          const caps = (info.capabilities as Record<string, boolean>) ?? {};
          const isFxcm = String(info.provider) === "FXCM";
          return (
            <article key={String(info.provider)} style={{ marginBottom: 12 }} data-provider={String(info.provider)}>
              <strong>{String(info.displayName ?? info.provider)}</strong>
              {" · "}
              <Badge
                value={String(health.status)}
                tone={health.status === "CONNECTED" ? "ok" : health.status === "NOT_CONFIGURED" || health.status === "DISABLED" ? "warn" : "danger"}
              />
              {" · "}{String(health.environmentLabel ?? "")}
              <ul>
                <li>instruments: {String(caps.instruments)}</li>
                <li>liveQuotes: {String(caps.liveQuotes)}</li>
                <li>streamingQuotes: {String(caps.streamingQuotes)}</li>
                <li>historicalPrices: {String(caps.historicalPrices)}</li>
                <li>candles: {String(caps.candles)}</li>
                <li>liveCandles: {String(caps.liveCandles)}</li>
                <li>trading: {String(caps.trading)}</li>
                {isFxcm ? (
                  <>
                    <li>authenticated: {String(health.authenticated)}</li>
                    <li>liveStreamEnabled: {String(health.liveStreamEnabled)}</li>
                    <li>CONNECTED ≠ LIVE</li>
                  </>
                ) : null}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="fxa-card">
        <h3>Configurable settings</h3>
        <div className="fxa-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            <input
              type="checkbox"
              checked={settings.knowledgeRagEnabled}
              onChange={(e) => setSettings({ ...settings, knowledgeRagEnabled: e.target.checked })}
            />
            {" "}Knowledge RAG enabled
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.memoryRetrievalEnabled}
              onChange={(e) => setSettings({ ...settings, memoryRetrievalEnabled: e.target.checked })}
            />
            {" "}Memory retrieval enabled
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.compactPromptMode}
              onChange={(e) => setSettings({ ...settings, compactPromptMode: e.target.checked })}
            />
            {" "}Compact prompt mode
          </label>
          <label>
            Max memory examples{" "}
            <input
              className="fxa-input"
              style={{ width: 64 }}
              type="number"
              min={0}
              max={3}
              value={settings.memoryMaxExamples}
              onChange={(e) => setSettings({
                ...settings,
                memoryMaxExamples: Math.min(3, Math.max(0, Number(e.target.value) || 0)),
              })}
            />
          </label>
          <label>
            Prompt budget{" "}
            <input
              className="fxa-input"
              style={{ width: 96 }}
              type="number"
              min={1600}
              max={2800}
              value={settings.promptCharBudget}
              onChange={(e) => setSettings({
                ...settings,
                promptCharBudget: Math.min(2800, Math.max(1600, Number(e.target.value) || 2800)),
              })}
            />
          </label>
          <button type="button" className="fxa-btn" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save safe settings"}
          </button>
        </div>
        {message ? <p className="fxa-muted">{message}</p> : null}
      </section>

      <section className="fxa-card">
        <h3>Configuration audit</h3>
        {audit.length === 0 ? <p className="fxa-muted">No configuration changes yet.</p> : (
          <ul>
            {audit.slice(0, 20).map((a) => (
              <li key={String(a.id)}>
                {String(a.timestamp)} · {String(a.setting)}: {String(a.oldValue)} → {String(a.newValue)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ForexAdminRetrievalDiagnosticsPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [diagnostic, setDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [ollama, setOllama] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const build = async () => {
    setBusy(true);
    setError(null);
    setOllama(null);
    try {
      const res = await forexIntelligenceApi.buildContext({
        symbol,
        timeframes: ["4h", "1h", "30m", "15m", "5m"],
      });
      setDiagnostic(res.diagnostic);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const testOllama = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await forexIntelligenceApi.testOllama();
      setOllama(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-forex-admin-retrieval-diagnostics>
      <section className="fxa-card">
        <h2>Retrieval Diagnostics</h2>
        <p className="fxa-muted">
          BUILD CONTEXT does not call Ollama. TEST OLLAMA probes internal inference only.
        </p>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            className="fxa-input"
            style={{ maxWidth: 160 }}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.trim().toUpperCase())}
          />
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void build()}>
            Build Context
          </button>
          <button type="button" className="fxa-btn-secondary" disabled={busy} onClick={() => void testOllama()}>
            Test Ollama
          </button>
        </div>
        {error ? <div className="fxa-error" role="alert">{error}</div> : null}
      </section>

      {diagnostic ? (
        <>
          <section className="fxa-card">
            <h3>CURRENT MARKET STATE</h3>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
              {String(diagnostic.currentMarketContext ?? "")}
            </pre>
            <p className="fxa-muted">{String(diagnostic.mtfSummary ?? "")}</p>
            <p className="fxa-muted">{String(diagnostic.decisionState ?? "")}</p>
          </section>
          <section className="fxa-card">
            <h3>KNOWLEDGE CONTEXT</h3>
            <ul>
              {((diagnostic.knowledgeResults as Array<Record<string, unknown>>) ?? []).length === 0
                ? <li className="fxa-muted">No knowledge hits</li>
                : ((diagnostic.knowledgeResults as Array<Record<string, unknown>>)).map((k) => (
                  <li key={String(k.documentId)}>
                    <Badge value="METHODOLOGY" tone="ok" /> {String(k.title)} · {String(k.documentId)}
                  </li>
                ))}
            </ul>
          </section>
          <section className="fxa-card">
            <h3>MEMORY CONTEXT</h3>
            <ul>
              {((diagnostic.memoryResults as Array<Record<string, unknown>>) ?? []).length === 0
                ? <li className="fxa-muted">No memory hits</li>
                : ((diagnostic.memoryResults as Array<Record<string, unknown>>)).map((m) => (
                  <li key={String(m.memoryId)}>
                    <Badge value="HISTORICAL" tone="warn" /> {String(m.symbol)} · {String(m.scenario)} · {String(m.outcome)}
                    {" · "}{String(m.memoryId)}
                  </li>
                ))}
            </ul>
          </section>
          <section className="fxa-card">
            <h3>FINAL COMPACT CONTEXT</h3>
            <p className="fxa-muted">
              chars={String(diagnostic.promptChars)} / budget={String(diagnostic.promptBudget)}
              {" · "}withinBudget={String(diagnostic.withinBudget)}
              {" · "}calledOllama={String(diagnostic.calledOllama)}
            </p>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 360, overflow: "auto" }}>
              {String(diagnostic.finalCompactContext ?? "")}
            </pre>
          </section>
        </>
      ) : null}

      {ollama ? (
        <section className="fxa-card">
          <h3>Ollama test</h3>
          <ul>
            <li>ready: {String(ollama.ready)}</li>
            <li>code: {String(ollama.code)}</li>
            <li>model: {String(ollama.model)}</li>
            <li>latencyMs: {String(ollama.latencyMs)}</li>
            <li>exposure: {String(ollama.exposure)}</li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function ForexAdminSystemHealthPage() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await forexIntelligenceApi.health(true);
      setHealth(res.health);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  if (error) return <div className="fxa-error" role="alert">{error}</div>;
  if (!health) return <p className="fxa-muted">Loading system health…</p>;

  const model = (health.model as Record<string, unknown>) ?? {};
  const ollama = (health.ollama as Record<string, unknown>) ?? {};
  const knowledge = (health.knowledge as Record<string, unknown>) ?? {};
  const memory = (health.memory as Record<string, unknown>) ?? {};
  const aiPerf = (health.aiPerformance as Record<string, unknown>) ?? {};

  return (
    <div data-forex-admin-system-health>
      <section className="fxa-card">
        <div className="fxa-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <h2>System Health</h2>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void refresh()}>
            Refresh AI Health
          </button>
        </div>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Badge value="MODEL TRAINING: Not active" tone="warn" />
          <Badge value="MEMORY LEARNING: Active" tone="ok" />
          <Badge value="KNOWLEDGE RETRIEVAL: Active" tone="ok" />
          <Badge value="Trading performance: NOT AVAILABLE" />
        </div>
      </section>

      <section className="fxa-grid">
        <article className="fxa-card fxa-stat">
          <strong>{String(model.modelId)}</strong>
          <span>Model · {String(model.status)}</span>
        </article>
        <article className="fxa-card fxa-stat">
          <strong>{String(ollama.exposure)}</strong>
          <span>Ollama · latency {ollama.latencyMs == null ? "—" : `${ollama.latencyMs} ms`}</span>
        </article>
        <article className="fxa-card fxa-stat">
          <strong>{String(knowledge.published)}/{String(knowledge.documents)}</strong>
          <span>Published / documents</span>
        </article>
        <article className="fxa-card fxa-stat">
          <strong>{String(memory.totalAnalyses)}</strong>
          <span>Memory analyses</span>
        </article>
      </section>

      <section className="fxa-card">
        <h3>AI performance (not trading PnL)</h3>
        <ul>
          <li>sampleSize: {String(aiPerf.sampleSize)}</li>
          <li>averageLatencyMs: {aiPerf.averageLatencyMs == null ? "—" : String(Math.round(Number(aiPerf.averageLatencyMs)))}</li>
          <li>fallbackRate: {aiPerf.fallbackRate == null ? "—" : Number(aiPerf.fallbackRate).toFixed(2)}</li>
          <li>statisticalConfidence: {String(aiPerf.statisticalConfidence)}</li>
          <li>{String(aiPerf.note)}</li>
        </ul>
      </section>
    </div>
  );
}
