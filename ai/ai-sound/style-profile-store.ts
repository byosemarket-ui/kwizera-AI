/**
 * STEP 2E — Audio Style Profile store (reference characteristics, not model training).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AUDIO_STYLE_PROFILE_VERSION,
  type AudioStylePreferences,
  type AudioStyleProfile,
} from "./types.js";

export interface StylePreferenceSignal {
  signalId: string;
  projectId: string;
  audioAssetId: string;
  signal: "like_style" | "dislike_style";
  createdAt: string;
}

interface StyleStore {
  profiles: AudioStyleProfile[];
  preferenceSignals: StylePreferenceSignal[];
}

const EMPTY_STORE: StyleStore = { profiles: [], preferenceSignals: [] };

export class AudioStyleProfileStore {
  private root = "";

  async initialize(storageRoot: string): Promise<void> {
    this.root = path.join(storageRoot, "creative-workspace", "audio-style-profiles");
    await fs.mkdir(this.root, { recursive: true });
  }

  isInitialized(): boolean {
    return Boolean(this.root);
  }

  async list(projectId?: string | null): Promise<AudioStyleProfile[]> {
    const store = await this.read();
    if (projectId === undefined) return store.profiles;
    if (projectId === null) return store.profiles.filter((p) => p.projectId == null);
    return store.profiles.filter((p) => p.projectId === projectId || p.projectId == null);
  }

  async get(profileId: string): Promise<AudioStyleProfile | null> {
    const store = await this.read();
    return store.profiles.find((p) => p.profileId === profileId) ?? null;
  }

  async upsert(input: {
    profileId?: string;
    name: string;
    projectId?: string | null;
    preferences: AudioStylePreferences;
    sourceAudioAssetIds: string[];
  }): Promise<AudioStyleProfile> {
    const store = await this.read();
    const now = new Date().toISOString();
    const existing = input.profileId
      ? store.profiles.find((p) => p.profileId === input.profileId)
      : null;
    if (existing) {
      existing.name = input.name.trim() || existing.name;
      existing.preferences = input.preferences;
      existing.sourceAudioAssetIds = [...input.sourceAudioAssetIds];
      existing.updatedAt = now;
      await this.write(store);
      return existing;
    }
    const profile: AudioStyleProfile = {
      profileId: input.profileId ?? randomUUID(),
      version: AUDIO_STYLE_PROFILE_VERSION,
      name: input.name.trim() || "Advertising Style",
      projectId: input.projectId ?? null,
      preferences: input.preferences,
      sourceAudioAssetIds: [...input.sourceAudioAssetIds],
      createdAt: now,
      updatedAt: now,
    };
    store.profiles.push(profile);
    await this.write(store);
    return profile;
  }

  /**
   * Build preferences from STEP 2C intelligence summaries (high-level only).
   */
  async recordPreferenceSignal(input: {
    projectId: string;
    audioAssetId: string;
    signal: "like_style" | "dislike_style";
  }): Promise<StylePreferenceSignal> {
    const store = await this.read();
    const entry: StylePreferenceSignal = {
      signalId: randomUUID(),
      projectId: input.projectId,
      audioAssetId: input.audioAssetId,
      signal: input.signal,
      createdAt: new Date().toISOString(),
    };
    store.preferenceSignals.push(entry);
    await this.write(store);
    return entry;
  }

  async listPreferenceSignals(projectId: string): Promise<StylePreferenceSignal[]> {
    const store = await this.read();
    return store.preferenceSignals.filter((s) => s.projectId === projectId);
  }

  preferencesFromAnalyses(analyses: Array<{
    bpm?: number | null;
    bpmConfidence?: number | null;
    meanEnergy?: number | null;
    beatDensity?: Array<{ density?: string }> | null;
  }>): AudioStylePreferences {
    const bpms = analyses.map((a) => a.bpm).filter((n): n is number => typeof n === "number" && n > 40 && n < 200);
    const energies = analyses.map((a) => a.meanEnergy).filter((n): n is number => typeof n === "number");
    const densities = analyses.flatMap((a) => (a.beatDensity ?? []).map((d) => d.density)).filter(Boolean) as string[];
    const avgEnergy = energies.length
      ? energies.reduce((s, n) => s + n, 0) / energies.length
      : null;
    const denseCount = densities.filter((d) => d === "dense").length;
    const sparseCount = densities.filter((d) => d === "sparse").length;
    let rhythmDensity: AudioStylePreferences["rhythmDensity"] = "normal";
    if (denseCount > sparseCount && denseCount > 0) rhythmDensity = "dense";
    else if (sparseCount > denseCount && sparseCount > 0) rhythmDensity = "sparse";

    const bpmMin = bpms.length ? Math.round(Math.min(...bpms) - 3) : null;
    const bpmMax = bpms.length ? Math.round(Math.max(...bpms) + 3) : null;

    return {
      bpmMin,
      bpmMax,
      preferredEnergy: avgEnergy == null
        ? null
        : avgEnergy < 0.3
          ? "low"
          : avgEnergy > 0.65
            ? "high"
            : "medium",
      rhythmDensity,
      instrumentationHints: [],
      introPreference: "short",
      climaxPreference: "mid",
      outroPreference: "strong",
      advertisingIntensity: avgEnergy != null && avgEnergy > 0.65 ? "high" : "medium",
      moods: [],
    };
  }

  private file(): string {
    return path.join(this.root, "profiles.json");
  }

  private async read(): Promise<StyleStore> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file(), "utf8")) as StyleStore;
      return {
        profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
        preferenceSignals: Array.isArray(raw.preferenceSignals) ? raw.preferenceSignals : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { ...EMPTY_STORE, profiles: [], preferenceSignals: [] };
      }
      throw error;
    }
  }

  private async write(store: StyleStore): Promise<void> {
    const target = this.file();
    const tmp = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await fs.rename(tmp, target);
  }
}
