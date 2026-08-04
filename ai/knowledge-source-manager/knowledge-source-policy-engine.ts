import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { KnowledgeSourcePolicyConfig, KnowledgeSourcePolicyEvaluation } from "./types.js";

const EMPTY_CONFIG: KnowledgeSourcePolicyConfig = {
  allowed: [],
  blocked: [],
  preferred: [],
  internal: [],
  company: [],
  user: [],
  priorityOrder: [],
};

/** Administrator-configurable allow/block/preferred/priority policy for knowledge sources. */
export class KnowledgeSourcePolicyEngine {
  private root = "";
  private initialized = false;
  private config: KnowledgeSourcePolicyConfig = structuredClone(EMPTY_CONFIG);

  async initialize(root: string): Promise<void> {
    this.root = root;
    await fs.mkdir(this.root, { recursive: true });
    await this.restore();
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfig(): KnowledgeSourcePolicyConfig {
    return structuredClone(this.config);
  }

  async updateConfig(changes: Partial<KnowledgeSourcePolicyConfig>): Promise<KnowledgeSourcePolicyConfig> {
    this.ensureReady();
    this.config = {
      allowed: changes.allowed ?? this.config.allowed,
      blocked: changes.blocked ?? this.config.blocked,
      preferred: changes.preferred ?? this.config.preferred,
      internal: changes.internal ?? this.config.internal,
      company: changes.company ?? this.config.company,
      user: changes.user ?? this.config.user,
      priorityOrder: changes.priorityOrder ?? this.config.priorityOrder,
    };
    await this.persist();
    return this.getConfig();
  }

  evaluate(sourceId: string): KnowledgeSourcePolicyEvaluation {
    this.ensureReady();
    if (this.config.blocked.includes(sourceId)) {
      return { sourceId, decision: "block", reason: "Source is explicitly blocked by policy.", matchedList: "blocked" };
    }
    if (this.config.preferred.includes(sourceId)) {
      return { sourceId, decision: "allow", reason: "Source is a preferred trusted source.", matchedList: "preferred" };
    }
    if (this.config.internal.includes(sourceId)) {
      return { sourceId, decision: "allow", reason: "Source is an internal source.", matchedList: "internal" };
    }
    if (this.config.company.includes(sourceId)) {
      return { sourceId, decision: "allow", reason: "Source is a company-approved source.", matchedList: "company" };
    }
    if (this.config.allowed.includes(sourceId)) {
      return { sourceId, decision: "allow", reason: "Source is explicitly allowed by policy.", matchedList: "allowed" };
    }
    if (this.config.user.includes(sourceId)) {
      return { sourceId, decision: "allow", reason: "Source is a user-approved source.", matchedList: "user" };
    }
    return { sourceId, decision: "review", reason: "Source has no policy classification and requires manual review." };
  }

  getPriorityRank(sourceId: string): number {
    const index = this.config.priorityOrder.indexOf(sourceId);
    return index === -1 ? this.config.priorityOrder.length : index;
  }

  private async restore(): Promise<void> {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.root, "policy.json"), "utf8")) as KnowledgeSourcePolicyConfig;
      this.config = { ...structuredClone(EMPTY_CONFIG), ...saved };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "policy.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(this.config, null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.initialized) throw new Error("Knowledge Source Policy Engine is not initialized");
  }
}
