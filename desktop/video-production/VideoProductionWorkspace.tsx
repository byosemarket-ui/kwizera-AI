import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Clapperboard, Film, Play, RefreshCw } from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { resolveBoundProject } from "../product-creation/workflow";
import type { CreativeProjectDto } from "../product-intake/api";
import {
  ASPECT_OPTIONS,
  CAMERA_OPTIONS,
  MOTION_OPTIONS,
  TRANSITION_OPTIONS,
  VIDEO_PLATFORM_OPTIONS,
  createVideoProject,
  getVideoJob,
  getVideoOutputDetails,
  getVideoProject,
  startVideoRender,
  updateVideoProject,
  validateVideoRender,
  type VideoOutputDetails,
  type VideoProject,
  type VideoRenderJob,
  type VideoRenderValidation,
} from "./api";
import "./video-production.css";

export function VideoProductionWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [project, setProject] = useState<CreativeProjectDto | null>(null);
  const [video, setVideo] = useState<VideoProject | null>(null);
  const [job, setJob] = useState<VideoRenderJob | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [validation, setValidation] = useState<VideoRenderValidation | null>(null);
  const [outputDetails, setOutputDetails] = useState<VideoOutputDetails | null>(null);

  const selected = video?.timeline.find((clip) => clip.id === selectedId) ?? video?.timeline[0];
  const assetUrl = (assetId?: string) => project?.productImages.find((image) => image.id === assetId)?.url;

  const productInfo = project?.productInformation;
  const checkpoint = useMemo(() => ({
    name: productInfo?.name ?? productInfo?.title ?? project?.name ?? "—",
    imageCount: (project?.productImages ?? []).filter((image) => !image.parentAssetId && image.assetType !== "video").length,
    platform: video?.platform ?? project?.platform ?? "—",
    price: productInfo?.price ?? productInfo?.currentPrice,
    oldPrice: productInfo?.originalPrice ?? productInfo?.oldPrice,
    discount: productInfo?.discountPercentage ?? productInfo?.discount,
    website: productInfo?.website,
    cta: productInfo?.callToAction ?? productInfo?.cta,
    sceneCount: video?.timeline.length ?? 0,
    aspect: video?.renderPlan.aspectRatio ?? "—",
  }), [project, productInfo, video]);

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (selected) setTextDraft(selected.text[0]?.content ?? "");
  }, [selected?.id]);

  useEffect(() => {
    const jobId = job?.id || video?.activeJobId;
    if (!jobId || !project || (job?.status !== "queued" && job?.status !== "processing" && video?.renderState !== "queued" && video?.renderState !== "processing")) {
      return;
    }
    const projectId = project.id;
    const timer = window.setInterval(() => {
      void getVideoJob(projectId, jobId).then((result) => {
        setJob(result.job);
        if (result.job.status === "completed" || result.job.status === "failed") {
          void getVideoProject(projectId).then((payload) => setVideo(payload.video));
        }
      }).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status, video?.activeJobId, video?.renderState, project?.id]);

  async function hydrate() {
    setError(null);
    const bound = await resolveBoundProject();
    if (!bound) {
      setError("Open a project with a Creative Plan before producing video.");
      return;
    }
    setProject(bound.project);
    const payload = await getVideoProject(bound.projectId);
    setVideo(payload.video);
    if (payload.video) {
      void validateVideoRender(bound.projectId, "standard").then((result) => setValidation(result.validation)).catch(() => setValidation(null));
      if (payload.video.output) {
        void getVideoOutputDetails(bound.projectId).then((result) => setOutputDetails(result.output)).catch(() => setOutputDetails(null));
      } else {
        setOutputDetails(null);
      }
    }
    if (payload.video?.timeline[0]) setSelectedId(payload.video.timeline[0].id);
    if (payload.video?.activeJobId) {
      try {
        const current = await getVideoJob(bound.projectId, payload.video.activeJobId);
        setJob(current.job);
      } catch {
        setJob(null);
      }
    }
  }

  const run = async (action: "create" | "preview" | "final") => {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "create") {
        const result = await createVideoProject(project.id);
        setVideo(result.video);
        setSelectedId(result.video.timeline[0]?.id ?? null);
        notify("success", "Timeline ready", `${result.video.timeline.length} scenes from the approved Creative Plan.`, "ai-suggestions");
      } else {
        const preset = action === "final" ? "standard" : "preview";
        const result = await startVideoRender(project.id, preset);
        setVideo(result.video);
        setJob(result.job);
        notify(
          "info",
          preset === "standard" ? "Final render queued" : "Preview render queued",
          preset === "standard"
            ? `Rendering all ${video?.timeline.length ?? 0} scenes at production resolution.`
            : "Quick preview: first 3 scenes at reduced resolution.",
          "updates",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Video production failed";
      setError(message);
      notify("error", "Video production failed", message, "errors");
    } finally {
      setBusy(false);
    }
  };

  const persist = async (changes: Parameters<typeof updateVideoProject>[1]) => {
    if (!project) return;
    setBusy(true);
    try {
      const result = await updateVideoProject(project.id, changes);
      setVideo(result.video);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save timeline";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const originals = useMemo(
    () => (project?.productImages ?? []).filter((image) => !image.parentAssetId && image.origin !== "generated" && image.assetType !== "video"),
    [project],
  );

  return (
    <div className="vprod">
      <header className="vp-hero">
        <div>
          <div className="vp-kicker">Step 5 · Final video export</div>
          <h1>Video Production</h1>
          <p>
            Export a validated marketing video from the approved timeline. Preview is a quick sample; final export renders the complete sequence at platform resolution with technical validation before registration.
          </p>
        </div>
        <div className="vp-stats">
          <div><b>{project?.name ?? "No project"}</b><span>Workspace project</span></div>
          <div><b>{video?.timeline.length ?? 0} scenes</b><span>Full approved timeline</span></div>
          <div><b>{video?.renderState ?? "idle"}</b><span>Render state</span></div>
        </div>
      </header>

      <div className="vp-toolbar">
        <div>
          <strong>{video ? "Timeline loaded" : "No video project yet"}</strong>
          <div className="vp-note">
            {video?.videoGenerationProviderMessage ?? "Generate the full timeline from the current Creative Plan."}
          </div>
        </div>
        <div className="vp-toolbar-actions">
          <button type="button" onClick={() => switchWorkspace("storyboard")}>Creative Plan</button>
          <button type="button" onClick={() => void hydrate()} disabled={busy}><RefreshCw size={14} /> Reload</button>
          <button type="button" onClick={() => void run("create")} disabled={busy || !project}>Generate timeline</button>
          <button type="button" onClick={() => void run("preview")} disabled={busy || !video?.timeline.length}>
            <Play size={14} /> Render preview
          </button>
          <button type="button" className="vp-primary" onClick={() => void run("final")} disabled={busy || !video?.timeline.length || validation?.ready === false}>
            <Film size={14} /> Export final video
          </button>
        </div>
      </div>

      {error ? <div className="vp-panel err">{error}</div> : null}

      {video ? (
        <>
          <div className="vp-panel">
            <h3>Pre-render checkpoint</h3>
            <div className="vp-checkpoint">
              <div><span>Product</span><b>{checkpoint.name}</b></div>
              <div><span>Images</span><b>{checkpoint.imageCount}</b></div>
              <div><span>Platform</span><b>{checkpoint.platform}</b></div>
              <div><span>Aspect</span><b>{checkpoint.aspect}</b></div>
              <div><span>Scenes</span><b>{checkpoint.sceneCount}</b></div>
              {checkpoint.price ? <div><span>Price</span><b>{String(checkpoint.price)}</b></div> : null}
              {checkpoint.oldPrice ? <div><span>Was</span><b>{String(checkpoint.oldPrice)}</b></div> : null}
              {checkpoint.discount ? <div><span>Discount</span><b>{String(checkpoint.discount)}%</b></div> : null}
              {checkpoint.website ? <div><span>Website</span><b>{checkpoint.website}</b></div> : null}
              {checkpoint.cta ? <div><span>CTA</span><b>{checkpoint.cta}</b></div> : null}
            </div>
            {validation ? (
              <div className={`vp-validation${validation.ready ? " ok" : " err"}`}>
                {validation.ready ? "Ready for final export" : "Export blocked"}
                {validation.issues.length ? `: ${validation.issues.join(" ")}` : ""}
                {validation.warnings.length ? (
                  <div className="vp-note">{validation.warnings.join(" · ")}</div>
                ) : null}
              </div>
            ) : null}
            {video.outputStatus === "OUTDATED" ? (
              <div className="vp-panel err">Current output is outdated. Project data or timeline changed since the last render. Export again to refresh the final video.</div>
            ) : null}
          </div>

          <div className="vp-panel">
            <div className="vp-note">Audio: {video.audioPlan.message}</div>
            <div className="vp-progress-bar"><i style={{ width: `${job?.progress ?? (video.renderState === "completed" ? 100 : 0)}%` }} /></div>
            <div className="vp-note">
              Job {job?.stage ?? job?.status ?? video.renderState}
              {job?.preset ? ` · ${job.preset}` : ""}
              {typeof job?.progress === "number" ? ` · ${job.progress}%` : ""}
              {job?.error ? ` · ${job.error}` : ""}
            </div>
            <div className="vp-note">
              Overlay {job?.textOverlay ?? video.textOverlay ?? "n/a"}
              {" · "}Knowledge {video.knowledgeStatus ?? "n/a"}
              {video.knowledgeMessage ? ` (${video.knowledgeMessage})` : ""}
              {" · "}Memory {video.memoryStatus ?? "n/a"}
            </div>
            <label>
              Target platform
              <select
                value={video.platform ?? VIDEO_PLATFORM_OPTIONS[0]?.id}
                disabled={busy}
                onChange={(event) => void persist({ platform: event.target.value as typeof video.platform })}
              >
                {VIDEO_PLATFORM_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.width}×{item.height}</option>)}
              </select>
            </label>
            <label>
              Aspect override
              <select
                value={video.renderPlan.aspectRatio}
                disabled={busy}
                onChange={(event) => void persist({ aspectRatio: event.target.value as typeof video.renderPlan.aspectRatio })}
              >
                {ASPECT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className="vp-editor">
            <section className="vp-panel">
              <h3><Clapperboard size={16} /> Timeline</h3>
              <div className="vp-timeline-wrap">
                <div className="vp-timeline">
                  {video.timeline.map((clip) => (
                    <button
                      key={clip.id}
                      type="button"
                      className={`vp-clip${selected?.id === clip.id ? " selected" : ""}`}
                      onClick={() => setSelectedId(clip.id)}
                    >
                      {assetUrl(clip.assetId) ? <img src={assetUrl(clip.assetId)} alt="" /> : <div style={{ height: 90 }} />}
                      <span className="vp-clip-meta">
                        <b>{clip.order}. {clip.purpose}</b>
                        <span>
                          {(clip.durationMs / 1000).toFixed(1)}s · {clip.camera} · {clip.motion}
                          {clip.imageRole || clip.view ? ` · ${clip.imageRole ?? clip.view}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="vp-panel">
              <h3>Scene editor</h3>
              {selected ? (
                <>
                <div className="vp-toolbar-actions" style={{ marginBottom: 10 }}>
                  <button type="button" disabled={busy || selected.order === 1} onClick={() => {
                    const ids = video.timeline.map((clip) => clip.id);
                    const index = ids.indexOf(selected.id);
                    if (index <= 0) return;
                    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
                    void persist({ reorder: ids });
                  }}>Move earlier</button>
                  <button type="button" disabled={busy || selected.order === video.timeline.length} onClick={() => {
                    const ids = video.timeline.map((clip) => clip.id);
                    const index = ids.indexOf(selected.id);
                    if (index < 0 || index >= ids.length - 1) return;
                    [ids[index + 1], ids[index]] = [ids[index]!, ids[index + 1]!];
                    void persist({ reorder: ids });
                  }}>Move later</button>
                </div>
                <div className="vp-fields">
                  <label>Duration (ms)
                    <input
                      type="number"
                      min={800}
                      max={15000}
                      value={selected.durationMs}
                      onBlur={(event) => void persist({ clip: { id: selected.id, durationMs: Number(event.target.value) } })}
                      onChange={(event) => {
                        if (!video) return;
                        setVideo({
                          ...video,
                          timeline: video.timeline.map((clip) => clip.id === selected.id ? { ...clip, durationMs: Number(event.target.value) } : clip),
                        });
                      }}
                    />
                  </label>
                  <label>Camera
                    <select value={selected.camera} onChange={(event) => void persist({ clip: { id: selected.id, camera: event.target.value as typeof selected.camera } })}>
                      {CAMERA_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>Motion
                    <select value={selected.motion} onChange={(event) => void persist({ clip: { id: selected.id, motion: event.target.value as typeof selected.motion } })}>
                      {MOTION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>Transition
                    <select value={selected.transitionOut} onChange={(event) => void persist({ clip: { id: selected.id, transitionOut: event.target.value as typeof selected.transitionOut } })}>
                      {TRANSITION_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>Asset
                    <select value={selected.assetId} onChange={(event) => void persist({ clip: { id: selected.id, assetId: event.target.value } })}>
                      {originals.map((image) => <option key={image.id} value={image.id}>{image.fileName}</option>)}
                    </select>
                  </label>
                  <label>Headline
                    <input
                      value={textDraft}
                      onChange={(event) => setTextDraft(event.target.value)}
                      onBlur={() => void persist({ clip: { id: selected.id, text: textDraft } })}
                    />
                  </label>
                </div>
                </>
              ) : <p className="vp-note">Select a scene to edit.</p>}
            </section>
          </div>

          <section className="vp-panel vp-preview">
            <h3>Final output</h3>
            {video.output?.url ? (
              <>
                <video key={video.output.assetId} src={video.output.url} controls playsInline />
                <div className="vp-note ok">
                  {video.outputStatus === "OUTDATED" ? "Outdated · " : video.outputStatus === "CURRENT" ? "Current · " : ""}
                  {outputDetails?.validationStatus === "TECHNICALLY_VALIDATED" ? "Technically validated · " : ""}
                  Asset {video.output.assetId} · {video.output.width}×{video.output.height} · {(video.output.durationMs / 1000).toFixed(1)}s · {video.output.sizeBytes} bytes
                </div>
                {outputDetails ? (
                  <div className="vp-details">
                    <div><span>Platform</span><b>{outputDetails.platformLabel ?? outputDetails.platform ?? "—"}</b></div>
                    <div><span>Render mode</span><b>{outputDetails.preset ?? "—"}</b></div>
                    <div><span>Scenes</span><b>{outputDetails.sceneCount}</b></div>
                    <div><span>Source assets</span><b>{outputDetails.sourceAssetIds.length}</b></div>
                    <div><span>Creative plan</span><b>v{outputDetails.creativePlanVersion}</b></div>
                    <div><span>Validation</span><b>{outputDetails.validationStatus}</b></div>
                    <div><span>Created</span><b>{new Date(outputDetails.createdAt).toLocaleString()}</b></div>
                    <a className="vp-download" href={video.output.url} download={`${checkpoint.name || "product"}-video.mp4`}>Download MP4</a>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="vp-note">No validated output yet. Export a preview or final video to produce an MP4 asset.</p>
            )}
            {(video.versions?.length ?? 0) > 0 ? (
              <div className="vp-versions">
                <h4>Version history</h4>
                <ul>
                  {[...(video.versions ?? [])].reverse().map((version) => (
                    <li key={version.versionId}>
                      {version.preset} · {version.sceneCount} scenes · {version.aspectRatio} · {(version.durationMs / 1000).toFixed(1)}s · {new Date(version.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <div className="vp-panel">
          <p>Open the Creative Planner first if this project has no plan, then generate the video timeline here.</p>
        </div>
      )}
    </div>
  );
}

export function VideoProductionPlaceholder(): ReactNode {
  return <VideoProductionWorkspace />;
}
