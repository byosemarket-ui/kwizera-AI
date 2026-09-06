/**
 * STEP 2E — Music Generation Provider abstraction.
 * Production default: Unavailable (honest). Test mock only when explicitly enabled.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicProviderHealth,
  MusicGenerationProviderStatus,
} from "./types.js";

export interface MusicGenerationProvider {
  readonly id: string;
  capabilities(): string[];
  isAvailable(): Promise<boolean>;
  healthCheck(): Promise<MusicProviderHealth>;
  generate(request: MusicGenerationRequest): Promise<MusicGenerationResult>;
  cancel?(jobId: string): Promise<void>;
  validateOutput?(filePath: string): Promise<boolean>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class UnavailableMusicGenerationProvider implements MusicGenerationProvider {
  readonly id = "music-provider-unavailable";

  capabilities(): string[] {
    return [];
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async healthCheck(): Promise<MusicProviderHealth> {
    return {
      providerId: this.id,
      status: "UNAVAILABLE",
      available: false,
      modelId: null,
      modelVersion: null,
      capabilities: [],
      reason:
        "No local music-generation model/provider is configured. "
        + "Upload or extract audio remains available. "
        + "Ollama text models cannot generate audio.",
      resourceStatus: {
        ramFreeMb: Math.round(os.freemem() / 1024 / 1024),
        storageFreeMb: undefined,
        concurrentJobs: 0,
      },
      checkedAt: nowIso(),
    };
  }

  async generate(): Promise<MusicGenerationResult> {
    throw Object.assign(new Error("MUSIC_GENERATION_UNAVAILABLE"), {
      code: "MUSIC_GENERATION_UNAVAILABLE",
    });
  }
}

/**
 * Test-only provider — writes a real short WAV for pipeline unit tests.
 * NEVER selected in production unless KWIZERA_AI_SOUND_TEST_PROVIDER=1
 * (local automated tests / intentional lab only).
 */
export class TestFixtureMusicGenerationProvider implements MusicGenerationProvider {
  readonly id = "music-provider-test-fixture";

  capabilities(): string[] {
    return ["test-fixture-wav", "instrumental"];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async healthCheck(): Promise<MusicProviderHealth> {
    return {
      providerId: this.id,
      status: "AVAILABLE",
      available: true,
      modelId: "test-fixture-oscillator",
      modelVersion: "test-1",
      capabilities: this.capabilities(),
      reason: "Test fixture provider — not a production music model.",
      checkedAt: nowIso(),
    };
  }

  async generate(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    const durationSec = Math.min(30, Math.max(2, request.spec.durationSeconds || 8));
    const sampleRate = 22050;
    const samples = Math.floor(sampleRate * durationSec);
    const dataSize = samples * 2;
    const buf = Buffer.alloc(44 + dataSize);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataSize, 40);
    const bpm = request.spec.tempoRange[0] || 110;
    const interval = 60 / bpm;
    const energy = request.spec.energy === "HIGH" ? 0.55 : request.spec.energy === "LOW" ? 0.25 : 0.4;
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let sample = Math.sin(2 * Math.PI * 220 * t) * 0.08 * energy;
      const beatPhase = t % interval;
      if (beatPhase < 0.04) {
        sample += Math.sin(2 * Math.PI * 90 * beatPhase) * 0.7 * energy * (1 - beatPhase / 0.04);
      }
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-ai-sound-"));
    const filePath = path.join(dir, `${randomUUID()}.wav`);
    await fs.writeFile(filePath, buf);
    return {
      filePath,
      mimeType: "audio/wav",
      durationMs: Math.round(durationSec * 1000),
      providerId: this.id,
      modelId: "test-fixture-oscillator",
      modelVersion: "test-1",
    };
  }
}

export function resolveProductionMusicProvider(): MusicGenerationProvider {
  if (process.env.KWIZERA_AI_SOUND_TEST_PROVIDER === "1") {
    return new TestFixtureMusicGenerationProvider();
  }
  // Future: detect real local music providers here (never invent availability).
  return new UnavailableMusicGenerationProvider();
}

export function providerStatusLabel(status: MusicGenerationProviderStatus): string {
  switch (status) {
    case "AVAILABLE": return "Available";
    case "UNAVAILABLE": return "Unavailable";
    case "MISCONFIGURED": return "Misconfigured";
    case "MODEL_MISSING": return "Model missing";
    case "RESOURCE_LIMITED": return "Resource limited";
    case "ERROR": return "Error";
    default: return status;
  }
}
