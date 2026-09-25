import { useEffect, useRef, useState } from "react";
import { Check, Film, Loader2, Pause, Play, Sparkles, Upload, X } from "lucide-react";
import { productSetupEngine } from "../../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../../product-setup/types";
import { audioPreview, useAudioPreview } from "../../../audio-preview/audio-preview";
import { formatDuration } from "../../../../ai/pmv-shared/destination.js";
import {
  AI_MUSIC_UNAVAILABLE,
  AUDIO_FILE_ACCEPT,
  BEAT_SYNC_OPTIONS,
  MUSIC_ENERGY,
  MUSIC_MOODS,
  MUSIC_TEMPO,
  VIDEO_FILE_ACCEPT,
  aiMusicAvailable,
  aiMusicDurationSeconds,
  aiMusicErrorMessage,
  aiMusicStageLabel,
  audioDisplayTitle,
  audioFileErrorMessage,
  audioSourceLabel,
  beatSyncActive,
  beatSyncNote,
  beatSyncState,
  customerMusicLibrary,
  formatAudioLength,
  validateAudioFile,
  validateVideoFile,
  type MusicEnergyValue,
  type MusicMoodValue,
  type MusicTempoValue,
} from "./audio-model";

const ANALYSIS_POLL_MS = 3000;
const ANALYSIS_POLL_LIMIT = 20;

/** Music for the video: library with preview, upload, sound from a video, AI music and beat timing. */
export function PmvAudioSection({ snap, onError }: { snap: ProductSetupSnapshot; onError: (message: string) => void }) {
  const preview = useAudioPreview();
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [mood, setMood] = useState<MusicMoodValue>("AUTO");
  const [energy, setEnergy] = useState<MusicEnergyValue>("AUTO");
  const [tempo, setTempo] = useState<MusicTempoValue>("AUTO");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const selectedId = snap.selectedAudioAssetId;
  const tracks = customerMusicLibrary(snap.audioLibrary, snap.projectId || null, selectedId, snap.addedAudioAssetIds);
  const selectedTrack = selectedId ? snap.audioLibrary.find((a) => a.assetId === selectedId) ?? null : null;
  const task = snap.audioTask;
  const running = task?.status === "RUNNING";
  const aiAvailable = aiMusicAvailable(snap.musicCapability);
  const beatState = beatSyncState(selectedId, snap.audioIntelligence);
  const videoSeconds = snap.videoSettings.durationSeconds;
  const aiSeconds = aiMusicDurationSeconds(videoSeconds);

  useEffect(() => {
    let alive = true;
    void productSetupEngine.refreshMusicCapability().finally(() => { if (alive) setCapabilityChecked(true); });
    return () => {
      alive = false;
      audioPreview.stop();
    };
  }, []);

  useEffect(() => {
    if (snap.projectId) void productSetupEngine.refreshAudioLibrary();
  }, [snap.projectId]);

  useEffect(() => {
    if (!selectedId) return;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      await productSetupEngine.refreshSelectedAudioAnalysis();
      const state = beatSyncState(selectedId, productSetupEngine.snapshot().audioIntelligence);
      if (state === "checking" && ++polls < ANALYSIS_POLL_LIMIT) timer = setTimeout(() => void tick(), ANALYSIS_POLL_MS);
    };
    void tick();
    return () => { if (timer) clearTimeout(timer); };
  }, [selectedId]);

  const choose = async (assetId: string | null) => {
    if (assetId === selectedId || pendingId) return;
    setPendingId(assetId ?? "none");
    try {
      if (assetId) await productSetupEngine.selectProjectAudio(assetId);
      else await productSetupEngine.clearProjectAudio();
    } catch {
      onError("Could not update the music. Please try again.");
    } finally {
      setPendingId(null);
    }
  };

  const addFile = async (file: File | undefined, kind: "upload" | "extract") => {
    if (!file) return;
    const problem = kind === "upload" ? validateAudioFile(file) : validateVideoFile(file);
    setFileProblem(problem);
    if (problem) return;
    audioPreview.stop();
    if (kind === "upload") await productSetupEngine.uploadProjectAudio(file);
    else await productSetupEngine.extractProjectAudio(file);
  };

  const generate = () => {
    audioPreview.stop();
    void productSetupEngine.generateAiMusic({ mood, energy, tempo, durationSeconds: aiSeconds });
  };

  return (
    <div className="pmv-field-group pmv-audio" data-pmv-audio="true">
      <span className="pmv-field-label" id="pmv-music-label">Music</span>

      <ul className="pmv-tracks" aria-labelledby="pmv-music-label">
        <li className={`pmv-track pmv-track--none${selectedId ? "" : " is-selected"}`}>
          <span className="pmv-track__info">
            <strong>No music</strong>
          </span>
          <button
            type="button"
            className="pmv-track__use"
            aria-pressed={!selectedId}
            disabled={Boolean(pendingId) || running}
            onClick={() => void choose(null)}
          >
            {!selectedId ? <><Check size={13} aria-hidden /> Selected</> : pendingId === "none" ? "…" : "Use"}
          </button>
        </li>

        {selectedId && !tracks.some((t) => t.assetId === selectedId) ? (
          <li className="pmv-track is-selected" data-asset-state="missing">
            <span className="pmv-track__info">
              <strong>{snap.selectedAudioTitle ? audioDisplayTitle({ title: snap.selectedAudioTitle, sourceType: "UPLOADED_AUDIO" }) : "Selected music"}</strong>
              <span className="pmv-track__meta">Loading…</span>
            </span>
            <span className="pmv-track__use is-static"><Check size={13} aria-hidden /> Selected</span>
          </li>
        ) : null}

        {tracks.map((track) => {
          const title = audioDisplayTitle(track);
          const isSelected = track.assetId === selectedId;
          const isCurrent = preview.assetId === track.assetId;
          const playing = isCurrent && preview.status === "playing";
          const loading = isCurrent && preview.status === "loading";
          const failed = isCurrent && preview.status === "error";
          const total = (isCurrent && preview.durationMs) || track.durationMs;
          const progress = isCurrent && total > 0 ? Math.min(1, preview.currentMs / total) : 0;
          const meta = [formatAudioLength(track.durationMs), audioSourceLabel(track)].filter(Boolean).join(" · ");
          return (
            <li
              key={track.assetId}
              className={`pmv-track${isSelected ? " is-selected" : ""}${isCurrent ? " is-previewing" : ""}`}
              data-source={track.sourceType}
            >
              <button
                type="button"
                className="pmv-track__play"
                aria-label={`${playing || loading ? "Pause" : "Play"} ${title}`}
                aria-pressed={playing}
                disabled={!track.playbackUrl}
                onClick={() => audioPreview.toggle(track.assetId, track.playbackUrl)}
              >
                {loading ? <Loader2 size={15} className="pmv-spin" aria-hidden />
                  : playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
              </button>
              <span className="pmv-track__info">
                <strong title={title}>{title}</strong>
                <span className="pmv-track__meta">{failed ? "This track can't be played right now." : meta}</span>
                <span
                  className="pmv-track__bar"
                  role="progressbar"
                  aria-label={`${title} preview`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                >
                  <i style={{ width: `${progress * 100}%` }} />
                </span>
              </span>
              <button
                type="button"
                className="pmv-track__use"
                aria-pressed={isSelected}
                disabled={Boolean(pendingId) || (running && task?.kind === "AI_MUSIC")}
                onClick={() => void choose(track.assetId)}
              >
                {isSelected ? <><Check size={13} aria-hidden /> Selected</> : pendingId === track.assetId ? "…" : "Use"}
              </button>
            </li>
          );
        })}
      </ul>

      {tracks.length === 0 && !selectedId ? (
        <p className="pmv-muted">Add your own music, use the sound from a video{aiAvailable ? ", or create music with AI" : ""}.</p>
      ) : null}

      <div className="pmv-audio__add">
        <button type="button" className="pmv-chip" disabled={running} onClick={() => audioInput.current?.click()}>
          <Upload size={13} aria-hidden /> Upload music
        </button>
        <button type="button" className="pmv-chip" disabled={running} onClick={() => videoInput.current?.click()}>
          <Film size={13} aria-hidden /> Use sound from a video
        </button>
        {aiAvailable ? (
          <button
            type="button"
            className={`pmv-chip${aiOpen ? " is-selected" : ""}`}
            aria-expanded={aiOpen}
            aria-controls="pmv-ai-music"
            disabled={running && task?.kind !== "AI_MUSIC"}
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles size={13} aria-hidden /> Create with AI
          </button>
        ) : null}
      </div>

      {capabilityChecked && !aiAvailable ? (
        <small className="pmv-muted" data-ai-music="unavailable">{AI_MUSIC_UNAVAILABLE}</small>
      ) : null}

      {aiAvailable && aiOpen ? (
        <div id="pmv-ai-music" className="pmv-ai-music" data-ai-music="available">
          <label className="pmv-field">
            <span>Mood</span>
            <select value={mood} disabled={running} onChange={(ev) => setMood(ev.target.value as MusicMoodValue)}>
              {MUSIC_MOODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="pmv-field">
            <span>Energy</span>
            <select value={energy} disabled={running} onChange={(ev) => setEnergy(ev.target.value as MusicEnergyValue)}>
              {MUSIC_ENERGY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="pmv-field">
            <span>Tempo</span>
            <select value={tempo} disabled={running} onChange={(ev) => setTempo(ev.target.value as MusicTempoValue)}>
              {MUSIC_TEMPO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <div className="pmv-field">
            <span>Length</span>
            <output>{aiSeconds === videoSeconds ? `Match video (${formatDuration(aiSeconds)})` : formatDuration(aiSeconds)}</output>
          </div>
          <div className="pmv-field">
            <span>Purpose</span>
            <output>Product advertisement</output>
          </div>
          <button type="button" className="cp-button pmv-primary pmv-ai-music__go" disabled={running} onClick={generate}>
            <Sparkles size={14} aria-hidden /> Generate music
          </button>
        </div>
      ) : null}

      {fileProblem ? <small className="pmv-field-error" role="status">{fileProblem}</small> : null}

      {task ? (
        <div className={`pmv-audio__task${task.status === "FAILED" ? " is-failed" : ""}`} role="status" aria-live="polite" data-task={task.kind} data-task-status={task.status}>
          {task.status === "RUNNING" ? <Loader2 size={14} className="pmv-spin" aria-hidden />
            : task.status === "DONE" ? <Check size={14} aria-hidden /> : null}
          <span>{taskMessage(task)}</span>
          {task.status === "RUNNING" && task.kind === "AI_MUSIC" ? (
            <button type="button" className="pmv-link" onClick={() => void productSetupEngine.cancelAiMusic()}>Cancel</button>
          ) : task.status !== "RUNNING" ? (
            <button type="button" className="pmv-audio__dismiss" aria-label="Dismiss" onClick={() => productSetupEngine.dismissAudioTask()}>
              <X size={13} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedId ? (
        <div className="pmv-audio__settings">
          <div className="pmv-audio__beat">
            <span className="pmv-field-label" id="pmv-beat-label">Beat sync</span>
            <div
              className="pmv-segment"
              role="radiogroup"
              aria-labelledby="pmv-beat-label"
              data-beat-state={beatState}
              data-beat-active={beatSyncActive(beatState, snap.beatSyncMode)}
            >
              {BEAT_SYNC_OPTIONS.map((o) => (
                <button
                  key={o.mode}
                  type="button"
                  role="radio"
                  aria-checked={snap.beatSyncMode === o.mode}
                  className={snap.beatSyncMode === o.mode ? "is-selected" : undefined}
                  onClick={() => {
                    if (o.mode === snap.beatSyncMode) return;
                    void productSetupEngine.setBeatSyncMode(o.mode)
                      .catch(() => onError("Could not update beat sync. Please try again."));
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <label className="pmv-field pmv-audio__volume">
            <span>Music volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(snap.audioVolume * 100)}
              onChange={(ev) => { void productSetupEngine.setAudioVolume(Number(ev.target.value) / 100).catch(() => undefined); }}
              aria-valuetext={`${Math.round(snap.audioVolume * 100)}%`}
            />
          </label>
          {beatSyncNote(beatState, snap.beatSyncMode) ? (
            <small className="pmv-muted pmv-audio__note">{beatSyncNote(beatState, snap.beatSyncMode)}</small>
          ) : null}
          {snap.voiceSelected ? (
            <small className="pmv-muted pmv-audio__note" data-voice="on">
              Your voice-over stays clear: the music gets quieter while it plays.
            </small>
          ) : null}
          {selectedTrack && selectedTrack.durationMs > 0 && selectedTrack.durationMs < videoSeconds * 1000 - 1000 ? (
            <small className="pmv-muted pmv-audio__note">This music is shorter than your video, so the last part will have no music.</small>
          ) : null}
        </div>
      ) : null}

      <input
        ref={audioInput}
        type="file"
        accept={AUDIO_FILE_ACCEPT}
        hidden
        onChange={(e) => { void addFile(e.target.files?.[0], "upload"); e.target.value = ""; }}
      />
      <input
        ref={videoInput}
        type="file"
        accept={VIDEO_FILE_ACCEPT}
        hidden
        onChange={(e) => { void addFile(e.target.files?.[0], "extract"); e.target.value = ""; }}
      />
    </div>
  );
}

function taskMessage(task: NonNullable<ProductSetupSnapshot["audioTask"]>): string {
  if (task.kind === "AI_MUSIC") {
    if (task.status === "RUNNING") return aiMusicStageLabel(task.stage ?? "QUEUED");
    if (task.status === "DONE") return "Your AI music is ready and added to your video.";
    return aiMusicErrorMessage(task.errorCode);
  }
  const kind = task.kind === "UPLOAD" ? "upload" : "extract";
  if (task.status === "RUNNING") return kind === "upload" ? "Uploading your music…" : "Taking the sound from your video…";
  if (task.status === "DONE") return "Added to your music. Press Play to listen, then Use to add it to your video.";
  return audioFileErrorMessage(task.errorCode, kind);
}
