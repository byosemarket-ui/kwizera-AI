import { useEffect, useState } from "react";
import { fetchAiCoreStatus, type AiCoreStatusSnapshot } from "./ai-core-status";
import "./ai-core-status.css";

export function AiCoreStatusPanel({ pollMs = 45_000 }: { pollMs?: number }) {
  const [snap, setSnap] = useState<AiCoreStatusSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchAiCoreStatus();
        if (!cancelled) {
          setSnap(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Status unavailable");
      }
    };
    void load();
    const t = window.setInterval(() => void load(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [pollMs]);

  if (error && !snap) {
    return (
      <div className="ai-core-status ai-core-status--error" role="status">
        <span>AI status unavailable</span>
      </div>
    );
  }
  if (!snap) {
    return (
      <div className="ai-core-status ai-core-status--loading" role="status">
        <span>Checking AI…</span>
      </div>
    );
  }

  return (
    <div className={`ai-core-status ai-core-status--${snap.aiCore.toLowerCase()}`} role="status">
      <div className="ai-core-status__row">
        <span className="ai-core-status__k">AI CORE</span>
        <span className="ai-core-status__v">{snap.aiCore}</span>
      </div>
      <div className="ai-core-status__row">
        <span className="ai-core-status__k">OLLAMA</span>
        <span className="ai-core-status__v">{snap.ollama}</span>
      </div>
      <div className="ai-core-status__row">
        <span className="ai-core-status__k">MODEL</span>
        <span className="ai-core-status__v">{snap.model ?? "—"}</span>
      </div>
      <div className="ai-core-status__row">
        <span className="ai-core-status__k">VIDEO KNOWLEDGE</span>
        <span className="ai-core-status__v">
          {snap.videoKnowledge.ready ? "READY" : "—"} · {snap.videoKnowledge.version} ({snap.videoKnowledge.count})
        </span>
      </div>
      <div className="ai-core-status__row">
        <span className="ai-core-status__k">VIDEO SKILLS</span>
        <span className="ai-core-status__v">
          {snap.videoSkills.ready ? "READY" : "—"} · {snap.videoSkills.version} ({snap.videoSkills.count})
        </span>
      </div>
      <div className="ai-core-status__row">
        <span className="ai-core-status__k">CREATIVE DIRECTOR</span>
        <span className="ai-core-status__v">{snap.creativeDirector}</span>
      </div>
      {snap.latencyMs != null && (
        <div className="ai-core-status__note">Probe {snap.latencyMs}ms · {snap.note}</div>
      )}
      {!snap.latencyMs && snap.note && <div className="ai-core-status__note">{snap.note}</div>}
    </div>
  );
}
