import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore, EditingStyle, VideoType } from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-video-knowledge-test-"));
}

describe("AiVideoKnowledgeEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("video-knowledge-test");
    const engine = core.getManager().knowledgeFoundation!.getVideoKnowledgeEngine();
    return { core, engine };
  }

  it("initializes with knowledge foundation", async () => {
    const { core, engine } = await startCore();
    expect(engine.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(fs.existsSync(path.join(storageRoot, "logs", `video-knowledge-engine-${logDate}.jsonl`))).toBe(
      true
    );

    await core.stop();
  });

  it("analyzes promotional video with scene understanding", async () => {
    const { core, engine } = await startCore();

    const result = await engine.analyzeVideo({
      videoId: "test-promo",
      videoPath: "samples/test-promo.mp4",
      videoName: "Test Promotional Video",
      videoType: VideoType.Promotional,
      product: "KWIZERA Pro",
      brandName: "KWIZERA",
      editing: { editingStyle: EditingStyle.Commercial, motionConsistency: 85 },
      marketing: { hookTiming: 3, customerAttention: 88, marketingGoal: "conversion" },
      visual: { brandingConsistency: 90 },
    });

    expect(result.success).toBe(true);
    expect(result.record?.structure.sceneSequence.length).toBeGreaterThanOrEqual(3);
    expect(result.record?.scores.storytellingScore).toBeGreaterThan(60);

    await core.stop();
  });

  it("detects relationships and learns patterns", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeVideo({
      videoId: "vid-a",
      videoPath: "samples/a.mp4",
      videoName: "Video A",
      brandName: "KWIZERA",
      audio: { backgroundMusic: "corporate-upbeat" },
      editing: { editingStyle: EditingStyle.Commercial },
      tags: ["kwizera"],
    });

    await engine.analyzeVideo({
      videoId: "vid-b",
      videoPath: "samples/b.mp4",
      videoName: "Video B",
      brandName: "KWIZERA",
      audio: { backgroundMusic: "corporate-upbeat" },
      editing: { editingStyle: EditingStyle.Commercial },
      tags: ["kwizera"],
    });

    const rels = engine.detectRelationships("vid-a");
    expect(rels?.similarMusic.length).toBeGreaterThanOrEqual(1);
    expect(engine.getLearnedPatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates recommendations and supports search", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeVideo({
      videoId: "rec-vid",
      videoPath: "samples/rec.mp4",
      videoName: "Low Quality Video",
      brandName: "KWIZERA",
      editing: { motionConsistency: 50, visualContinuity: 55 },
      audio: { beatSynchronization: 50, audioQuality: 55 },
      marketing: { hookTiming: 10, customerAttention: 50 },
    });

    const recs = engine.getRecommendations("rec-vid");
    expect(recs.length).toBeGreaterThan(0);

    const search = await engine.searchVideos({ brand: "KWIZERA" });
    expect(search.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects invalid and low-quality analysis", async () => {
    const { core, engine } = await startCore();

    const invalid = await engine.analyzeVideo({ videoPath: "", videoName: "" });
    expect(invalid.success).toBe(false);

    const low = await engine.analyzeVideo({
      videoPath: "samples/bad.mp4",
      videoName: "Bad Video",
      editing: { motionConsistency: 20, visualContinuity: 20 },
      audio: { audioQuality: 20, beatSynchronization: 20 },
      marketing: { customerAttention: 20, hookTiming: 15 },
      visual: { brandingConsistency: 20 },
    });
    expect(low.success).toBe(false);

    await core.stop();
  });
});
