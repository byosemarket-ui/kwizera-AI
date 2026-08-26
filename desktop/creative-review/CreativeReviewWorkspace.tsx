import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2, AlertTriangle, Play, Pause, Maximize2, Volume2, MessageSquare,
  FileVideo, Image as ImageIcon, Clapperboard, ShieldCheck, Sparkles,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { creativeReviewEngine } from "./review-engine";
import { formatClock, formatSize, isPlayableMediaPath } from "./assemble";
import type { CreativeReviewUiSnapshot, FeedbackCategory } from "./types";
import { CreativeDecisionPanel } from "../creative-decision/CreativeDecisionPanel";
import { CreativeMemoryPanel } from "../creative-memory/CreativeMemoryPanel";
import "./creative-review.css";

const FEEDBACK_CATS: FeedbackCategory[] = [
  "PRODUCT_VISIBILITY", "TEXT_READABILITY", "AUDIO", "TIMING", "CTA", "VISUAL", "OTHER",
];

export function CreativeReviewWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<CreativeReviewUiSnapshot>(() => creativeReviewEngine.snapshot());
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const [approveOpen, setApproveOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [fbScene, setFbScene] = useState<string>("");
  const [fbCat, setFbCat] = useState<FeedbackCategory>("PRODUCT_VISIBILITY");
  const [fbComment, setFbComment] = useState("");
  const [tsComment, setTsComment] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [compareMode, setCompareMode] = useState<"side" | "slider">("side");
  const [slider, setSlider] = useState(50);
  const [audioId, setAudioId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    creativeReviewEngine.setNotify(notify);
    creativeReviewEngine.setEventEmitter((type, payload) => {
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
    const unsub = creativeReviewEngine.subscribe(setSnap);
    creativeReviewEngine.hydrate();
    return () => {
      unsub();
      creativeReviewEngine.setNotify(null);
      creativeReviewEngine.setEventEmitter(null);
    };
  }, [notify]);

  const s = snap.state;
  const duration = s?.video.durationSec ?? s?.timeline?.totalDurationSec ?? 0;
  const playable = isPlayableMediaPath(s?.video.path);
  const selectedScene = useMemo(
    () => s?.scenes.find((sc) => sc.sceneId === s.selectedSceneId) ?? null,
    [s],
  );

  // Synthetic scrub clock when video file is not streamable
  useEffect(() => {
    if (!playing || playable) return;
    const id = window.setInterval(() => {
      setCurrentTime((t) => {
        const next = t + 0.25 * speed;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, playable, speed, duration]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playable) return;
    v.playbackRate = speed;
    v.volume = volume;
  }, [speed, volume, playable]);

  if (!s) {
    return (
      <div className="crev">
        <header className="cr-hero">
          <div>
            <span className="cr-kicker">Phase 6 · Step 1</span>
            <h1>AI Creative Review Center</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="cr-panel">
          <button type="button" className="cr-primary" onClick={() => switchWorkspace("output")}>Open Final Outputs (Phase 5)</button>
          <button type="button" onClick={() => switchWorkspace("history")}>Production History</button>
        </section>
      </div>
    );
  }

  const togglePlay = () => {
    creativeReviewEngine.beginReview();
    if (playable && videoRef.current) {
      if (videoRef.current.paused) void videoRef.current.play().then(() => setPlaying(true)).catch((e) => {
        creativeReviewEngine.setMediaError(e instanceof Error ? e.message : "Playback failed");
        setPlaying(false);
      });
      else {
        videoRef.current.pause();
        setPlaying(false);
      }
      return;
    }
    setPlaying((p) => !p);
  };

  const onSeek = (value: number) => {
    setCurrentTime(value);
    if (playable && videoRef.current) videoRef.current.currentTime = value;
  };

  const attentionOnly = s.attention.filter((a) => a.severity !== "ok");

  return (
    <div className="crev">
      <header className="cr-hero">
        <div>
          <span className="cr-kicker">Phase 6 · Step 1 · Creative Review</span>
          <h1>AI Creative Review Center</h1>
          <p>Inspect Phase 5 outputs before approval. Review only — no production engines duplicated. Open AI Me for the Creative Assistant (Phase 6 Step 2).</p>
        </div>
        <div className="cr-hero-stats">
          <div><b>{s.projectName}</b><span>PROJECT</span></div>
          <div><b>{s.productionId}</b><span>PRODUCTION</span></div>
          <div><b>{s.versionLabel}</b><span>VERSION</span></div>
          <div><b>{s.reviewStatus.replace(/_/g, " ")}</b><span>REVIEW STATUS</span></div>
          <div><b>{s.creativeScore.label}</b><span>QUALITY / SCORE</span></div>
        </div>
      </header>

      <section className="cr-toolbar">
        <div>
          <strong>{s.productionStatus}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="cr-actions">
          <button type="button" className="cr-primary" onClick={() => setApproveOpen(true)}>APPROVE</button>
          <button type="button" onClick={() => setChangesOpen(true)}>REQUEST CHANGES</button>
          <button type="button" className="cr-primary" onClick={() => switchWorkspace("ai-me")}>OPEN AI REVIEW</button>
          <button type="button" onClick={() => document.getElementById("cr-qc")?.scrollIntoView({ behavior: "smooth" })}>VIEW QUALITY REPORT</button>
          <button type="button" onClick={() => switchWorkspace("output")}>CREATE PREVIEW / OUTPUTS</button>
        </div>
      </section>

      <div className="cr-main">
        <section className="cr-player-wrap">
          <h2><FileVideo size={16} /> Video Preview</h2>
          {s.mediaError && (
            <div className="cr-banner err">
              <AlertTriangle size={16} /> MEDIA PREVIEW ERROR — {s.mediaError}
              <button type="button" onClick={() => { creativeReviewEngine.setMediaError(null); void videoRef.current?.load(); }}>RETRY</button>
              <button type="button" onClick={() => switchWorkspace("output")}>OPEN OUTPUT</button>
            </div>
          )}
          {!s.video.path ? (
            <div className="cr-unavailable">VIDEO PREVIEW UNAVAILABLE — Final video was not found in the Production Package.</div>
          ) : (
            <>
              {playable ? (
                <video
                  ref={videoRef}
                  className="cr-video"
                  src={s.video.path}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onError={() => creativeReviewEngine.setMediaError("Unable to decode or load the video file.")}
                />
              ) : (
                <div className="cr-unavailable">
                  <p>VIDEO PREVIEW UNAVAILABLE</p>
                  <em>{s.video.unavailableReason}</em>
                  <p className="cr-note">Path: {s.video.path}</p>
                  <p className="cr-note">Metadata scrubber below still supports timestamp feedback using registered duration.</p>
                </div>
              )}
              <div className="cr-controls">
                <button type="button" onClick={togglePlay}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
                <input
                  ref={scrubRef}
                  type="range"
                  min={0}
                  max={Math.max(duration, 0.1)}
                  step={0.1}
                  value={Math.min(currentTime, duration)}
                  onChange={(e) => onSeek(Number(e.target.value))}
                />
                <span>{formatClock(currentTime)} / {formatClock(duration)}</span>
                <label><Volume2 size={14} /><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></label>
                <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => <option key={v} value={v}>{v}x</option>)}
                </select>
                <button type="button" onClick={() => videoRef.current?.requestFullscreen?.()} disabled={!playable}><Maximize2 size={14} /></button>
              </div>
              <div className="cr-meta-row">
                <span>Resolution: {s.video.resolution || "—"}</span>
                <span>Frame Rate: {s.video.frameRate ? `${s.video.frameRate} FPS` : "—"}</span>
                <span>Duration: {formatClock(s.video.durationSec)}</span>
                <span>Format: {s.video.format || "—"}</span>
                <span>File Size: {formatSize(s.video.fileSizeBytes) || "—"}</span>
                <span>Version: {s.video.version || "—"}</span>
              </div>
              <div className="cr-ts-row">
                <input value={tsComment} onChange={(e) => setTsComment(e.target.value)} placeholder="ADD COMMENT AT CURRENT TIME" />
                <button type="button" onClick={() => {
                  creativeReviewEngine.addTimestampComment(currentTime, tsComment, s.selectedSceneId);
                  setTsComment("");
                  void workspaceStateEngine.autoSave.markDirty();
                  notify("success", "Comment saved", `At ${formatClock(currentTime)}`, "information");
                }}><MessageSquare size={14} /> Add</button>
              </div>
            </>
          )}
        </section>

        <aside className="cr-summary">
          <h2>Creative Review Summary</h2>
          <div className="cr-score-grid">
            <Score label="Visual Quality" value={s.creativeScore.visual} />
            <Score label="Audio Quality" value={s.creativeScore.audio} />
            <Score label="Text Readability" value={s.creativeScore.text} />
            <Score label="Product Visibility" value={s.creativeScore.product} />
            <Score label="Overall" value={s.creativeScore.overall} />
          </div>
          <p className="cr-note">Creative scores: {s.creativeScore.label} (existing QC has no numeric score — not invented).</p>

          <h3>AI REVIEW</h3>
          {s.aiReview.availability === "NOT_AVAILABLE" ? (
            <div className="cr-ai-na">
              <p>AI REVIEW NOT AVAILABLE</p>
              <em>{s.aiReview.note}</em>
              <button type="button" className="cr-primary" onClick={() => switchWorkspace("ai-me")}>
                <Sparkles size={14} /> RUN AI REVIEW
              </button>
            </div>
          ) : (
            <div className="cr-ai-na">
              <p className="ok">AI REVIEW AVAILABLE</p>
              <em>{s.aiReview.note}</em>
              {s.aiReview.issues.map((i) => <p key={i} className="err">✕ {i}</p>)}
              {s.aiReview.suggestions.map((i) => <p key={i}>○ SUGGESTION: {i}</p>)}
              <button type="button" className="cr-primary" onClick={() => switchWorkspace("ai-me")}>
                <Sparkles size={14} /> OPEN AI ME
              </button>
            </div>
          )}
          {s.aiReview.warnings.length > 0 && (
            <ul className="cr-list">{s.aiReview.warnings.map((w) => <li key={w}>○ {w}</li>)}</ul>
          )}

          <h3>NEEDS YOUR ATTENTION</h3>
          {attentionOnly.length === 0 ? (
            <p className="ok">ALL CHECKS LOOK GOOD ✓</p>
          ) : attentionOnly.map((a) => (
            <p key={a.id} className={a.severity === "error" ? "err" : "warn"}>
              {a.severity === "error" ? "✕" : "⚠"} {a.message}
            </p>
          ))}

          <h3 id="cr-qc">QUALITY CONTROL</h3>
          <p className={s.qc?.overall === "PASS" ? "ok" : "err"}>
            <ShieldCheck size={14} /> {s.qc?.overall ?? "NOT AVAILABLE"}
          </p>
          {s.qcChecks.map((c) => (
            <div key={c.id} className="cr-line">
              <span>{c.status === "PASS" ? "✓" : c.status === "FAIL" ? "✕" : "○"}</span>
              <strong>{c.label}</strong>
              <em>{c.status}</em>
            </div>
          ))}
        </aside>
      </div>

      <div className="cr-bottom">
        <Panel title="Scenes" icon={<Clapperboard size={14} />}>
          <div className="cr-scene-grid">
            {s.scenes.map((sc) => (
              <button
                key={sc.sceneId}
                type="button"
                className={s.selectedSceneId === sc.sceneId ? "selected" : ""}
                onClick={() => creativeReviewEngine.selectScene(sc.sceneId)}
              >
                <b>SCENE {String(sc.sceneNumber).padStart(2, "0")}</b>
                <span>{formatClock(sc.startSec)} — {formatClock(sc.endSec)}</span>
                <em>{sc.hasVisual ? "✓ Visual" : "○ Visual"} · {sc.hasVoice ? "✓ Voice" : "○ Voice"} · {sc.hasText ? "✓ Text" : "○ Text"}</em>
              </button>
            ))}
          </div>
          {selectedScene && (
            <div className="cr-scene-detail">
              <h4>{selectedScene.name}</h4>
              <p>Duration: {selectedScene.durationSec}s · Transition: {selectedScene.transition}</p>
              <p>Narration: {selectedScene.narration || "—"}</p>
              <p>On-screen: {selectedScene.onScreenText || "—"}</p>
              <p>Product: {selectedScene.productFocus || "—"}</p>
              <p className="cr-note">Visual: {selectedScene.visualRef || "—"}</p>
            </div>
          )}
        </Panel>

        <Panel title="Timeline" icon={<Clapperboard size={14} />}>
          {!s.timeline && <p className="cr-note">Master Timeline not loaded.</p>}
          {s.timeline && (
            <div className="cr-timeline">
              <div className="track"><span>VIDEO</span><div className="clips">{s.timeline.clips.map((c) => (
                <i key={c.sceneId} style={{ flex: c.durationSec }} title={c.sceneName}>{c.sceneName}</i>
              ))}</div></div>
              <div className="track"><span>AUDIO</span><div className="bar voice">Voice</div></div>
              <div className="track"><span>MUSIC</span><div className="bar music">Music</div></div>
              <div className="track"><span>TEXT</span><div className="bar text">CTA / On-screen</div></div>
              <div className="track"><span>SUBTITLES</span><div className="bar sub">Subtitles</div></div>
              <p className="cr-note">From existing Master Timeline · {s.timeline.totalDurationSec}s · gaps {s.timeline.gaps} · overlaps {s.timeline.overlaps}</p>
            </div>
          )}
        </Panel>

        <Panel title="Audio Review" icon={<Volume2 size={14} />}>
          <audio ref={audioRef} onError={() => creativeReviewEngine.setMediaError("Audio preview failed to load.")} />
          {s.audioTracks.length === 0 && <p className="cr-note">No audio tracks registered.</p>}
          {s.audioTracks.map((t) => (
            <div key={t.id} className="cr-audio-row">
              <strong>{t.name}</strong>
              <em>{t.kind} · {formatClock(t.durationSec)} · {t.status}</em>
              <button type="button" onClick={() => {
                setAudioId(t.id);
                if (audioRef.current && isPlayableMediaPath(t.path)) {
                  audioRef.current.src = t.path;
                  void audioRef.current.play().catch((e) => creativeReviewEngine.setMediaError(e instanceof Error ? e.message : "Audio play failed"));
                } else {
                  notify("info", "Audio path", "Registered locally; browser cannot stream this path. Path: " + t.path, "information");
                }
              }}>{audioId === t.id ? "Playing…" : "Play"}</button>
              <div className="cr-wave" aria-hidden title="Waveform placeholder — real waveform when audio decoder available">
                <span style={{ width: `${30 + (t.id.length % 40)}%` }} />
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Image Assets" icon={<ImageIcon size={14} />}>
          <div className="cr-img-grid">
            {s.images.map((img) => (
              <article key={img.assetId}>
                <div className="cr-img-ph">{img.label}</div>
                <b>{img.type}</b>
                <em>{img.validationStatus}</em>
                <span className="cr-note">{img.path}</span>
              </article>
            ))}
          </div>
          <h4>Before / After</h4>
          <div className="cr-actions">
            <button type="button" className={compareMode === "side" ? "cr-primary" : ""} onClick={() => setCompareMode("side")}>Side-by-side</button>
            <button type="button" className={compareMode === "slider" ? "cr-primary" : ""} onClick={() => setCompareMode("slider")}>Slider</button>
          </div>
          {compareMode === "side" ? (
            <div className="cr-compare">
              <div><b>BEFORE</b><p>{s.comparisonBefore?.path || "—"}</p></div>
              <div><b>AFTER</b><p>{s.comparisonAfter?.path || "—"}</p></div>
            </div>
          ) : (
            <div className="cr-slider-wrap">
              <input type="range" min={0} max={100} value={slider} onChange={(e) => setSlider(Number(e.target.value))} />
              <p className="cr-note">Slider {slider}% · Before: {s.comparisonBefore?.label || "—"} · After: {s.comparisonAfter?.label || "—"}</p>
            </div>
          )}
        </Panel>

        <Panel title="Text & Subtitles">
          <p className="cr-note">Language: {s.package ? "from production snapshot" : "—"}</p>
          {s.textLines.map((l) => (
            <div key={l.id} className={`cr-text ${l.highlight}`}>
              <strong>{l.kind}</strong> · Scene {l.sceneId}
              <p>{l.text}</p>
            </div>
          ))}
        </Panel>

        <Panel title="Review Notes & Feedback">
          <div className="cr-ts-row">
            <input value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Review note…" />
            <button type="button" onClick={() => {
              creativeReviewEngine.addNote(noteBody, s.selectedSceneId, currentTime);
              setNoteBody("");
            }}>Save Note</button>
          </div>
          {s.notes.map((n) => <p key={n.noteId} className="cr-note">{n.body} · {n.createdAt}</p>)}
          {s.timestampComments.map((c) => (
            <p key={c.commentId}><b>{formatClock(c.timestampSec)}</b> — {c.comment}</p>
          ))}
          {s.feedback.map((f) => (
            <p key={f.feedbackId} className="warn">{f.category}: {f.comment}</p>
          ))}
        </Panel>

        <Panel title="Version History">
          {s.versionHistory.map((v) => (
            <button key={v.packageId + v.versionLabel} type="button" className="cr-version" onClick={() => creativeReviewEngine.selectVersion(v.versionLabel)}>
              <b>{v.versionLabel}</b> · {v.status} · QC {v.qcResult}
            </button>
          ))}
          {s.versionHistory.length === 0 && <p className="cr-note">No history entries for this production.</p>}
        </Panel>
      </div>

      {approveOpen && (
        <Modal onClose={() => setApproveOpen(false)}>
          <h3>APPROVE THIS VERSION?</h3>
          <p>Version: {s.versionLabel}</p>
          <p className="cr-note">Files will not be overwritten or deleted.</p>
          <div className="cr-actions">
            <button type="button" className="cr-primary" onClick={() => {
              creativeReviewEngine.approve();
              setApproveOpen(false);
            }}><CheckCircle2 size={14} /> Approve</button>
            <button type="button" onClick={() => setApproveOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {changesOpen && (
        <Modal onClose={() => setChangesOpen(false)}>
          <h3>REQUEST CHANGES</h3>
          <label>Scene
            <select value={fbScene} onChange={(e) => setFbScene(e.target.value)}>
              <option value="">—</option>
              {s.scenes.map((sc) => <option key={sc.sceneId} value={sc.sceneId}>{sc.name}</option>)}
            </select>
          </label>
          <label>Category
            <select value={fbCat} onChange={(e) => setFbCat(e.target.value as FeedbackCategory)}>
              {FEEDBACK_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Comment
            <textarea value={fbComment} onChange={(e) => setFbComment(e.target.value)} rows={3} />
          </label>
          <p className="cr-note">Timestamp: {formatClock(currentTime)} — production will not be modified yet.</p>
          <div className="cr-actions">
            <button type="button" className="cr-primary" onClick={() => {
              creativeReviewEngine.addFeedback({
                sceneId: fbScene || null,
                category: fbCat,
                comment: fbComment,
                timestampSec: currentTime,
              });
              creativeReviewEngine.requestChanges();
              setFbComment("");
              setChangesOpen(false);
            }}>Save Feedback</button>
            <button type="button" onClick={() => setChangesOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      <CreativeMemoryPanel />
      <CreativeDecisionPanel />
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value == null ? "NOT AVAILABLE" : `${value}%`}</b>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="cr-panel">
      <h2>{icon} {title}</h2>
      {children}
    </section>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="cr-modal" role="dialog">
      <div className="cr-modal-body">
        {children}
        <button type="button" className="cr-modal-x" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
