import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { ProductStoryboardResult, StoryboardScenePanel } from "../product-storyboard/types.js";
import type { ProductVideoGenerationResult, SceneVideoClip } from "../product-video-generation/types.js";
import type {
  MixSettings,
  MusicSelection,
  MusicStyle,
  NarrationSection,
  SceneNarrationCue,
  SoundEffectCue,
  SoundEffectKind,
  SyncReport,
  VoicePersona,
  VoiceSelection,
} from "./types.js";

export const SAMPLE_RATE = 16000;

/** Select voice persona from brand, audience, and product category — offline, no copyrighted media. */
export function selectVoice(
  product: ProductIntelligenceProfile,
  project: CreativeProject,
  language: string,
): VoiceSelection {
  const audience = (project.targetAudience || product.targetAudience || "").toLowerCase();
  const category = (product.category || product.productType || "").toLowerCase();
  const objective = (project.campaignInformation?.objective || "").toLowerCase();
  let persona: VoicePersona = "professional";
  if (/luxury|premium|exclusive/.test(`${category} ${objective}`)) persona = "luxury";
  else if (/youth|gen.?z|teen|young/.test(audience)) persona = "youth";
  else if (/friendly|warm|approachable|family/.test(audience)) persona = "friendly";
  else if (/beauty|fashion|lifestyle/.test(category)) persona = "female";
  else if (/tech|sport|tool|industrial/.test(category)) persona = "male";
  return {
    persona,
    language: language || "en",
    why: `Selected ${persona} voice for ${product.category || "product"} campaign targeting ${project.targetAudience || "general audience"}.`,
    brandMatch: product.brand || project.brandInformation?.name || product.productName,
    audienceMatch: project.targetAudience || product.targetAudience || "general",
  };
}

export function selectMusic(product: ProductIntelligenceProfile, project: CreativeProject): MusicSelection {
  const text = `${product.category} ${product.productType} ${project.campaignInformation?.objective} ${project.platform}`.toLowerCase();
  let style: MusicStyle = "modern";
  let emotion = "confident uplift";
  if (/luxury|premium|gold/.test(text)) { style = "luxury"; emotion = "refined elegance"; }
  else if (/fashion|apparel|style/.test(text)) { style = "fashion"; emotion = "stylish energy"; }
  else if (/tech|gadget|digital|software/.test(text)) { style = "technology"; emotion = "precise momentum"; }
  else if (/beauty|cosmetic|skincare/.test(text)) { style = "beauty"; emotion = "soft glow"; }
  else if (/sport|fitness|active/.test(text)) { style = "sports"; emotion = "drive"; }
  else if (/corporate|b2b|enterprise/.test(text)) { style = "corporate"; emotion = "trust"; }
  else if (/minimal|clean|simple/.test(text)) { style = "minimal"; emotion = "calm clarity"; }
  return {
    style,
    why: `Generated offline ${style} bed supporting "${emotion}" without copyrighted media.`,
    emotion,
    licensedOrGenerated: "generated-offline",
  };
}

export function buildNarrationCues(
  storyboard: ProductStoryboardResult,
  clips: SceneVideoClip[],
  language: string,
): SceneNarrationCue[] {
  const script = storyboard.marketingScript;
  const cues: SceneNarrationCue[] = [];
  for (const clip of clips) {
    const panel = storyboard.panels.find((item) => item.sceneNumber === clip.sceneNumber);
    if (!panel) continue;
    const section = sectionForPanel(panel, clip.marketingBeat);
    const text = narrationTextForSection(section, panel, script);
    cues.push({
      sceneNumber: clip.sceneNumber,
      section,
      text,
      startSeconds: clip.startSeconds,
      endSeconds: clip.endSeconds,
      language,
    });
  }
  return cues;
}

export function buildSoundEffects(clips: SceneVideoClip[], panels: StoryboardScenePanel[]): SoundEffectCue[] {
  const cues: SoundEffectCue[] = [];
  for (const clip of clips) {
    const panel = panels.find((item) => item.sceneNumber === clip.sceneNumber);
    cues.push({
      kind: "transition",
      sceneNumber: clip.sceneNumber,
      atSeconds: clip.startSeconds,
      why: `Transition cue at scene ${clip.sceneNumber} (${panel?.transition || "cut"}).`,
    });
    if (clip.cameraMove === "product-rotation" || clip.cameraMove === "orbit") {
      cues.push({
        kind: "rotation",
        sceneNumber: clip.sceneNumber,
        atSeconds: clip.startSeconds + clip.durationSeconds * 0.35,
        why: "Rotation SFX aligned to product-rotation camera move.",
      });
    }
    if (clip.cameraMove === "push-in" || clip.cameraMove === "pull-out") {
      cues.push({
        kind: "zoom",
        sceneNumber: clip.sceneNumber,
        atSeconds: clip.startSeconds + clip.durationSeconds * 0.2,
        why: "Zoom SFX aligned to push-in/pull-out camera move.",
      });
    }
    if (clip.cameraMove !== "product-rotation") {
      cues.push({
        kind: "camera-movement",
        sceneNumber: clip.sceneNumber,
        atSeconds: clip.startSeconds + 0.15,
        why: `Camera-movement SFX for ${clip.cameraMove}.`,
      });
    }
    if (clip.marketingBeat === "hook" || clip.marketingBeat === "product-reveal") {
      cues.push({
        kind: "product-reveal",
        sceneNumber: clip.sceneNumber,
        atSeconds: clip.startSeconds + 0.4,
        why: "Premium product-reveal accent for hook/reveal beat.",
      });
    }
    if (clip.marketingBeat === "call-to-action") {
      cues.push({
        kind: "click",
        sceneNumber: clip.sceneNumber,
        atSeconds: clip.endSeconds - 0.35,
        why: "CTA click accent near scene end.",
      });
    }
  }
  cues.push({
    kind: "ambient",
    sceneNumber: clips[0]?.sceneNumber ?? 1,
    atSeconds: 0,
    why: "Low ambient bed under full timeline (generated, not copyrighted).",
  });
  cues.push({
    kind: "premium",
    sceneNumber: clips[0]?.sceneNumber ?? 1,
    atSeconds: 0.05,
    why: "Subtle premium open sting (generated offline).",
  });
  return cues;
}

export function defaultMix(): MixSettings {
  return {
    voiceVolume: 0.85,
    musicVolume: 0.28,
    effectsVolume: 0.35,
    equalization: "voice-forward mid clarity",
    noiseReduction: true,
    dynamicRange: "broadcast-safe soft limiter",
    stereoBalance: "center voice / wide music",
    musicBelowNarration: true,
  };
}

export function evaluateSync(
  video: ProductVideoGenerationResult,
  narration: SceneNarrationCue[],
  effects: SoundEffectCue[],
  mix: MixSettings,
): SyncReport {
  const problems: string[] = [];
  if (narration.length !== video.clips.length) problems.push("Narration cue count does not match video clips.");
  for (const cue of narration) {
    const clip = video.clips.find((item) => item.sceneNumber === cue.sceneNumber);
    if (!clip) {
      problems.push(`Missing clip for narration scene ${cue.sceneNumber}.`);
      continue;
    }
    if (Math.abs(cue.startSeconds - clip.startSeconds) > 0.05 || Math.abs(cue.endSeconds - clip.endSeconds) > 0.05) {
      problems.push(`Scene ${cue.sceneNumber} narration timing drifts from clip timeline.`);
    }
    if (!cue.text.trim()) problems.push(`Scene ${cue.sceneNumber} narration text is empty.`);
  }
  for (const fx of effects) {
    if (fx.atSeconds < -0.01 || fx.atSeconds > video.totalDurationSeconds + 0.05) {
      problems.push(`SFX ${fx.kind} at ${fx.atSeconds}s is outside timeline.`);
    }
  }
  if (!(mix.musicVolume < mix.voiceVolume)) problems.push("Music volume must stay below narration.");
  const voiceSynced = narration.length === video.clips.length && !problems.some((item) => item.includes("narration"));
  const score = problems.length === 0 ? 94 : Math.max(40, 90 - problems.length * 8);
  return {
    voiceSynced,
    musicSynced: problems.every((item) => !item.includes("Music")),
    effectsSynced: !problems.some((item) => item.includes("SFX")),
    sceneTimingSynced: !problems.some((item) => item.includes("timing")),
    cameraSynced: effects.some((item) => item.kind === "camera-movement" || item.kind === "zoom" || item.kind === "rotation"),
    transitionSynced: effects.some((item) => item.kind === "transition"),
    problems,
    score,
  };
}

export function synthesizeVoiceTrack(
  durationSeconds: number,
  persona: VoicePersona,
  narration: SceneNarrationCue[],
  mix: MixSettings,
): Buffer {
  const samples = Math.max(1, Math.round(SAMPLE_RATE * durationSeconds));
  const pcm = Buffer.alloc(samples * 2);
  const baseFreq = personaFrequency(persona);
  for (let i = 0; i < samples; i += 1) {
    const t = i / SAMPLE_RATE;
    const active = narration.find((cue) => t >= cue.startSeconds && t < cue.endSeconds);
    let sample = 0;
    if (active) {
      const local = t - active.startSeconds;
      const envelope = Math.min(1, local * 8) * Math.min(1, (active.endSeconds - t) * 6);
      const syllable = Math.sin(2 * Math.PI * (baseFreq + Math.sin(local * 9) * 18) * t);
      const formant = Math.sin(2 * Math.PI * (baseFreq * 1.6) * t) * 0.35;
      sample = (syllable * 0.55 + formant) * envelope * mix.voiceVolume;
    }
    writeSample(pcm, i, sample);
  }
  return encodeWav(pcm, SAMPLE_RATE);
}

export function synthesizeMusicTrack(durationSeconds: number, style: MusicStyle, mix: MixSettings): Buffer {
  const samples = Math.max(1, Math.round(SAMPLE_RATE * durationSeconds));
  const pcm = Buffer.alloc(samples * 2);
  const { root, fifth, pace } = musicPalette(style);
  for (let i = 0; i < samples; i += 1) {
    const t = i / SAMPLE_RATE;
    const pad = Math.sin(2 * Math.PI * root * t) * 0.35 + Math.sin(2 * Math.PI * fifth * t) * 0.22;
    const pulse = Math.sin(2 * Math.PI * pace * t) * 0.08;
    const bed = (pad + pulse) * mix.musicVolume;
    writeSample(pcm, i, bed);
  }
  return encodeWav(pcm, SAMPLE_RATE);
}

export function synthesizeEffectsTrack(
  durationSeconds: number,
  effects: SoundEffectCue[],
  mix: MixSettings,
): Buffer {
  const samples = Math.max(1, Math.round(SAMPLE_RATE * durationSeconds));
  const pcm = Buffer.alloc(samples * 2);
  for (const fx of effects) {
    const start = Math.max(0, Math.floor(fx.atSeconds * SAMPLE_RATE));
    const length = Math.min(samples - start, Math.floor(SAMPLE_RATE * effectDuration(fx.kind)));
    for (let i = 0; i < length; i += 1) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * effectDecay(fx.kind));
      const tone = Math.sin(2 * Math.PI * effectFrequency(fx.kind) * t) * env * mix.effectsVolume * 0.7;
      const idx = start + i;
      const existing = pcm.readInt16LE(idx * 2) / 32767;
      writeSample(pcm, idx, existing + tone);
    }
  }
  return encodeWav(pcm, SAMPLE_RATE);
}

export function mixTracks(voiceWav: Buffer, musicWav: Buffer, effectsWav: Buffer, mix: MixSettings): Buffer {
  const voice = decodePcm(voiceWav);
  const music = decodePcm(musicWav);
  const effects = decodePcm(effectsWav);
  const length = Math.max(voice.length, music.length, effects.length);
  const pcm = Buffer.alloc(length);
  for (let i = 0; i < length; i += 2) {
    const v = i < voice.length ? voice.readInt16LE(i) / 32767 : 0;
    const m = i < music.length ? music.readInt16LE(i) / 32767 : 0;
    const e = i < effects.length ? effects.readInt16LE(i) / 32767 : 0;
    // Keep music ducking under narration (already volume-scaled); soft limit.
    const combined = Math.max(-1, Math.min(1, v + m * (mix.musicBelowNarration ? 1 : 0.5) + e));
    pcm.writeInt16LE(Math.round(combined * 32767 * 0.95), i);
  }
  return encodeWav(pcm, SAMPLE_RATE);
}

export function buildSubtitlesVtt(narration: SceneNarrationCue[]): string {
  return `WEBVTT\n\n${narration.map((cue, index) => `${index + 1}\n${formatVtt(cue.startSeconds)} --> ${formatVtt(cue.endSeconds)}\n${cue.text}\n`).join("\n")}`;
}

function sectionForPanel(panel: StoryboardScenePanel, marketingBeat: string): NarrationSection {
  if (marketingBeat === "hook" || panel.marketingBeat === "attention") return "opening-hook";
  if (marketingBeat === "product-reveal" || panel.marketingBeat === "interest") return "product-introduction";
  if (marketingBeat === "feature-showcase" || panel.marketingBeat === "desire") return "feature-presentation";
  if (marketingBeat === "benefits" || panel.marketingBeat === "trust") return "benefits";
  if (marketingBeat === "price-presentation" || panel.marketingBeat === "price") return "price";
  if (marketingBeat === "offer" || panel.marketingBeat === "offer") return "promotional-offer";
  if (marketingBeat === "call-to-action" || panel.marketingBeat === "call-to-action") return "call-to-action";
  if (/clos|end|final/.test(panel.scenePurpose.toLowerCase())) return "closing";
  return "feature-presentation";
}

function narrationTextForSection(
  section: NarrationSection,
  panel: StoryboardScenePanel,
  script: ProductStoryboardResult["marketingScript"],
): string {
  if (panel.voice.narration?.trim()) return panel.voice.narration.trim();
  switch (section) {
    case "opening-hook": return script.openingHook;
    case "product-introduction": return script.productIntroduction;
    case "feature-presentation": return script.featurePresentation;
    case "benefits": return script.benefitPresentation || script.trustBuilding;
    case "price": return script.pricePresentation;
    case "promotional-offer": return script.promotionalMessage;
    case "call-to-action": return script.callToAction;
    case "closing": return script.closingMessage;
    default: return panel.scenePurpose;
  }
}

function personaFrequency(persona: VoicePersona): number {
  switch (persona) {
    case "male": return 120;
    case "female": return 210;
    case "youth": return 240;
    case "luxury": return 160;
    case "friendly": return 190;
    case "professional":
    default: return 150;
  }
}

function musicPalette(style: MusicStyle): { root: number; fifth: number; pace: number } {
  switch (style) {
    case "luxury": return { root: 55, fifth: 82, pace: 0.4 };
    case "fashion": return { root: 73, fifth: 110, pace: 1.2 };
    case "technology": return { root: 65, fifth: 98, pace: 1.5 };
    case "beauty": return { root: 60, fifth: 90, pace: 0.6 };
    case "sports": return { root: 80, fifth: 120, pace: 2 };
    case "corporate": return { root: 58, fifth: 87, pace: 0.8 };
    case "minimal": return { root: 50, fifth: 75, pace: 0.3 };
    case "modern":
    default: return { root: 62, fifth: 93, pace: 1 };
  }
}

function effectFrequency(kind: SoundEffectKind): number {
  switch (kind) {
    case "product-reveal": return 880;
    case "camera-movement": return 220;
    case "rotation": return 330;
    case "zoom": return 440;
    case "transition": return 180;
    case "click": return 1200;
    case "swipe": return 500;
    case "ambient": return 90;
    case "premium": return 660;
    default: return 300;
  }
}

function effectDuration(kind: SoundEffectKind): number {
  if (kind === "ambient") return 0.8;
  if (kind === "premium" || kind === "product-reveal") return 0.45;
  return 0.22;
}

function effectDecay(kind: SoundEffectKind): number {
  if (kind === "ambient") return 1.2;
  if (kind === "click") return 18;
  return 8;
}

function writeSample(pcm: Buffer, index: number, value: number): void {
  pcm.writeInt16LE(Math.max(-1, Math.min(1, value)) * 32767, index * 2);
}

function encodeWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function decodePcm(wav: Buffer): Buffer {
  if (wav.length <= 44) return Buffer.alloc(0);
  return wav.subarray(44);
}

function formatVtt(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
