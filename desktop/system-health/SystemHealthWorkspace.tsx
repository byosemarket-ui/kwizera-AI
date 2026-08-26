import { useCallback, useEffect, useState } from "react";
import {
  Activity, Cpu, HardDrive, HeartPulse, RefreshCw, Shield, Wrench,
} from "lucide-react";
import { systemHealthApi } from "./api-client";
import "./system-health.css";

type Tab = "overview" | "services" | "repair" | "update" | "diagnostics" | "certification";

export function SystemHealthWorkspace() {
  const [tab, setTab] = useState<Tab>("overview");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [selfTest, setSelfTest] = useState<{ checks: Array<{ id: string; ok: boolean; detail: string }>; passed: number; total: number } | null>(null);
  const [repairs, setRepairs] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cert, setCert] = useState<{
    ok?: boolean;
    error?: string;
    verdict?: string;
    version?: string;
    generatedAt?: string;
    counts?: Record<string, number>;
    results?: Array<{ id: string; name: string; expected: string; actual: string; status: string }>;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [h, s] = await Promise.all([
        systemHealthApi.health(),
        systemHealthApi.session().catch(() => null),
      ]);
      setReport(h);
      if (s) setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Health check failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const subsystems = (report?.subsystems as Array<Record<string, unknown>> | undefined) ?? [];
  const resources = (report?.resources as Record<string, unknown> | undefined) ?? {};
  const update = (report?.update as Record<string, unknown> | undefined) ?? {};

  async function runSelfTest() {
    setBusy(true);
    try {
      const res = await systemHealthApi.selfTest();
      setSelfTest(res);
      setMessage(`Self-test ${res.passed}/${res.total} passed`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Self-test failed");
    } finally {
      setBusy(false);
    }
  }

  async function runRepair(action: string, component?: string) {
    setBusy(true);
    try {
      const res = await systemHealthApi.repair({ action, component, problem: "User-initiated safe repair" });
      setMessage(`${String(res.action)} → ${String(res.result)} (${String(res.finalStatus)})`);
      const list = await systemHealthApi.repairs();
      setRepairs(list.repairs);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repair failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sh-workspace">
      <header className="sh-header">
        <div>
          <p className="sh-kicker">Phase 7 · Steps 4–5</p>
          <h1><HeartPulse size={22} /> System Health</h1>
          <p>Windows machine integration — health, safe repair, update foundation, Phase 7 certification. User data is never deleted by repairs.</p>
        </div>
        <div className="sh-actions">
          <button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14} /> Refresh</button>
          <button type="button" className="primary" onClick={() => void runSelfTest()} disabled={busy}>Run self-test</button>
        </div>
      </header>

      {session?.interrupted && (
        <div className="sh-banner warn">
          Previous session may have been interrupted{session.markerAt ? ` (${session.markerAt})` : ""}.
          <button type="button" onClick={() => void systemHealthApi.ackSession().then(refresh)}>Acknowledge</button>
        </div>
      )}
      {error && <div className="sh-banner error">{error}</div>}
      {message && <div className="sh-banner ok">{message}</div>}

      <div className="sh-score">
        <div>
          <span>System Health</span>
          <b>{String(report?.healthScore ?? "…")}%</b>
        </div>
        <div>
          <span>Overall</span>
          <em className={String(report?.overallStatus ?? "")}>{String(report?.overallStatus ?? "…")}</em>
        </div>
        <div>
          <span>Version</span>
          <em>{String(report?.applicationVersion ?? "…")}</em>
        </div>
        <div>
          <span>Network</span>
          <em>{String((report?.network as { state?: string } | undefined)?.state ?? "…")}</em>
        </div>
      </div>

      <nav className="sh-tabs">
        {(["overview", "services", "repair", "update", "diagnostics", "certification"] as Tab[]).map((id) => (
          <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => {
            setTab(id);
            if (id === "repair") void systemHealthApi.repairs().then((r) => setRepairs(r.repairs));
            if (id === "certification") {
              void systemHealthApi.certification().then(setCert).catch((e) => setCert({ ok: false, error: e instanceof Error ? e.message : "Unavailable", verdict: "NOT READY" }));
            }
          }}>{id}</button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="sh-grid">
          {subsystems.map((s) => (
            <div key={String(s.id)} className={`sh-card ${String(s.status)}`}>
              <span>{String(s.label)}</span>
              <b>{String(s.status)}</b>
              <small>{String(s.detail)}</small>
            </div>
          ))}
          <div className="sh-panel wide">
            <h2><Cpu size={16} /> Resources</h2>
            <dl>
              <dt>CPU</dt><dd>{String(resources.cpuUsage ?? "—")}%</dd>
              <dt>RAM</dt><dd>{String(resources.ramUsage ?? "—")}% · {String(resources.ramUsedMb ?? "—")}/{String(resources.ramTotalMb ?? "—")} MB</dd>
              <dt>Disk</dt><dd>{String(resources.diskUsage ?? "—")}% · {String(resources.diskThreshold ?? "—")} · {String(resources.storageUsedGb ?? "—")}/{String(resources.storageTotalGb ?? "—")} GB</dd>
              <dt>GPU</dt><dd>{String(resources.gpu ?? "NOT AVAILABLE")}</dd>
              <dt>VRAM</dt><dd>{String(resources.vram ?? "NOT AVAILABLE")}</dd>
              <dt>App root</dt><dd>{String(report?.appRoot ?? "—")}</dd>
              <dt>User data</dt><dd>{String(report?.storageRoot ?? "—")}</dd>
            </dl>
          </div>
          {selfTest && (
            <div className="sh-panel wide">
              <h2>Self-test {selfTest.passed}/{selfTest.total}</h2>
              <ul className="sh-checklist">
                {selfTest.checks.map((c) => (
                  <li key={c.id}>{c.ok ? "[✓]" : "[ ]"} {c.id} — {c.detail}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "services" && (
        <section className="sh-panel">
          <h2><Activity size={16} /> Service registry</h2>
          <ul className="sh-list">
            {((report?.services as Array<Record<string, unknown>>) ?? []).map((s) => (
              <li key={String(s.id)}>
                <strong>{String(s.name)}</strong>
                <span>{String(s.status)} · {String(s.criticality)} · restarts {String(s.restartAttempts)}/{String(s.maxRestarts)}</span>
                {s.lastError ? <em>{String(s.lastError)}</em> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "repair" && (
        <section className="sh-panel">
          <h2><Wrench size={16} /> Safe repair (allowlist only)</h2>
          <p className="sh-note">Repairs never delete projects, memory, knowledge, or databases. Arbitrary shell commands are blocked.</p>
          <div className="sh-actions">
            <button type="button" disabled={busy} onClick={() => void runRepair("diagnose-only")}>Diagnose only</button>
            <button type="button" disabled={busy} onClick={() => void runRepair("ensure-temp-dirs")}>Ensure temp/cache dirs</button>
            <button type="button" disabled={busy} onClick={() => void runRepair("create-safety-backup")}>Create safety backup</button>
            <button type="button" disabled={busy} onClick={() => void runRepair("restart-registered-service", "memory")}>Soft-restart memory</button>
            <button type="button" disabled={busy} onClick={() => void runRepair("flush-logs-marker")}>Flush log marker</button>
          </div>
          <ul className="sh-list">
            {repairs.map((r) => (
              <li key={String(r.id)}>
                <strong>{String(r.action)}</strong>
                <span>{String(r.at)} · {String(r.result)} · {String(r.finalStatus)}</span>
                <em>{String(r.diagnosis)}</em>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "update" && (
        <section className="sh-panel">
          <h2><Shield size={16} /> Update foundation</h2>
          <dl>
            <dt>Phase</dt><dd>{String(update.phase)}</dd>
            <dt>Current</dt><dd>{String(update.currentVersion)}</dd>
            <dt>Available</dt><dd>{String(update.availableVersion ?? "None")}</dd>
            <dt>Note</dt><dd>{String(update.note)}</dd>
          </dl>
          <div className="sh-actions">
            <button type="button" disabled={busy} onClick={() => void systemHealthApi.updateCheck({}).then((u) => { setMessage(String(u.note)); return refresh(); })}>
              Check update (no download)
            </button>
            <button type="button" className="primary" disabled={busy} onClick={() => void systemHealthApi.updateBackup().then((r) => setMessage(r.ok ? `Backup ${r.backupId}` : r.error ?? "failed"))}>
              Pre-update backup
            </button>
            <button type="button" disabled={busy} onClick={() => void systemHealthApi.rollback().then((u) => setMessage(String(u.note)))}>
              Rollback foundation
            </button>
          </div>
          <p className="sh-note">Application updates install via trusted Setup EXE / desktop:pack. User data under storage root is preserved.</p>
        </section>
      )}

      {tab === "diagnostics" && (
        <section className="sh-panel">
          <h2><HardDrive size={16} /> Diagnostics</h2>
          <div className="sh-actions">
            <button type="button" disabled={busy} onClick={() => void systemHealthApi.full().then((r) => { setReport(r); setMessage("Full diagnostic complete"); })}>
              Run full diagnostic
            </button>
            <button type="button" disabled={busy} onClick={() => void systemHealthApi.diagnostic().then((r) => setMessage(`Report: ${r.path}`))}>
              Write diagnostic report
            </button>
            <button type="button" disabled={busy} onClick={() => void systemHealthApi.supportBundle().then((r) => setMessage(`Support bundle: ${String(r.path)}`))}>
              Create support bundle
            </button>
          </div>
          <p className="sh-note">Support bundles exclude passwords, API keys, tokens, and media binaries.</p>
        </section>
      )}

      {tab === "certification" && (
        <section className="sh-panel">
          <h2><Shield size={16} /> Phase 7 final certification</h2>
          {!cert && <p className="sh-note">Loading certification report…</p>}
          {cert && (
            <>
              <div className="sh-score">
                <div>
                  <span>SYSTEM STATUS</span>
                  <em className={cert.verdict === "PRODUCTION READY" ? "READY" : cert.verdict === "NOT READY" ? "FAILED" : "DEGRADED"}>
                    {cert.verdict ?? "NOT READY"}
                  </em>
                </div>
                <div>
                  <span>Version</span>
                  <em>{cert.version ?? "—"}</em>
                </div>
                <div>
                  <span>Generated</span>
                  <em>{cert.generatedAt ? new Date(cert.generatedAt).toLocaleString() : "—"}</em>
                </div>
              </div>
              {cert.error && <p className="sh-note">{cert.error}</p>}
              {cert.counts && (
                <p className="sh-note">
                  PASS {cert.counts.pass ?? 0} · FAIL {cert.counts.fail ?? 0} · LIMITED {cert.counts.limited ?? 0} · SKIP {cert.counts.skip ?? 0}
                </p>
              )}
              <ul className="sh-checklist">
                {(cert.results ?? []).map((r) => (
                  <li key={r.id}>
                    [{r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "△"}] {r.name} — {r.status}
                    <small> {r.actual}</small>
                  </li>
                ))}
              </ul>
              <p className="sh-note">Re-run: npm run certify:phase7 — then refresh this tab. Only verified checks show as PASS.</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
