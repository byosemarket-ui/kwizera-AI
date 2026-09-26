import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mapIntelligence, mapLibraryItem, type PmvAudioLibraryItem } from "../../../desktop/pmv-final/index.ts";
import {
  AI_MUSIC_UNAVAILABLE,
  aiMusicAvailable,
  aiMusicDurationSeconds,
  aiMusicErrorMessage,
  audioDisplayTitle,
  audioFileErrorMessage,
  audioSourceLabel,
  beatSyncActive,
  beatSyncNote,
  beatSyncState,
  customerMusicLibrary,
  formatAudioLength,
  looksLikeTestAudio,
  validateAudioFile,
  validateVideoFile,
} from "../../../desktop/customer-platform/workspace/pmv/audio-model.ts";
import { AudioPreviewController } from "../../../desktop/audio-preview/audio-preview.ts";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

function track(extra: Partial<PmvAudioLibraryItem> & { assetId: string; title: string }): PmvAudioLibraryItem {
  return {
    fileName: `${extra.title}.mp3`,
    mimeType: "audio/mpeg",
    durationMs: 30_000,
    status: "READY",
    playbackUrl: `/api/workspace/audio-library/${extra.assetId}`,
    bpm: null,
    bpmConfidence: null,
    analysisStatus: null,
    sourceType: "UPLOADED_AUDIO",
    ownerProjectId: "other-project",
    testFixture: false,
    voice: false,
    ...extra,
  } as PmvAudioLibraryItem;
}

describe("Step 3 — audio library loading", () => {
  it("maps library assets to the few customer fields and keeps internal metadata out", () => {
    const item = mapLibraryItem({
      assetId: "a1", title: "Summer Vibes", fileName: "summer_vibes.mp3", mimeType: "audio/mpeg", durationMs: 42_000,
      status: "READY", playbackUrl: "/api/workspace/audio-library/a1", sourceType: "AI_GENERATED", ownerProjectId: "p1",
      storageFileName: "a1.mp3", contentHash: "abc",
      metadata: { providerId: "music-provider-test-fixture", modelId: "test-fixture-oscillator", bpm: 120, bpmConfidence: 0.8 },
    });
    expect(item.sourceType).toBe("AI_GENERATED");
    expect(item.ownerProjectId).toBe("p1");
    expect(item.testFixture).toBe(true);
    expect(item.voice).toBe(false);
    const json = JSON.stringify(item);
    for (const leak of ["providerId", "modelId", "test-fixture-oscillator", "contentHash", "storageFileName"]) {
      expect(json).not.toContain(leak);
    }
    expect(mapLibraryItem({ assetId: "x", title: "t", sourceType: "WEIRD" }).sourceType).toBe("UPLOADED_AUDIO");
    expect(mapLibraryItem({ assetId: "v", title: "Narration", metadata: { generationSpec: { kind: "tts" } } }).voice).toBe(true);
  });

  it("shows length and source in plain words", () => {
    expect(formatAudioLength(42_000)).toBe("0:42");
    expect(formatAudioLength(150_000)).toBe("2:30");
    expect(formatAudioLength(0)).toBe("");
    expect(audioSourceLabel({ sourceType: "AI_GENERATED" })).toBe("AI music");
    expect(audioSourceLabel({ sourceType: "EXTRACTED_FROM_VIDEO" })).toBe("From a video");
    expect(audioSourceLabel({ sourceType: "UPLOADED_AUDIO" })).toBe("Uploaded");
    expect(audioDisplayTitle({ title: "my_song_final", sourceType: "UPLOADED_AUDIO" })).toBe("my song final");
    expect(audioDisplayTitle({ title: "Promo clip — Extracted Audio", sourceType: "EXTRACTED_FROM_VIDEO" })).toBe("Promo clip");
  });

  it("never prints an internal/test name even for a kept (selected) track", () => {
    expect(audioDisplayTitle({ title: "step2e-regression", sourceType: "UPLOADED_AUDIO" })).toBe("Uploaded music");
    expect(audioDisplayTitle({ title: "beat-120", sourceType: "UPLOADED_AUDIO" })).toBe("Uploaded music");
    expect(audioDisplayTitle({ title: "audit-beat", sourceType: "AI_GENERATED" })).toBe("AI music");
    expect(audioDisplayTitle({ title: "3863ae0b-2891-4397-8969-040f37de2ebc", sourceType: "EXTRACTED_FROM_VIDEO" })).toBe("Music from a video");
    expect(audioDisplayTitle({ title: "Summer Beats", sourceType: "UPLOADED_AUDIO" })).toBe("Summer Beats");
  });
});

describe("Step 3 — no internal/test audio in the customer picker", () => {
  const library = [
    track({ assetId: "t1", title: "step2e-regression" }),
    track({ assetId: "t2", title: "step2f-beat" }),
    track({ assetId: "t3", title: "beat-a" }),
    track({ assetId: "t4", title: "beat-b" }),
    track({ assetId: "t5", title: "beat-120" }),
    track({ assetId: "t6", title: "0b1c2d3e-1111-2222-3333-444455556666" }),
    track({ assetId: "f1", title: "Upbeat Commercial", sourceType: "AI_GENERATED", testFixture: true }),
    track({ assetId: "v1", title: "Voice over", voice: true }),
    track({ assetId: "c1", title: "Sunset Drive" }),
    track({ assetId: "own", title: "beat-a", ownerProjectId: "p1" }),
    track({ assetId: "new", title: "beat-b", ownerProjectId: "other" }),
    track({ assetId: "sel", title: "step2f-beat", ownerProjectId: "other" }),
    track({ assetId: "fail", title: "Broken", status: "FAILED" }),
  ];

  it("recognises verification names without hiding ordinary titles", () => {
    for (const name of ["step2e-regression", "step2f-beat", "beat-a", "beat-b", "beat-120", "phase4-smoke", "fixture tone"]) {
      expect(looksLikeTestAudio(name), name).toBe(true);
    }
    for (const name of ["Sunset Drive", "Beat of my heart", "Summer Beats", "Morning coffee", "Sample track"]) {
      expect(looksLikeTestAudio(name), name).toBe(false);
    }
  });

  it("filters (never deletes) test, fixture and voice assets; keeps own, added and selected music", () => {
    const ids = customerMusicLibrary(library, "p1", "sel", ["new"]).map((t) => t.assetId);
    expect(ids).toEqual(["c1", "own", "new", "sel"]);
    expect(library).toHaveLength(13);
    expect(customerMusicLibrary(library, "p1", null).map((t) => t.assetId)).toEqual(["c1", "own"]);
  });

  it("the customer Music UI never prints asset ids, paths or backend names", () => {
    const src = read("desktop/customer-platform/workspace/pmv/PmvAudioSection.tsx");
    expect(src).not.toMatch(/(?<!key=)\{track\.assetId\}|\{track\.playbackUrl\}|\{track\.fileName\}|storageFileName|musicCapability\.reason|providerId|modelId/);
    expect(src).not.toMatch(/Ollama|OpenAI|FFmpeg|CapabilityRuntime|Admin|api[_ -]?key|secret/i);
  });
});

describe("Step 3 — audio preview", () => {
  class FakeAudio {
    static created: FakeAudio[] = [];
    src: string;
    preload = "";
    duration = 30;
    currentTime = 0;
    paused = true;
    onloadedmetadata: (() => void) | null = null;
    onplaying: (() => void) | null = null;
    ontimeupdate: (() => void) | null = null;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(src: string) { this.src = src; FakeAudio.created.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute() { this.src = ""; }
    load() { /* noop */ }
  }
  const g = globalThis as { Audio?: unknown };
  let original: unknown;
  beforeEach(() => { original = g.Audio; g.Audio = FakeAudio; FakeAudio.created = []; });
  afterEach(() => { g.Audio = original; });

  it("plays, pauses, resumes and reports progress without selecting the track", () => {
    const p = new AudioPreviewController();
    p.toggle("a1", "/api/workspace/audio-library/a1");
    expect(p.getState()).toMatchObject({ assetId: "a1", status: "loading" });
    const el = FakeAudio.created[0]!;
    el.onloadedmetadata?.();
    el.onplaying?.();
    el.currentTime = 12;
    el.ontimeupdate?.();
    expect(p.getState()).toMatchObject({ status: "playing", durationMs: 30_000, currentMs: 12_000 });
    p.toggle("a1", "/x");
    expect(p.getState().status).toBe("paused");
    expect(el.paused).toBe(true);
    p.toggle("a1", "/x");
    expect(p.getState().status).toBe("loading");
    expect(FakeAudio.created).toHaveLength(1);
  });

  it("switching tracks stops the previous one; end and errors are reported", () => {
    const p = new AudioPreviewController();
    p.toggle("a1", "/a1");
    const first = FakeAudio.created[0]!;
    p.toggle("a2", "/a2");
    expect(first.paused).toBe(true);
    expect(p.getState().assetId).toBe("a2");
    const second = FakeAudio.created[1]!;
    first.onplaying?.();
    expect(p.getState().status).toBe("loading");
    second.onended?.();
    expect(p.getState()).toMatchObject({ status: "paused", currentMs: 0 });
    second.onerror?.();
    expect(p.getState().status).toBe("error");
    p.stop();
    expect(p.getState()).toMatchObject({ assetId: null, status: "idle" });
  });

  it("the PMV section and the older workspace share one player", () => {
    expect(read("desktop/customer-platform/workspace/pmv/PmvAudioSection.tsx")).toContain("audioPreview.toggle(track.assetId, track.playbackUrl)");
    const vr = read("desktop/video-requirements/video-requirements-engine.ts");
    expect(vr).toContain("audioPreview.toggle(item.assetId, item.playbackUrl)");
    expect(vr).not.toContain("new Audio(");
  });
});

describe("Step 3 — selection, upload, extraction", () => {
  const engine = read("desktop/product-setup/product-setup-engine.ts");
  const section = read("desktop/customer-platform/workspace/pmv/PmvAudioSection.tsx");
  const server = read("dev/server/index.ts");
  const workspace = read("ai/creative-workspace/creative-workspace-manager.ts");

  it("selection is persisted on the project through the existing route", () => {
    expect(engine).toMatch(/\/api\/workspace\/projects\/\$\{projectId\}\/audio\/selection`, \{\s*method: "PUT"/);
    expect(engine).toMatch(/async selectProjectAudio[\s\S]*?await this\.flushPersist\(\);/);
    expect(section).toContain("productSetupEngine.selectProjectAudio(assetId)");
    expect(section).toContain("productSetupEngine.clearProjectAudio()");
    expect(workspace).toMatch(/project\.selectedAudioAssetId = asset\.assetId;/);
  });

  it("upload and extraction use the existing library routes and never change the selection", () => {
    expect(engine).toContain('this.runAudioFileTask("UPLOAD", file, "audio")');
    expect(engine).toContain('this.runAudioFileTask("EXTRACT", file, "audio/extract")');
    const task = engine.slice(engine.indexOf("private async runAudioFileTask"), engine.indexOf("private rememberAddedAudio"));
    expect(task).not.toContain("selectProjectAudio");
    expect(task).toContain("this.rememberAddedAudio(item)");
    expect(server).toMatch(/\/api\\\/workspace\\\/projects\\\/\(\[\^\/\]\+\)\\\/audio\$/);
    expect(server).toMatch(/\\\/audio\\\/extract\$/);
    const upload = workspace.slice(workspace.indexOf("async uploadAudio("), workspace.indexOf("async uploadAudio(") + 4000);
    expect(upload).not.toMatch(/selectedAudioAssetId\s*=/);
  });

  it("validates files with the same limits as the server", () => {
    expect(validateAudioFile({ name: "song.mp3", type: "audio/mpeg", size: 1000 })).toBeNull();
    expect(validateAudioFile({ name: "song.m4a", type: "", size: 1000 })).toBeNull();
    expect(validateAudioFile({ name: "doc.pdf", type: "application/pdf", size: 1000 })).toMatch(/MP3/);
    expect(validateAudioFile({ name: "song.mp3", type: "audio/mpeg", size: 0 })).toMatch(/empty/);
    expect(validateAudioFile({ name: "song.mp3", type: "audio/mpeg", size: 51 * 1024 * 1024 })).toMatch(/50 MB/);
    expect(validateVideoFile({ name: "clip.mov", type: "video/quicktime", size: 1000 })).toBeNull();
    expect(validateVideoFile({ name: "clip.txt", type: "text/plain", size: 1000 })).toMatch(/MP4/);
    expect(read("ai/creative-workspace/audio-asset.ts")).toContain("MAX_AUDIO_BYTES_DEFAULT = 50 * 1024 * 1024");
  });

  it("maps server error codes to customer-safe text", () => {
    expect(audioFileErrorMessage("NO_AUDIO_STREAM", "extract")).toBe("This video has no sound to use.");
    expect(audioFileErrorMessage("UNSUPPORTED_FORMAT", "upload")).toMatch(/MP3/);
    expect(audioFileErrorMessage("PAYLOAD_TOO_LARGE", "extract")).toMatch(/50 MB/);
    expect(audioFileErrorMessage("SOMETHING_INTERNAL", "upload")).toBe("Your music could not be uploaded. Please try again.");
  });
});

describe("Step 3 — AI music", () => {
  const engine = read("desktop/product-setup/product-setup-engine.ts");
  const section = read("desktop/customer-platform/workspace/pmv/PmvAudioSection.tsx");

  it("routes through the existing server job (Admin-routed capability); no provider calls in the customer app", () => {
    expect(engine).toContain("/ai-sound/generate`");
    expect(engine).toContain("/api/workspace/ai-sound/health");
    expect(engine).not.toMatch(/fetch\(\s*["'`]https?:/);
    expect(read("ai/ai-sound/admin-runtime-music-provider.ts")).toMatch(/MUSIC_GENERATION via CapabilityRuntime/);
  });

  it("is only offered when available and shows a truthful unavailable state otherwise", () => {
    expect(aiMusicAvailable({ available: true, status: "AVAILABLE", reason: null })).toBe(true);
    expect(aiMusicAvailable({ available: false, status: "UNAVAILABLE", reason: "internal detail" })).toBe(false);
    expect(aiMusicAvailable({ available: true, status: "DEGRADED", reason: null })).toBe(false);
    expect(section).toMatch(/\{aiAvailable \? \([\s\S]*?Create with AI/);
    expect(section).toContain("{AI_MUSIC_UNAVAILABLE}");
    expect(AI_MUSIC_UNAVAILABLE).not.toMatch(/provider|model|admin|config/i);
  });

  it("never claims success on failure and cancels the server job on timeout", () => {
    expect(aiMusicErrorMessage("MUSIC_GENERATION_UNAVAILABLE")).toBe(AI_MUSIC_UNAVAILABLE);
    expect(aiMusicErrorMessage("PROVIDER_HTTP_500")).toBe("We couldn't create music this time. Please try again.");
    expect(engine).toMatch(/if \(job\.status !== "READY" \|\| !job\.audioAssetId\) \{\s*return fail/);
    expect(engine).toMatch(/Date\.now\(\) > deadline\) \{\s*await fetch\(`\/api\/workspace\/ai-sound\/jobs\/\$\{encodeURIComponent\(jobId\)\}`, \{ method: "DELETE" \}\)/);
    expect(engine).toMatch(/await this\.refreshAudioLibrary\(\);[\s\S]{0,300}await this\.selectProjectAudio\(assetId\);/);
  });

  it("music length follows the video within the supported 5 s – 2 min", () => {
    expect(aiMusicDurationSeconds(30)).toBe(30);
    expect(aiMusicDurationSeconds(150)).toBe(120);
    expect(aiMusicDurationSeconds(2)).toBe(5);
  });
});

describe("Step 3 — Audio Intelligence and Beat Sync", () => {
  it("uses only real analysis; silent audio has no beat", () => {
    expect(mapIntelligence(null)).toBeNull();
    const ready = mapIntelligence({ status: "READY", bpm: 120, bpmConfidence: 0.7, beats: [0.5, 1, 1.5] });
    expect(ready?.beatCount).toBe(3);
    const silent = mapIntelligence({ status: "READY", bpmConfidence: 0.9, beats: [1, 2], technical: { silent: true } });
    expect(silent?.beatCount).toBe(0);
  });

  it("Beat Sync state mirrors the timeline rule (READY, has beats, SMART needs confidence ≥ 0.2)", () => {
    const view = (status: string, beatCount: number, bpmConfidence: number | null) =>
      ({ status, bpm: 120, bpmConfidence, beatCount, energyLabel: null, message: null });
    expect(beatSyncState(null, null)).toBe("no_music");
    expect(beatSyncState("a", null)).toBe("checking");
    expect(beatSyncState("a", view("ANALYZING", 0, null))).toBe("checking");
    expect(beatSyncState("a", view("FAILED", 0, null))).toBe("unavailable");
    expect(beatSyncState("a", view("READY", 0, 0.9))).toBe("unavailable");
    expect(beatSyncState("a", view("READY", 10, 0.1))).toBe("weak");
    expect(beatSyncState("a", view("READY", 10, 0.5))).toBe("ready");
    expect(beatSyncActive("ready", "SMART")).toBe(true);
    expect(beatSyncActive("weak", "SMART")).toBe(false);
    expect(beatSyncActive("weak", "STRICT")).toBe(true);
    expect(beatSyncActive("ready", "OFF")).toBe(false);
    expect(beatSyncActive("unavailable", "STRICT")).toBe(false);
    expect(beatSyncNote("unavailable", "SMART")).toMatch(/standard timing/);
    const timing = read("ai/video-production/beat-sync-timing.ts");
    expect(timing).toContain('intel.status !== "READY"');
    expect(timing).toContain("intel.technical.silent || !intel.beats.length");
    expect(timing).toContain('intel.bpmConfidence < 0.2 && mode === "SMART"');
  });

  it("Beat Sync choice is saved through the existing route and used by the timeline", () => {
    const engine = read("desktop/product-setup/product-setup-engine.ts");
    expect(engine).toContain("/audio/beat-sync`");
    const vpm = read("ai/video-production/video-production-manager.ts");
    expect(vpm).toMatch(/applyBeatSyncTiming\(\{/);
    expect(vpm).toMatch(/this\.audioIntelligence\.getAnalysis\(selection\.selectedAudioAssetId\)/);
  });
});

describe("Step 3 — voice, mixing and timeline", () => {
  const workspace = read("ai/creative-workspace/creative-workspace-manager.ts");

  it("choosing or removing music never touches the voice-over", () => {
    const select = workspace.slice(workspace.indexOf("async selectProjectAudio("), workspace.indexOf("async uploadAudio("));
    expect(select).not.toContain("selectedVoiceAssetId");
    expect(select).not.toContain("voiceEnabled");
  });

  it("the renderer keeps voice on top of ducked music", () => {
    const renderer = read("ai/video-production/ffmpeg-renderer.ts");
    expect(renderer).toMatch(/\[musicduck\]\[voice\]amix=inputs=2/);
  });

  it("the timeline and final render read the project's music and voice selection", () => {
    const vpm = read("ai/video-production/video-production-manager.ts");
    expect(vpm).toMatch(/const hasMusic = Boolean\(audioSelection\?\.enabled && audioSelection\.selectedAudioAssetId\);/);
    expect(vpm).toMatch(/const hasVoice = Boolean\(audioSelection\?\.voiceEnabled && audioSelection\.selectedVoiceAssetId\);/);
  });

  it("the Style step shows the Music section and tells the customer the voice stays clear", () => {
    const style = read("desktop/customer-platform/workspace/pmv/PmvStyleStep.tsx");
    expect(style).toContain("<PmvAudioSection snap={snap} onError={onError} />");
    expect(style).not.toContain("<span>Music timing</span>");
    const section = read("desktop/customer-platform/workspace/pmv/PmvAudioSection.tsx");
    expect(section).toMatch(/snap\.voiceSelected \? \([\s\S]*?music gets quieter/);
  });

  it("audio controls stay compact and wrap on phones", () => {
    const css = read("desktop/customer-platform/workspace/product-marketing-video.css");
    expect(css).toMatch(/\.pmv-track \{[^}]*grid-template-columns: 32px minmax\(0, 1fr\) auto;/);
    expect(css).toMatch(/\.pmv-tracks \{[^}]*max-height: 264px;[^}]*overflow-y: auto;/);
    expect(css).toMatch(/\.pmv-audio__add \{[^}]*flex-wrap: wrap;/);
    expect(css).toMatch(/\.pmv-track__info strong \{[^}]*text-overflow: ellipsis;/);
  });
});
