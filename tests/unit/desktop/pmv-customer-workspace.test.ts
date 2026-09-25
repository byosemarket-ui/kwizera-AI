import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PMV_CUSTOMER_STEPS,
  customerStatus,
  initialStep,
  isVideoDelivered,
  reachableSteps,
  validateForCreate,
  validateProduct,
  validateStyle,
  videoStyleOptions,
  type PmvViewInput,
} from "../../../desktop/customer-platform/workspace/pmv/view-model.ts";
import { CUSTOMER_STEP_LABELS } from "../../../ai/pmv-orchestrator/types.ts";
import type { CustomerWorkflowSummary } from "../../../ai/pmv-orchestrator/views.ts";

const base: PmvViewInput = {
  productName: "Red Sneakers",
  savedPhotoCount: 3,
  uploadingPhotoCount: 0,
  generationMode: "EXACT_PRODUCT",
  cinematicAvailable: false,
  platform: null,
  aspectRatio: "9:16",
  durationSeconds: 15,
  finalOutputUrl: null,
  deliveryStatus: "NOT_DELIVERED",
  produceStatus: "NOT_STARTED",
};

function wf(status: CustomerWorkflowSummary["status"], extra: Partial<CustomerWorkflowSummary> = {}): CustomerWorkflowSummary {
  return {
    workflowId: "w1",
    status,
    label: "x",
    message: null,
    progress: { completed: 0, total: 7 },
    stages: [],
    canResume: false,
    canCancel: false,
    canRetry: false,
    delivered: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

const workspaceDir = path.resolve("desktop/customer-platform/workspace");
const customerFiles = [
  path.join(workspaceDir, "ProductMarketingVideoWorkspace.tsx"),
  ...fs.readdirSync(path.join(workspaceDir, "pmv")).map((f) => path.join(workspaceDir, "pmv", f)),
  path.resolve("desktop/pmv-workflow/usePmvWorkflow.ts"),
];

describe("Phase 9 — PMV customer workflow model", () => {
  it("exposes exactly five customer steps", () => {
    expect(PMV_CUSTOMER_STEPS.map((s) => s.id)).toEqual(["product", "style", "create", "preview", "final"]);
  });

  it("maps workflow state onto the small customer status set", () => {
    expect(customerStatus(null, base)).toBe("READY");
    expect(customerStatus(wf("QUEUED"), base)).toBe("CREATING");
    expect(customerStatus(wf("RUNNING"), base)).toBe("PROCESSING");
    expect(customerStatus(wf("WAITING_FOR_USER"), base)).toBe("REVIEW");
    expect(customerStatus(wf("FAILED"), base)).toBe("FAILED");
    const delivered = { ...base, finalOutputUrl: "/v.mp4", deliveryStatus: "DELIVERED" };
    expect(customerStatus(wf("COMPLETED"), delivered)).toBe("COMPLETED");
    expect(customerStatus(null, delivered)).toBe("COMPLETED");
  });

  it("never claims delivery without a backend-confirmed final asset", () => {
    expect(isVideoDelivered({ finalOutputUrl: null, deliveryStatus: "DELIVERED", produceStatus: "DELIVERED" })).toBe(false);
    expect(isVideoDelivered({ finalOutputUrl: "/v.mp4", deliveryStatus: "NOT_DELIVERED", produceStatus: "QA_PASSED" })).toBe(false);
    expect(isVideoDelivered({ finalOutputUrl: "/v.mp4", deliveryStatus: "DELIVERED", produceStatus: "DELIVERED" })).toBe(true);
  });

  it("validates product input with customer-safe messages", () => {
    expect(validateProduct({ ...base, productName: " " })).toBe("Please enter a product name.");
    expect(validateProduct({ ...base, savedPhotoCount: 0 })).toBe("Please add at least one product photo.");
    expect(validateProduct({ ...base, savedPhotoCount: 0, uploadingPhotoCount: 2 })).toMatch(/finish uploading/);
    expect(validateProduct(base)).toBeNull();
  });

  it("never presents 3D as available and gates cinematic on the real capability", () => {
    for (const available of [true, false, null]) {
      const options = videoStyleOptions(available);
      expect(options.map((o) => o.id)).toEqual(["slideshow", "showcase3d", "cinematic"]);
      expect(options.find((o) => o.id === "showcase3d")?.availability).toBe("coming_soon");
      expect(options.find((o) => o.id === "showcase3d")?.generationMode).toBeNull();
      expect(options.find((o) => o.id === "slideshow")?.availability).toBe("available");
    }
    expect(videoStyleOptions(true).find((o) => o.id === "cinematic")?.availability).toBe("available");
    expect(videoStyleOptions(false).find((o) => o.id === "cinematic")?.availability).toBe("unavailable");
    expect(videoStyleOptions(null).find((o) => o.id === "cinematic")?.availability).toBe("unavailable");
    expect(validateStyle({ ...base, generationMode: "CINEMATIC", cinematicAvailable: false })).toMatch(/not available yet/);
    expect(validateStyle({ ...base, generationMode: "ADVANCED_CREATIVE", cinematicAvailable: true })).toMatch(/choose a video style/i);
    expect(validateForCreate(base)).toBeNull();
  });

  it("lands customers on the step matching their project", () => {
    expect(initialStep(null, base)).toBe("product");
    expect(initialStep(wf("RUNNING"), base)).toBe("create");
    expect(initialStep(wf("WAITING_FOR_USER"), base)).toBe("create");
    expect(initialStep(null, { ...base, finalOutputUrl: "/v.mp4" })).toBe("preview");
    expect(initialStep(wf("COMPLETED"), { ...base, finalOutputUrl: "/v.mp4", deliveryStatus: "DELIVERED" })).toBe("final");
  });

  it("only unlocks preview/final when real output exists", () => {
    const steps = reachableSteps(null, { ...base, savedPhotoCount: 0 });
    expect([...steps]).toEqual(["product", "style"]);
    const ready = reachableSteps(null, base);
    expect(ready.has("create")).toBe(true);
    expect(ready.has("preview")).toBe(false);
    const done = reachableSteps(wf("COMPLETED"), { ...base, finalOutputUrl: "/v.mp4", deliveryStatus: "DELIVERED" });
    expect(done.has("preview") && done.has("final")).toBe(true);
  });
});

describe("Phase 9 — customer-facing PMV surface stays free of internals", () => {
  it("contains no provider, model, infrastructure, debug or delivery-override controls", () => {
    const banned = /Ollama|OpenAI|FFmpeg|providerId|modelId|CapabilityRuntime|capability runtime|Admin|api[_ -]?key|secret|confidence|markReadyForIntelligence|markDelivered|runProductVideoQa|Mark as delivered|Mark ready|Product Intelligence|Identity Lock|storyboard|fal\.|replicate/i;
    for (const file of customerFiles) {
      const src = fs.readFileSync(file, "utf8");
      expect(src.match(banned), path.relative(process.cwd(), file)).toBeNull();
    }
  });

  it("never calls providers directly from the customer UI", () => {
    for (const file of customerFiles) {
      const src = fs.readFileSync(file, "utf8");
      expect(src, path.relative(process.cwd(), file)).not.toMatch(/fetch\(\s*["'`]https?:/);
    }
  });

  it("customer stage labels are plain language", () => {
    for (const label of Object.values(CUSTOMER_STEP_LABELS)) {
      expect(label).not.toMatch(/[A-Z]{2,}_|provider|model|capability|pipeline|QA|ffmpeg|render job/i);
    }
  });

  it("uses theme tokens and a compact container-driven photo grid", () => {
    const css = fs.readFileSync(path.join(workspaceDir, "product-marketing-video.css"), "utf8");
    expect(css).toContain("container: pmv / inline-size");
    for (const cols of [2, 3, 6, 8]) expect(css).toContain(`repeat(${cols}, minmax(0, 1fr))`);
    expect(css).toContain(':root[data-theme="light"] .pmv');
    expect(css).not.toMatch(/background:\s*#(?!000\b)[0-9a-f]{3,6}/i);
    const container = fs.readFileSync(path.join(workspaceDir, "ProductMarketingVideoWorkspace.tsx"), "utf8");
    expect(container).not.toContain("product-setup.css");
    expect(container.match(/<h1/g)).toBeNull();
  });

  it("keeps the responsive foundation: square thumbnails, compact stepper, compact header, dynamic viewport", () => {
    const css = fs.readFileSync(path.join(workspaceDir, "product-marketing-video.css"), "utf8");
    expect(css).toMatch(/\.pmv-photo__thumb \{[^}]*aspect-ratio: 1;[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.pmv-photo__thumb img \{[^}]*position: absolute;[^}]*object-fit: cover;/);
    expect(css).toContain("@container pmv (max-width: 519px)");
    expect(css).toContain(".pmv-steps button:not(.is-active) .pmv-steps__label");
    expect(css).toMatch(/@media \(max-width: 1024px\) \{\s*\.cp-service-workspace\[data-service-key="product-marketing-video"\]/);
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.cp-sw-title-block \{ display: contents; \}/);
    expect(css).toContain("68dvh");
    expect(css).not.toMatch(/\b100vh\b/);
    const customerCss = fs.readFileSync(path.join(workspaceDir, "..", "customer.css"), "utf8");
    expect(customerCss).toMatch(/\.layout-engine-shell\.customer-surface \{[^}]*height: 100dvh;/);
  });
});
