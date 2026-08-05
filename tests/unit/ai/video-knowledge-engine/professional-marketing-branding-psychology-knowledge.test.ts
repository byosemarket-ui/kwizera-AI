import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BRANDING_DOMAIN_ID,
  createAiCore,
  CUSTOMER_PSYCHOLOGY_DOMAIN_ID,
  MARKETING_DOMAIN_ID,
  PROFESSIONAL_BRANDING_TOPICS,
  PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
  PROFESSIONAL_MARKETING_TOPICS,
  PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
  PROFESSIONAL_VIDEO_MARKETING_TOPICS,
  REQUIRED_BRANDING_TOPIC_IDS,
  REQUIRED_CUSTOMER_PSYCHOLOGY_TOPIC_IDS,
  REQUIRED_MARKETING_TOPIC_IDS,
  REQUIRED_SALES_PSYCHOLOGY_TOPIC_IDS,
  REQUIRED_VIDEO_MARKETING_TOPIC_IDS,
  SALES_PSYCHOLOGY_DOMAIN_ID,
} from "@ai";

describe("Professional Marketing, Branding & Psychology Knowledge (Expansion Step 7)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-mbp-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("catalog covers required marketing, branding, and psychology topics", () => {
    expect(REQUIRED_MARKETING_TOPIC_IDS.length).toBe(12);
    expect(REQUIRED_BRANDING_TOPIC_IDS.length).toBe(10);
    expect(REQUIRED_CUSTOMER_PSYCHOLOGY_TOPIC_IDS.length).toBe(10);
    expect(REQUIRED_SALES_PSYCHOLOGY_TOPIC_IDS.length).toBe(10);
    expect(REQUIRED_VIDEO_MARKETING_TOPIC_IDS.length).toBe(8);
    expect(PROFESSIONAL_MARKETING_TOPICS.length).toBe(12);
    expect(PROFESSIONAL_BRANDING_TOPICS.length).toBe(10);
    expect(PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS.length).toBe(10);
    expect(PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS.length).toBe(10);
    expect(PROFESSIONAL_VIDEO_MARKETING_TOPICS.length).toBe(8);

    const ids = [
      ...PROFESSIONAL_MARKETING_TOPICS,
      ...PROFESSIONAL_BRANDING_TOPICS,
      ...PROFESSIONAL_CUSTOMER_PSYCHOLOGY_TOPICS,
      ...PROFESSIONAL_SALES_PSYCHOLOGY_TOPICS,
      ...PROFESSIONAL_VIDEO_MARKETING_TOPICS,
    ].map((t) => t.knowledgeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Full foundation startup re-runs Steps 1–5 + 7 expansions (~45–60 min on typical hardware).
  it(
    "installs marketing, branding, psychology topics with AI Me capabilities",
    async () => {
      const core = createAiCore({ storageRootOverride: storageRoot });
      await core.start("mbp-expansion");
      const foundation = core.getManager().knowledgeFoundation!;
      const mbp = foundation.getProfessionalMarketingBrandingPsychologyKnowledge();

      const install = mbp.getLastInstall();
      expect(install?.installed).toBe(true);

      const health = await mbp.runHealthCheck();
      expect(health.healthy).toBe(true);
      expect(health.brokenRelationships).toEqual([]);
      expect(health.duplicateKnowledge).toEqual([]);

      expect(mbp.recommendMarketingStrategy("performance marketing creative testing").available).toBe(true);
      expect(mbp.recommendBrandingStrategy("brand consistency across video").available).toBe(true);
      expect(mbp.explainCustomerPsychology("attention psychology hooks").available).toBe(true);
      expect(mbp.explainSalesPsychology("social proof in ads").available).toBe(true);
      expect(mbp.recommendCta("bottom funnel call to action").available).toBe(true);
      expect(mbp.recommendProductPresentation("feature vs benefit presentation").available).toBe(true);
      expect(mbp.answer("How do I create a strong video hook?").available).toBe(true);

      const awareness = mbp.getAiMeAwareness();
      expect(awareness.canRecommendMarketingStrategies).toBe(true);
      expect(awareness.canRecommendBrandingStrategies).toBe(true);
      expect(awareness.canExplainCustomerPsychology).toBe(true);
      expect(awareness.canExplainSalesPsychology).toBe(true);
      expect(awareness.marketingDomainReady).toBe(true);
      expect(awareness.brandingDomainReady).toBe(true);
      expect(awareness.customerPsychologyDomainReady).toBe(true);
      expect(awareness.salesPsychologyDomainReady).toBe(true);

      expect(foundation.getKnowledgeDomainPlanner().getDomain(MARKETING_DOMAIN_ID)?.metadata.contentReady).toBe(true);
      expect(foundation.getKnowledgeDomainPlanner().getDomain(BRANDING_DOMAIN_ID)?.metadata.contentReady).toBe(true);
      expect(
        foundation.getKnowledgeDomainPlanner().getDomain(CUSTOMER_PSYCHOLOGY_DOMAIN_ID)?.metadata.contentReady
      ).toBe(true);
      expect(foundation.getKnowledgeDomainPlanner().getDomain(SALES_PSYCHOLOGY_DOMAIN_ID)?.metadata.contentReady).toBe(
        true
      );

      expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "marketing", "pack.json"))).toBe(true);
      expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "branding", "pack.json"))).toBe(true);
      expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "customer-psychology", "pack.json"))).toBe(true);
      expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "sales-psychology", "pack.json"))).toBe(true);

      await core.stop();
    },
    3_600_000
  );
});
