import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiKnowledgeDomainPlanner,
  CORE_KNOWLEDGE_DOMAINS,
  KnowledgeDomainOrigin,
  KnowledgeDomainPriority,
  KnowledgeDomainStatus,
  REQUIRED_KNOWLEDGE_DOMAIN_IDS,
} from "../../../../ai/knowledge-domain-planning/index.js";

describe("AiKnowledgeDomainPlanner", () => {
  let storageRoot: string;
  let planner: AiKnowledgeDomainPlanner;

  beforeEach(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-domain-planning-test-"));
    planner = new AiKnowledgeDomainPlanner();
    planner.initialize(null as never, storageRoot);
    await planner.runStartup();
  });

  afterEach(() => {
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("seeds all required knowledge domains with full planning metadata", () => {
    expect(planner.isStartupComplete()).toBe(true);

    const domains = planner.listDomains();
    expect(domains).toHaveLength(REQUIRED_KNOWLEDGE_DOMAIN_IDS.length);
    expect(domains).toHaveLength(31);

    for (const domainId of REQUIRED_KNOWLEDGE_DOMAIN_IDS) {
      const domain = planner.getDomain(domainId);
      expect(domain).toBeDefined();
      expect(domain!.domainId).toBe(domainId);
      expect(domain!.name.length).toBeGreaterThan(0);
      expect(domain!.description.length).toBeGreaterThan(0);
      expect(domain!.tags.length).toBeGreaterThan(0);
      expect(domain!.version).toBeTruthy();
      expect(domain!.futureExpansion.acceptsChildDomains).toBe(true);
      expect(domain!.metadata.contentReady).toBe(false);
      expect(domain!.metadata.architectureOnly).toBe(true);
    }
  });

  it("builds hierarchy, relationships, and AI Me awareness", () => {
    const hierarchy = planner.getHierarchy();
    expect(hierarchy.some((node) => node.domainId === "product-knowledge")).toBe(true);
    expect(hierarchy.some((node) => node.domainId === "video-production-knowledge")).toBe(true);

    const video = hierarchy.find((node) => node.domainId === "video-production-knowledge");
    expect(video?.children.map((child) => child.domainId)).toContain("camera-knowledge");
    expect(video?.children.map((child) => child.domainId)).toContain("audio-knowledge");

    const awareness = planner.getAiMeAwareness();
    expect(awareness.availableDomainIds).toHaveLength(31);
    expect(awareness.missingDomainIds).toHaveLength(31);
    expect(awareness.relationships.length).toBeGreaterThan(30);
    expect(awareness.futureLearningPriorities[0]?.priority).toBe(KnowledgeDomainPriority.Critical);
    expect(awareness.summary).toContain("domain");

    const report = planner.buildPlanningReport();
    expect(report.domainsUpgraded.length).toBe(
      CORE_KNOWLEDGE_DOMAINS.filter((domain) => domain.origin === KnowledgeDomainOrigin.Upgraded).length
    );
    expect(report.newDomainsCreated.length).toBe(
      CORE_KNOWLEDGE_DOMAINS.filter((domain) => domain.origin === KnowledgeDomainOrigin.New).length
    );
    expect(report.futureExpansionCapability.runtimeExpandable).toBe(true);
  });

  it("registers future domains without modifying the core catalog", () => {
    const created = planner.registerFutureDomain({
      domainId: "whatsapp-knowledge",
      name: "WhatsApp Knowledge",
      description: "WhatsApp creative and messaging conventions for local markets.",
      parentDomainId: "social-media-knowledge",
      tags: ["whatsapp", "messaging"],
      priority: KnowledgeDomainPriority.Medium,
    });

    expect(created.status).toBe(KnowledgeDomainStatus.Expanded);
    expect(created.origin).toBe(KnowledgeDomainOrigin.Runtime);
    expect(planner.listDomains()).toHaveLength(32);
    expect(planner.getDomain("social-media-knowledge")?.childDomainIds).toContain("whatsapp-knowledge");
    expect(CORE_KNOWLEDGE_DOMAINS).toHaveLength(31);

    const registryPath = path.join(storageRoot, "knowledge", "domain-planning", "domain-registry.json");
    expect(fs.existsSync(registryPath)).toBe(true);
  });
});
