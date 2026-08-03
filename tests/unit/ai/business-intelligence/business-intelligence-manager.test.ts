import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { BusinessIntelligenceManager } from "../../../../ai/business-intelligence/business-intelligence-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { DecisionIntelligenceManager } from "../../../../ai/decision-intelligence/decision-intelligence-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { MarketingIntelligenceManager } from "../../../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe("BusinessIntelligenceManager", () => {
  it("calculates evidence-backed analytics and exports local business reports", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-business-intelligence-")); roots.push(root);
    const workspace = new CreativeWorkspaceManager(); await workspace.initialize(root); await workspace.createProject("Business launch");
    const images = new ImageIntelligenceManager(); await images.initialize(root, { core: undefined as unknown as AiCoreManager, workspace });
    const products = new ProductIntelligenceManager(); await products.initialize(root, { core: undefined as unknown as AiCoreManager, workspace }); products.attachImageIntelligence(images);
    const marketing = new MarketingIntelligenceManager(); await marketing.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, products, images });
    const models = new AiModelManager(); await models.initialize(root);
    const decisions = new DecisionIntelligenceManager(); await decisions.initialize(root, { core: undefined as unknown as AiCoreManager, workspace, models, products, images, marketing });
    const learningEvents: unknown[] = []; const knowledgeRecords: unknown[] = [];
    const core = { memoryFoundation: { learningMemoryEngine: { isStartupComplete: () => true, learnFromEvent: async (event: unknown) => { learningEvents.push(event); } } }, knowledgeFoundation: { isStartupComplete: () => true, getStorageEngine: () => ({ storeRecord: async (record: unknown) => { knowledgeRecords.push(record); return { success: true }; } }) } } as unknown as AiCoreManager;
    const manager = new BusinessIntelligenceManager(core, workspace, products, marketing, decisions); await manager.initialize(root);
    await manager.recordSales([{ productId: "bottle", productName: "Steel Bottle", occurredAt: "2026-07-01T10:00:00.000Z", quantity: 4, unitPrice: 25, currency: "usd" }, { productId: "bottle", productName: "Steel Bottle", occurredAt: "2026-07-02T10:00:00.000Z", quantity: 6, unitPrice: 25, currency: "usd" }, { productId: "cup", productName: "Travel Cup", occurredAt: "2026-07-02T11:00:00.000Z", quantity: 1, unitPrice: 10, currency: "usd" }]);
    await manager.upsertInventory([{ sku: "BOTTLE", name: "Steel Bottle", quantityOnHand: 2, reorderPoint: 5, targetStock: 20 }, { sku: "CUP", name: "Travel Cup", quantityOnHand: 50, reorderPoint: 3, targetStock: 15 }]);
    await manager.recordMarketing([{ campaign: "Launch", occurredAt: "2026-07-02T12:00:00.000Z", spend: 100, impressions: 1000, engagements: 80, conversions: 8, attributedRevenue: 70 }]);
    const dashboard = await manager.getDashboard();
    expect(dashboard.dataStatus).toBe("ready"); expect(dashboard.sales.revenue).toBe(260); expect(dashboard.sales.products[0]?.productName).toBe("Steel Bottle"); expect(dashboard.marketing.roiPercent).toBe(-30); expect(dashboard.inventory.lowStock).toHaveLength(1); expect(dashboard.inventory.overstock).toHaveLength(1); expect(dashboard.forecast.available).toBe(true); expect(dashboard.recommendations.some((item) => item.area === "inventory" && item.priority === "high")).toBe(true); expect(dashboard.recommendations.some((item) => item.area === "marketing" && item.priority === "high")).toBe(true);
    for (const format of ["json", "csv", "pdf", "excel"] as const) { const exported = await manager.exportReport("executive", format); const filePath = await manager.getExportPath(exported.fileName); expect(filePath).toBeTruthy(); const contents = await fs.readFile(filePath!); if (format === "pdf") expect(contents.subarray(0, 4).toString()).toBe("%PDF"); else expect(contents.length).toBeGreaterThan(0); }
    expect(learningEvents.length).toBeGreaterThan(0); expect(knowledgeRecords.length).toBeGreaterThan(0);
    await expect(manager.recordSales([{ productId: "euro", productName: "Euro product", occurredAt: "2026-07-03T10:00:00.000Z", quantity: 1, unitPrice: 10, currency: "EUR" }])).rejects.toThrow("one currency");
    await expect(manager.recordSales([{ productId: "bad", productName: "Bad", occurredAt: "not-a-date", quantity: 0, unitPrice: 1, currency: "USD" }])).rejects.toThrow("Sale quantity");
  });
});