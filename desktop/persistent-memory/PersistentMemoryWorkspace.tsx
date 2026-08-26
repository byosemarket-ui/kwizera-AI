import { useCallback, useEffect, useState } from "react";
import { Archive, BookOpen, Database, Globe, HardDrive, RefreshCw, Search, Shield, Wifi, WifiOff } from "lucide-react";
import {
  onlineKnowledgeApi,
  persistentMemoryApi,
  type OnlineKnowledgeStatus,
  type PersistentMemoryHealth,
} from "./api-client";
import { getLastSyncAt, syncCreativeMemoryBlobToDisk } from "./sync-bridge";
import { CREATIVE_MEMORY_KEY } from "../creative-memory/types";
import "./persistent-memory.css";

type Tab = "status" | "memory" | "knowledge" | "research" | "backup";

export function PersistentMemoryWorkspace() {
  const [tab, setTab] = useState<Tab>("status");
  const [health, setHealth] = useState<PersistentMemoryHealth | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<OnlineKnowledgeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [researchQuery, setResearchQuery] = useState(
    "Find current best practices for creating short product advertising videos",
  );
  const [memoryRows, setMemoryRows] = useState<Array<Record<string, unknown>>>([]);
  const [knowledgeRows, setKnowledgeRows] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [backups, setBackups] = useState<Array<{ backupId: string; createdAt: string }>>([]);
  const [researchResult, setResearchResult] = useState<Record<string, unknown> | null>(null);
  const [researchHistory, setResearchHistory] = useState<Array<Record<string, unknown>>>([]);
  const [lastSync, setLastSync] = useState<string | null>(getLastSyncAt());
  const [message, setMessage] = useState<string | null>(null);

  const refreshHealth = useCallback(async () => {
    try {
      setError(null);
      const [h, o] = await Promise.all([
        persistentMemoryApi.health(),
        onlineKnowledgeApi.status().catch(() => null),
      ]);
      setHealth(h);
      if (o) setOnlineStatus(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Health check failed");
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const t = window.setInterval(() => void refreshHealth(), 15000);
    return () => window.clearInterval(t);
  }, [refreshHealth]);

  async function runSearch() {
    setBusy(true);
    setMessage(null);
    try {
      if (tab === "knowledge") {
        const res = await persistentMemoryApi.searchKnowledge({ q: query || undefined, limit: 50 });
        setKnowledgeRows(res.records as Array<Record<string, unknown>>);
      } else {
        const res = await persistentMemoryApi.searchMemory({ q: query || undefined, limit: 50 });
        setMemoryRows(res.records as Array<Record<string, unknown>>);
        setTab("memory");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function runResearch() {
    setBusy(true);
    setMessage(null);
    setResearchResult(null);
    try {
      const res = await onlineKnowledgeApi.research({
        query: researchQuery,
        topic: researchQuery,
        persist: true,
        maxSources: 3,
      });
      setResearchResult(res);
      setMessage(String(res.message ?? "Research finished"));
      const hist = await onlineKnowledgeApi.history();
      setResearchHistory(hist.history);
      await refreshHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  async function retrieveLocalOnly() {
    setBusy(true);
    try {
      const res = await onlineKnowledgeApi.retrieveLocal(researchQuery, 20);
      setKnowledgeRows(res.records as Array<Record<string, unknown>>);
      setTab("knowledge");
      setMessage(`Local retrieval: ${res.count} item(s) (${res.mode})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Local retrieve failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncFromCreativeMemory() {
    setBusy(true);
    setMessage(null);
    try {
      const raw = localStorage.getItem(CREATIVE_MEMORY_KEY);
      const blob = raw ? JSON.parse(raw) : { byProject: {} };
      const result = await syncCreativeMemoryBlobToDisk(blob);
      setLastSync(getLastSyncAt());
      setMessage(`Synced ${result.synced} entries (${result.failed} failed).`);
      await refreshHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function createBackup() {
    setBusy(true);
    try {
      const res = await persistentMemoryApi.createBackup();
      setMessage(res.ok ? `Backup created: ${res.backupId}` : "Backup failed");
      const list = await persistentMemoryApi.listBackups();
      setBackups(list.backups);
      await refreshHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadBackups() {
    try {
      const list = await persistentMemoryApi.listBackups();
      setBackups(list.backups);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not list backups");
    }
  }

  async function restore(backupId: string) {
    const ok = window.confirm(
      `Restore backup ${backupId}?\n\nA safety copy of current data will be created first. This is an explicit authorized restore.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await persistentMemoryApi.restoreBackup(backupId, true);
      setMessage(res.ok ? `Restored. Safety copy: ${res.safetyCopy ?? "n/a"}` : res.error ?? "Restore failed");
      await refreshHealth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pm-workspace">
      <header className="pm-header">
        <div>
          <p className="pm-kicker">Phase 7 · Steps 2–3</p>
          <h1><BookOpen size={22} /> Knowledge & Memory Center</h1>
          <p>Local memory persists offline. When online, approved research can update the same Knowledge Base — never a second store, never model training.</p>
        </div>
        <div className="pm-actions">
          <div className="pm-live-status" title={onlineStatus?.network.detail ?? ""}>
            {onlineStatus?.network.internetAvailable
              ? <><Wifi size={14} /> Internet ONLINE · {onlineStatus.network.mode}</>
              : <><WifiOff size={14} /> Internet OFFLINE · LOCAL MODE</>}
            <span>Phase: {onlineStatus?.phase ?? "…"}</span>
          </div>
          <button type="button" onClick={() => void refreshHealth()} disabled={busy}><RefreshCw size={14} /> Refresh</button>
          <button type="button" className="primary" onClick={() => void syncFromCreativeMemory()} disabled={busy}>
            Sync creative memory to disk
          </button>
        </div>
      </header>

      {error && <div className="pm-banner error">{error}</div>}
      {message && <div className="pm-banner ok">{message}</div>}

      <nav className="pm-tabs">
        {([
          ["status", "Status"],
          ["memory", "Memory"],
          ["knowledge", "Knowledge"],
          ["research", "Online Research"],
          ["backup", "Backup"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              if (id === "backup") void loadBackups();
              if (id === "research") void onlineKnowledgeApi.history().then((h) => setResearchHistory(h.history)).catch(() => undefined);
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "status" && (
        <section className="pm-grid">
          <StatusCard icon={<Database size={16} />} label="Memory" value={health?.memory ?? "…"} />
          <StatusCard icon={<BookOpen size={16} />} label="Knowledge" value={health?.knowledge ?? "…"} />
          <StatusCard
            icon={onlineStatus?.network.internetAvailable ? <Globe size={16} /> : <WifiOff size={16} />}
            label="Internet"
            value={onlineStatus?.network.state ?? "…"}
          />
          <StatusCard icon={<Archive size={16} />} label="Backup" value={health?.backup ?? "…"} />
          <div className="pm-panel wide">
            <h2>Local system vs internet</h2>
            <dl>
              <dt>Local AI / Memory</dt><dd>{health?.memory ?? "—"}</dd>
              <dt>Knowledge Base</dt><dd>{health?.knowledge ?? "—"} ({health?.knowledgeCount ?? 0} items)</dd>
              <dt>Storage</dt><dd>{health?.ready ? "READY" : "FAILED"}</dd>
              <dt>Internet</dt><dd>{onlineStatus?.network.state ?? "—"} — {onlineStatus?.network.mode ?? "—"}</dd>
              <dt>Research phase</dt><dd>{onlineStatus?.phase ?? "—"}</dd>
              <dt>Root</dt><dd>{health?.storageRoot ?? "—"}</dd>
              <dt>Last creative sync</dt><dd>{lastSync ?? "Never"}</dd>
              <dt>Model training from web</dt><dd>Disabled (knowledge acquisition only)</dd>
            </dl>
            <p className="pm-note">When online, AI can update its local knowledge from allowlisted sources. When offline, AI uses stored local knowledge.</p>
            {health?.issues?.length ? (
              <ul className="pm-issues">{health.issues.map((i) => <li key={i}>{i}</li>)}</ul>
            ) : null}
          </div>
        </section>
      )}

      {tab === "research" && (
        <section className="pm-panel">
          <h2><Globe size={16} /> Manual research</h2>
          <p className="pm-note">Searches allowlisted official documentation only. Results save into the existing Knowledge Base (Step 2). Webpage text is DATA — never executed.</p>
          <div className="pm-search-bar">
            <Search size={16} />
            <input
              value={researchQuery}
              onChange={(e) => setResearchQuery(e.target.value)}
              placeholder="Research query…"
              onKeyDown={(e) => { if (e.key === "Enter") void runResearch(); }}
            />
            <button type="button" className="primary" disabled={busy} onClick={() => void runResearch()}>
              {busy ? "Working…" : "Research & save"}
            </button>
            <button type="button" disabled={busy} onClick={() => void retrieveLocalOnly()}>Use local only</button>
          </div>
          {researchResult && (
            <div className="pm-research-result">
              <p><strong>{String(researchResult.mode)}</strong> — {String(researchResult.message)}</p>
              <p>Saved IDs: {Array.isArray(researchResult.savedKnowledgeIds) ? (researchResult.savedKnowledgeIds as string[]).join(", ") || "none" : "—"}</p>
              <p>Local hits before research: {String(researchResult.localHits ?? 0)}</p>
              <details>
                <summary>Full result</summary>
                <pre>{JSON.stringify(researchResult, null, 2)}</pre>
              </details>
            </div>
          )}
          <h3>Research history</h3>
          <ul className="pm-list">
            {researchHistory.map((h) => (
              <li key={String(h.researchId)}>
                <strong>{String(h.query)}</strong>
                <span>{String(h.at)} · {String(h.mode)} · saved={String(h.saved)} · {String(h.status)}</span>
              </li>
            ))}
            {researchHistory.length === 0 && <li className="pm-empty">No research runs yet.</li>}
          </ul>
        </section>
      )}

      {(tab === "memory" || tab === "knowledge") && (
        <section className="pm-search">
          <div className="pm-search-bar">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "knowledge" ? "Search knowledge…" : "Search memory…"}
              onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
            />
            <button type="button" className="primary" disabled={busy} onClick={() => void runSearch()}>Search</button>
          </div>
          <div className="pm-split">
            <ul className="pm-list">
              {(tab === "knowledge" ? knowledgeRows : memoryRows).map((row) => {
                const id = String(row.memoryId ?? row.knowledgeId ?? "");
                return (
                  <li key={id}>
                    <button type="button" onClick={() => setSelected(row)}>
                      <strong>{String(row.title ?? id)}</strong>
                      <span>{String(row.category ?? row.knowledgeType ?? "")}</span>
                    </button>
                  </li>
                );
              })}
              {(tab === "knowledge" ? knowledgeRows : memoryRows).length === 0 && (
                <li className="pm-empty">No results yet. Run a search or sync creative memory.</li>
              )}
            </ul>
            <div className="pm-detail">
              {selected ? (
                <>
                  <h2>{String(selected.title ?? "Details")}</h2>
                  <dl className="pm-meta">
                    <dt>Type</dt><dd>{String(selected.memoryType ?? selected.knowledgeType ?? "—")}</dd>
                    <dt>Category</dt><dd>{String(selected.category ?? "—")}</dd>
                    <dt>Source</dt><dd>{String(selected.source ?? "—")}</dd>
                    <dt>Project</dt><dd>{String(selected.relatedProject ?? "—")}</dd>
                    <dt>Created</dt><dd>{String(selected.createdAt ?? "—")}</dd>
                    <dt>Updated</dt><dd>{String(selected.updatedAt ?? "—")}</dd>
                    <dt>Status</dt><dd>{String(selected.status ?? "—")}</dd>
                    <dt>Version</dt><dd>{String(selected.version ?? "—")}</dd>
                    <dt>Confidence</dt><dd>{String(selected.confidenceScore ?? (selected.payload as { confidence?: number } | undefined)?.confidence ?? "—")}</dd>
                    <dt>Verification</dt><dd>{String(selected.verificationStatus ?? "—")}</dd>
                  </dl>
                  <p className="pm-body">{String(
                    (selected.payload as { content?: string } | undefined)?.content
                    ?? selected.description
                    ?? selected.summary
                    ?? "",
                  )}</p>
                  <details>
                    <summary>Raw record</summary>
                    <pre>{JSON.stringify(selected, null, 2)}</pre>
                  </details>
                </>
              ) : (
                <p className="pm-empty">Select a record to view details.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "backup" && (
        <section className="pm-panel">
          <div className="pm-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void createBackup()}>
              <Shield size={14} /> Create backup
            </button>
            <button type="button" disabled={busy} onClick={() => void loadBackups()}>Refresh list</button>
          </div>
          <ul className="pm-list">
            {backups.map((b) => (
              <li key={b.backupId} className="pm-backup-row">
                <div>
                  <strong>{b.backupId}</strong>
                  <span>{b.createdAt}</span>
                </div>
                <button type="button" disabled={busy} onClick={() => void restore(b.backupId)}>Restore…</button>
              </li>
            ))}
            {backups.length === 0 && <li className="pm-empty">No backups yet.</li>}
          </ul>
          <p className="pm-note">Restore always creates a safety copy of current data first. Nothing is deleted automatically.</p>
        </section>
      )}
    </div>
  );
}

function StatusCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const tone =
    value === "READY" || value === "AVAILABLE" || value === "ONLINE"
      ? "ok"
      : value === "FAILED" || value === "OFFLINE" || value === "ERROR"
        ? "bad"
        : "neutral";
  return (
    <div className={`pm-card ${tone}`}>
      <span>{icon} {label}</span>
      <b>{value}</b>
    </div>
  );
}
