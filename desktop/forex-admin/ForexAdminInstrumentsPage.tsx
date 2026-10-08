import { useCallback, useEffect, useMemo, useState } from "react";
import { forexProvidersApi } from "./api";

type DiscoveryResponse = Awaited<ReturnType<typeof forexProvidersApi.fxcmInstruments>>;

export function ForexAdminInstrumentsPage({ onOpen }: { onOpen: (path: string) => void }) {
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marketType, setMarketType] = useState("");
  const [search, setSearch] = useState("");
  const [mappingStatus, setMappingStatus] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setBusy(true);
    setError(null);
    try {
      const res = await forexProvidersApi.fxcmInstruments({
        refresh,
        marketType: marketType || undefined,
        search: search || undefined,
        mappingStatus: mappingStatus || undefined,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FXCM instrument discovery failed.");
    } finally {
      setBusy(false);
    }
  }, [marketType, search, mappingStatus]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const selected = useMemo(() => {
    if (!selectedSymbol || !data) return null;
    return data.instruments.find((i) => String(i.providerSymbol) === selectedSymbol) ?? null;
  }, [data, selectedSymbol]);

  return (
    <div data-forex-admin-instruments>
      <section className="fxa-card">
        <h2>FXCM INSTRUMENTS</h2>
        <p className="fxa-muted">
          Phase 27 instrument discovery and symbol mapping. Official FXCM catalog only —
          no live prices, candles, streaming, or trading.
        </p>
        <ul>
          <li>Provider: FXCM</li>
          <li>Environment: {String(data?.environmentLabel ?? "—")}</li>
          <li>Discovery: {String(data?.discoveryStatus ?? (busy ? "LOADING" : "—"))}</li>
          <li>Freshness: {String(data?.freshness ?? "—")}</li>
          <li>Source: {String(data?.source ?? "—")}</li>
          <li>Last fetched: {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : "—"}</li>
          <li>Count: {data?.count ?? 0}</li>
          <li>Authentication: {String(data?.authenticationState ?? "—")}</li>
          <li>Market data: NOT_STARTED</li>
          <li>Live Stream: NOT ENABLED YET</li>
          <li>Trading: DISABLED</li>
          {data?.errorMessage ? <li>Safe error: {data.errorMessage}</li> : null}
        </ul>
        {data?.note ? <p className="fxa-muted">{data.note}</p> : null}
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="fxa-btn" disabled={busy} onClick={() => void load(true)}>
            {busy ? "Refreshing…" : "Refresh Instruments"}
          </button>
          <button type="button" className="fxa-btn-secondary" onClick={() => onOpen("/admin/forex")}>
            Back to Dashboard
          </button>
        </div>
      </section>

      <section className="fxa-card">
        <h3>Filters</h3>
        <div className="fxa-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="fxa-muted">
            Search
            <input
              className="fxa-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="EUR, EURUSD, EUR/USD…"
              style={{ display: "block", marginTop: 4, minWidth: 160 }}
            />
          </label>
          <label className="fxa-muted">
            Market type
            <select
              className="fxa-input"
              value={marketType}
              onChange={(e) => setMarketType(e.target.value)}
              style={{ display: "block", marginTop: 4 }}
            >
              <option value="">All</option>
              <option value="FOREX">FOREX</option>
              <option value="COMMODITY">COMMODITY</option>
              <option value="INDEX">INDEX</option>
              <option value="TREASURY">TREASURY</option>
              <option value="SHARE">SHARE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <label className="fxa-muted">
            Mapping
            <select
              className="fxa-input"
              value={mappingStatus}
              onChange={(e) => setMappingStatus(e.target.value)}
              style={{ display: "block", marginTop: 4 }}
            >
              <option value="">All</option>
              <option value="VALIDATED">VALIDATED</option>
              <option value="UNRESOLVED">UNRESOLVED</option>
              <option value="CONFLICT">CONFLICT</option>
            </select>
          </label>
          <button type="button" className="fxa-btn-secondary" disabled={busy} onClick={() => void load(false)}>
            Apply
          </button>
        </div>
      </section>

      {error ? <div className="fxa-error" role="alert">{error}</div> : null}

      {data && data.conflicts.length > 0 ? (
        <section className="fxa-card">
          <h3>Mapping conflicts</h3>
          <ul>
            {data.conflicts.map((c) => (
              <li key={String(c.canonicalSymbol)}>
                {String(c.canonicalSymbol)} ← {(c.providerSymbols as string[] | undefined)?.join(", ") ?? "—"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="fxa-card">
        <h3>Catalog</h3>
        {!data ? (
          <p className="fxa-muted">Loading FXCM instruments…</p>
        ) : data.instruments.length === 0 ? (
          <p className="fxa-muted">
            No instruments to display. Configure server-side FXCM credentials to discover the official catalog.
            Discovery status: {data.discoveryStatus}.
          </p>
        ) : (
          <div className="fxa-table-wrap">
            <table className="fxa-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Market</th>
                  <th>Provider symbol</th>
                  <th>Canonical</th>
                  <th>Display</th>
                  <th>Base</th>
                  <th>Quote</th>
                  <th>Mapping</th>
                  <th>Caps</th>
                </tr>
              </thead>
              <tbody>
                {data.instruments.map((inst) => (
                  <tr key={`${String(inst.marketType)}:${String(inst.providerSymbol)}`}>
                    <td>FXCM</td>
                    <td>{String(inst.marketType)}</td>
                    <td>
                      <button
                        type="button"
                        className="fxa-btn-secondary"
                        onClick={() => setSelectedSymbol(String(inst.providerSymbol))}
                      >
                        {String(inst.providerSymbol)}
                      </button>
                    </td>
                    <td>{String(inst.canonicalSymbol ?? "—")}</td>
                    <td>{String(inst.displaySymbol)}</td>
                    <td>{String(inst.baseAsset ?? "—")}</td>
                    <td>{String(inst.quoteAsset ?? "—")}</td>
                    <td>{String(inst.mappingStatus)}</td>
                    <td className="fxa-muted">discovery only</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <section className="fxa-card" data-forex-admin-instrument-detail>
          <h3>Instrument detail</h3>
          <ul>
            <li>Provider: FXCM</li>
            <li>Provider symbol: {String(selected.providerSymbol)}</li>
            <li>Canonical symbol: {String(selected.canonicalSymbol ?? "—")}</li>
            <li>Display symbol: {String(selected.displaySymbol)}</li>
            <li>Market type: {String(selected.marketType)}</li>
            <li>Base: {String(selected.baseAsset ?? "—")}</li>
            <li>Quote: {String(selected.quoteAsset ?? "—")}</li>
            <li>Mapping: {String(selected.mappingStatus)}</li>
            <li>Source: FXCM</li>
            <li>Discovery: {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : "—"}</li>
            <li>Capabilities: instruments + historical + streaming quotes (phase-enabled); live candles/trading not enabled</li>
            {selected.conflictReason ? <li>Conflict: {String(selected.conflictReason)}</li> : null}
          </ul>
          <p className="fxa-muted">
            Discovery is identity/metadata. Use FXCM Stream for real-time quotes; Historical for candles.
          </p>
          <button type="button" className="fxa-btn-secondary" onClick={() => setSelectedSymbol(null)}>
            Close detail
          </button>
        </section>
      ) : null}
    </div>
  );
}
