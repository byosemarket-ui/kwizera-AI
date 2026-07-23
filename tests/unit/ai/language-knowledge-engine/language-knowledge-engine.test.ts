import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  KnowledgeSupportedLanguage,
  LanguageScriptType,
  LanguageWritingStyle,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-language-knowledge-test-"));
}

describe("AiLanguageKnowledgeEngine", () => {
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
    await core.start("language-knowledge-test");
    const engine = core.getManager().knowledgeFoundation!.getLanguageKnowledgeEngine();
    return { core, engine };
  }

  it("initializes with knowledge foundation", async () => {
    const { core, engine } = await startCore();
    expect(engine.isStartupComplete()).toBe(true);

    const logDate = new Date().toISOString().slice(0, 10);
    expect(
      fs.existsSync(path.join(storageRoot, "logs", `language-knowledge-engine-${logDate}.jsonl`))
    ).toBe(true);

    await core.stop();
  });

  it("analyzes English marketing content with grammar understanding", async () => {
    const { core, engine } = await startCore();

    const result = await engine.analyzeLanguage({
      languageId: "test-en",
      language: KnowledgeSupportedLanguage.English,
      brandName: "KWIZERA",
      writingStyle: LanguageWritingStyle.Marketing,
      content:
        "KWIZERA Pro helps creative teams produce professional content faster. Start your free trial today.",
      grammar: { grammarScore: 90, issues: [] },
      marketing: {
        headlines: ["Create smarter"],
        hooks: ["What if you could create in minutes?"],
        callToActions: ["Start Free Trial"],
      },
    });

    expect(result.success).toBe(true);
    expect(result.record?.language).toBe(KnowledgeSupportedLanguage.English);
    expect(result.record?.scores.grammarScore).toBeGreaterThan(70);

    await core.stop();
  });

  it("detects relationships and learns patterns across languages", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeLanguage({
      languageId: "lang-en",
      language: KnowledgeSupportedLanguage.English,
      brandName: "KWIZERA",
      content: "KWIZERA Pro empowers creative teams worldwide.",
      grammar: { grammarScore: 88, issues: [] },
      tags: ["kwizera"],
    });

    await engine.analyzeLanguage({
      languageId: "lang-rw",
      language: KnowledgeSupportedLanguage.Kinyarwanda,
      brandName: "KWIZERA",
      content: "Murakoze guhitamo KWIZERA Pro. Kora vuba kandi neza.",
      grammar: { grammarScore: 85, issues: [] },
      tags: ["kwizera"],
    });

    const rels = engine.detectRelationships("lang-en");
    expect(rels?.relatedBrands.length).toBeGreaterThanOrEqual(1);
    expect(engine.getLearnedPatterns().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("generates recommendations and supports search", async () => {
    const { core, engine } = await startCore();

    await engine.analyzeLanguage({
      languageId: "rec-lang",
      language: KnowledgeSupportedLanguage.English,
      scriptType: LanguageScriptType.Subtitle,
      content: "Short.",
      grammar: { grammarScore: 55, issues: ["Content too short"] },
      subtitles: { syncQuality: 60, readabilityOnScreen: 55 },
    });

    const recs = engine.getRecommendations("rec-lang");
    expect(recs.length).toBeGreaterThan(0);

    const search = await engine.searchLanguages({ language: KnowledgeSupportedLanguage.English });
    expect(search.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("rejects invalid and unverified language knowledge", async () => {
    const { core, engine } = await startCore();

    const invalid = await engine.analyzeLanguage({
      language: KnowledgeSupportedLanguage.English,
      content: "",
    });
    expect(invalid.success).toBe(false);

    const unverified = await engine.analyzeLanguage({
      language: KnowledgeSupportedLanguage.English,
      content: "x",
      grammar: { grammarScore: 15, issues: ["severe"] },
      marketing: { headlines: [], hooks: [], callToActions: [] },
    });
    expect(unverified.success).toBe(false);

    await core.stop();
  });
});
