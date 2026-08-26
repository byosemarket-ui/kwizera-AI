import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, AlertTriangle, LoaderCircle } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { creativeAssistantEngine, QUICK_COMMANDS } from "./assistant-engine";
import type { AssistantAction, AssistantUiSnapshot } from "./types";
import { CreativeDecisionPanel } from "../creative-decision/CreativeDecisionPanel";
import { CreativeMemoryPanel } from "../creative-memory/CreativeMemoryPanel";
import "./creative-assistant.css";

export function CreativeAssistantWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<AssistantUiSnapshot>(() => creativeAssistantEngine.snapshot());
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    creativeAssistantEngine.setNotify(notify);
    creativeAssistantEngine.setNavigate(switchWorkspace);
    creativeAssistantEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product.updated", "state.shared", "notify.info", "notify.warning",
        "production.progress", "rendering.completed",
      ]);
      const eventType = allowed.has(type) ? type : "state.shared";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product.updated",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace"],
        payload,
        priority: "normal",
      });
    });
    const unsub = creativeAssistantEngine.subscribe(setSnap);
    creativeAssistantEngine.hydrate();
    return () => {
      unsub();
      creativeAssistantEngine.setNotify(null);
      creativeAssistantEngine.setNavigate(null);
      creativeAssistantEngine.setEventEmitter(null);
    };
  }, [notify, switchWorkspace]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [snap.conversation?.messages.length, snap.streamingText, snap.thinking]);

  const ctx = snap.context;
  const messages = snap.conversation?.messages ?? [];

  const send = () => {
    const body = draft.trim();
    if (!body || snap.thinking) return;
    setDraft("");
    void creativeAssistantEngine.sendMessage(body);
  };

  const onAction = (action: AssistantAction) => {
    void creativeAssistantEngine.handleAction(action);
  };

  return (
    <div className="ca">
      <header className="ca-hero">
        <div>
          <span className="ca-kicker">Phase 6 · Step 2 · AI Me</span>
          <h1>AI Me Creative Assistant</h1>
          <p>
            Natural-language control over live project, production, review, QC, and version state.
            Safe changes require confirmation and use existing production systems.
          </p>
        </div>
        <div className="ca-hero-stats">
          <div><b>{ctx.available ? ctx.projectName || "—" : "Unavailable"}</b><span>PROJECT</span></div>
          <div><b>{ctx.versionLabel || "—"}</b><span>VERSION</span></div>
          <div><b>{ctx.reviewStatus || "—"}</b><span>REVIEW</span></div>
          <div><b>{ctx.qcOverall || "—"}</b><span>QC</span></div>
        </div>
      </header>

      {!ctx.available && (
        <section className="ca-banner">
          <AlertTriangle size={16} />
          <div>
            <strong>PROJECT CONTEXT UNAVAILABLE</strong>
            <p>{ctx.unavailableReason}</p>
          </div>
          <button type="button" className="ca-primary" onClick={() => switchWorkspace("creative-review")}>
            Open Creative Review
          </button>
        </section>
      )}

      <div className="ca-layout">
        <section className="ca-chat">
          <div className="ca-chat-head">
            <Bot size={18} />
            <div>
              <strong>AI ME</strong>
              <span>{snap.recommendation}</span>
            </div>
            <button type="button" onClick={() => creativeAssistantEngine.hydrate()}>Refresh context</button>
          </div>

          <div className="ca-quick">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                disabled={snap.thinking}
                onClick={() => void creativeAssistantEngine.sendQuickCommand(cmd.id)}
              >
                {cmd.label}
              </button>
            ))}
          </div>

          <div className="ca-stream">
            {messages.map((m) => (
              <article key={m.id} className={`ca-msg ${m.role}`}>
                <header>
                  <b>{m.role === "user" ? "You" : m.title || "AI Me"}</b>
                  {m.intent && <em>{m.intent}</em>}
                </header>
                <pre>{m.body}</pre>
                {m.suggestionCards && m.suggestionCards.length > 0 && (
                  <div className="ca-suggestions">
                    {m.suggestionCards.map((card) => (
                      <div key={card.id} className="ca-sug">
                        <span className="ca-tag">SUGGESTION</span>
                        <strong>{card.title}</strong>
                        <p><b>Reason:</b> {card.reason}</p>
                        <p><b>Affected:</b> {card.affectedArea}</p>
                        <p><b>Expected benefit:</b> {card.expectedBenefit}</p>
                        <button
                          type="button"
                          className="ca-primary"
                          onClick={() => onAction({
                            id: `prep-${card.id}`,
                            label: "PREPARE CHANGE",
                            kind: "prepare",
                            payload: card.preparePayload as unknown as Record<string, unknown>,
                          })}
                        >
                          PREPARE CHANGE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {m.actions && m.actions.length > 0 && (
                  <div className="ca-actions">
                    {m.actions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={a.kind === "proceed" ? "ca-primary" : undefined}
                        onClick={() => onAction(a)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {(snap.thinking || snap.streamingText) && (
              <article className="ca-msg assistant thinking">
                <header>
                  <LoaderCircle size={14} className="spin" />
                  <b>AI is thinking...</b>
                </header>
                {snap.streamingText && <pre>{snap.streamingText}</pre>}
              </article>
            )}
            <div ref={endRef} />
          </div>

          <div className="ca-composer">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder='How can I help with this production? e.g. "Why did QC fail?" · "Scene 3 ntabwo igaragara neza."'
              disabled={snap.thinking}
            />
            <button type="button" className="ca-primary" disabled={!draft.trim() || snap.thinking} onClick={send} title="Send">
              <Send size={16} />
            </button>
          </div>
        </section>

        <aside className="ca-side">
          <section className="ca-panel">
            <h2><Sparkles size={14} /> Live context</h2>
            <dl>
              <dt>Production</dt><dd>{ctx.productionId || "—"}</dd>
              <dt>Run</dt><dd>{ctx.runId || "—"}</dd>
              <dt>Product</dt><dd>{ctx.productName || "—"}</dd>
              <dt>Marketing</dt><dd>{ctx.marketingSummary || "—"}</dd>
              <dt>Creative</dt><dd>{ctx.creativeSummary || "—"}</dd>
              <dt>Video</dt><dd>{ctx.videoMeta || (ctx.videoAvailable ? "Available" : "Unavailable")}</dd>
              <dt>Progress</dt><dd>{ctx.progress != null ? `${ctx.progress}%` : "—"} · {ctx.currentStage || "—"}</dd>
              <dt>Resources</dt><dd>{ctx.resourceSummary || "—"}</dd>
              <dt>Feedback</dt><dd>{ctx.feedbackCount} · comments {ctx.commentCount}</dd>
              <dt>Refreshed</dt><dd>{ctx.refreshedAt ? new Date(ctx.refreshedAt).toLocaleTimeString() : "—"}</dd>
            </dl>
          </section>

          {snap.pendingProposal && (
            <section className="ca-panel ca-proposal">
              <h2>CHANGE REQUEST</h2>
              <p><b>Current:</b> {snap.pendingProposal.sourceVersionId}</p>
              <p><b>Requested:</b> {snap.pendingProposal.requestedChange}</p>
              <p><b>Interpretation:</b> {snap.pendingProposal.aiInterpretation}</p>
              <p><b>New version:</b> {snap.pendingProposal.requestedVersion}</p>
              <p><b>Status:</b> {snap.pendingProposal.status}</p>
              <div className="ca-actions">
                <button
                  type="button"
                  className="ca-primary"
                  onClick={() => onAction({
                    id: "apply",
                    label: "APPLY",
                    kind: "proceed",
                    payload: { changeId: snap.pendingProposal!.changeId },
                  })}
                >
                  APPLY
                </button>
                <button
                  type="button"
                  onClick={() => onAction({
                    id: "cancel",
                    label: "CANCEL",
                    kind: "cancel",
                    payload: { changeId: snap.pendingProposal!.changeId },
                  })}
                >
                  CANCEL
                </button>
              </div>
            </section>
          )}

          <section className="ca-panel">
            <h2>Audit (recent)</h2>
            <ul className="ca-audit">
              {snap.audit.slice(-8).reverse().map((a) => (
                <li key={a.id}>
                  <strong>{a.action}</strong>
                  <span>{a.detail}</span>
                  <em>{a.result}</em>
                </li>
              ))}
              {!snap.audit.length && <li className="muted">No AI actions yet.</li>}
            </ul>
          </section>

          <section className="ca-panel">
            <h2>Navigate</h2>
            <div className="ca-actions">
              <button type="button" onClick={() => switchWorkspace("creative-review")}>Creative Review</button>
              <button type="button" onClick={() => switchWorkspace("output")}>Final Outputs</button>
              <button type="button" onClick={() => switchWorkspace("command-center")}>Command Center</button>
              <button type="button" onClick={() => switchWorkspace("history")}>Version History</button>
            </div>
          </section>
        </aside>
      </div>

      <CreativeMemoryPanel compact />
      <CreativeDecisionPanel compact />
    </div>
  );
}
