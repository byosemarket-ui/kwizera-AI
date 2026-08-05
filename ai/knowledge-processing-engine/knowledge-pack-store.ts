/**
 * Knowledge Pack store — offline-first packs under knowledge/packs/{slug}/.
 * Never modifies original documents. Versions previous pack.json before overwrite.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeItem, KnowledgePack, KnowledgePackSlug } from "./knowledge-extraction-types.js";
import { PREPARED_PACK_SLUGS } from "./knowledge-extraction-types.js";
import type { StructuredKnowledge } from "./knowledge-processing-engine.js";

export class KnowledgePackStore {
  private root = "";

  initialize(storageRoot: string): void {
    this.root = path.join(storageRoot, "knowledge", "packs");
  }

  getRoot(): string {
    return this.root;
  }

  async ensureLayout(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    for (const slug of PREPARED_PACK_SLUGS) {
      await fs.mkdir(path.join(this.root, slug), { recursive: true });
      await fs.mkdir(path.join(this.root, slug, "versions"), { recursive: true });
    }
  }

  packPath(slug: KnowledgePackSlug): string {
    return path.join(this.root, slug, "pack.json");
  }

  async listPacks(): Promise<KnowledgePack[]> {
    const packs: KnowledgePack[] = [];
    for (const slug of PREPARED_PACK_SLUGS) {
      const pack = await this.readPack(slug);
      if (pack) packs.push(pack);
    }
    return packs;
  }

  async readPack(slug: KnowledgePackSlug): Promise<KnowledgePack | null> {
    try {
      const raw = await fs.readFile(this.packPath(slug), "utf8");
      return JSON.parse(raw) as KnowledgePack;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async writePack(pack: KnowledgePack, options?: { metadataOnly?: boolean }): Promise<KnowledgePack> {
    const dir = path.join(this.root, pack.packSlug);
    await fs.mkdir(path.join(dir, "versions"), { recursive: true });
    const existing = await this.readPack(pack.packSlug);
    if (existing && !options?.metadataOnly) {
      const versionPath = path.join(dir, "versions", `v${existing.version}.json`);
      await fs.writeFile(versionPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
      pack.version = existing.version + 1;
      pack.createdAt = existing.createdAt;
      pack.packId = existing.packId;
    } else if (existing && options?.metadataOnly) {
      pack.version = existing.version;
      pack.createdAt = existing.createdAt;
      pack.packId = existing.packId;
    } else if (!pack.packId) {
      pack.packId = randomUUID();
      pack.version = pack.version || 1;
    }
    pack.updatedAt = new Date().toISOString();
    pack.contentFingerprint = fingerprintPack(pack);
    await fs.writeFile(this.packPath(pack.packSlug), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    return pack;
  }

  findDuplicateItem(packs: KnowledgePack[], item: KnowledgeItem): { packId: string; knowledgeId: string } | null {
    const fingerprint = fingerprintItem(item);
    for (const pack of packs) {
      for (const existing of pack.items) {
        if (fingerprintItem(existing) === fingerprint) {
          return { packId: pack.packId, knowledgeId: existing.knowledgeId };
        }
        if (
          existing.title.trim().toLowerCase() === item.title.trim().toLowerCase() &&
          existing.domain === item.domain &&
          overlap(existing.keywords, item.keywords) >= 0.6
        ) {
          return { packId: pack.packId, knowledgeId: existing.knowledgeId };
        }
      }
    }
    return null;
  }
}

export function fingerprintItem(item: Pick<KnowledgeItem, "title" | "domain" | "rules" | "workflow" | "bestPractices">): string {
  const payload = [
    item.title.trim().toLowerCase(),
    item.domain,
    ...item.rules.slice(0, 5),
    ...item.workflow.slice(0, 5),
    ...item.bestPractices.slice(0, 5),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function fingerprintPack(pack: KnowledgePack): string {
  const payload = pack.items.map((item) => fingerprintItem(item)).sort().join(",");
  return createHash("sha256").update(`${pack.packSlug}:${payload}`).digest("hex");
}

export function mergeStructuredKnowledge(items: KnowledgeItem[], base: StructuredKnowledge): StructuredKnowledge {
  return {
    ...base,
    concepts: unique([...base.concepts, ...items.flatMap((item) => item.coreConcepts)]).slice(0, 50),
    terminology: unique([...base.terminology, ...items.flatMap((item) => item.keywords)]).slice(0, 50),
    rules: unique([...base.rules, ...items.flatMap((item) => item.rules)]).slice(0, 40),
    bestPractices: unique([...base.bestPractices, ...items.flatMap((item) => item.bestPractices)]).slice(0, 40),
    professionalTechniques: unique([
      ...base.professionalTechniques,
      ...items.flatMap((item) => item.professionalTechniques),
    ]).slice(0, 40),
    examples: unique([...base.examples, ...items.flatMap((item) => item.examples)]).slice(0, 30),
    commonMistakes: unique([...base.commonMistakes, ...items.flatMap((item) => item.commonMistakes)]).slice(0, 30),
    decisionRules: unique([...base.decisionRules, ...items.flatMap((item) => item.decisionRules)]).slice(0, 30),
    workflowSteps: unique([...base.workflowSteps, ...items.flatMap((item) => item.workflow)]).slice(0, 40),
    relatedKnowledge: unique([...base.relatedKnowledge, ...items.flatMap((item) => item.relatedTopics)]).slice(0, 40),
    definitions: unique([...(base.definitions ?? []), ...items.flatMap((item) => item.definitions)]).slice(0, 30),
    troubleshooting: unique([...(base.troubleshooting ?? []), ...items.flatMap((item) => item.troubleshooting)]).slice(0, 30),
    recommendations: unique([...(base.recommendations ?? []), ...items.flatMap((item) => item.recommendations)]).slice(0, 30),
    professionalStandards: unique([
      ...(base.professionalStandards ?? []),
      ...items.flatMap((item) => item.professionalStandards),
    ]).slice(0, 30),
    confidenceScore: Math.round(items.reduce((sum, item) => sum + item.confidenceScore, 0) / Math.max(1, items.length)),
  };
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b.map((value) => value.toLowerCase()));
  const hits = a.filter((value) => setB.has(value.toLowerCase())).length;
  return hits / Math.max(a.length, b.length);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
