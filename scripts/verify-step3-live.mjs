#!/usr/bin/env node
/**
 * Live Step 3 verification: project continuity, video type persistence,
 * duration-aware plan, finalize, and Step 4 production mode handoff fields.
 */
import { deflateSync } from "node:zlib";

const BASE = (process.argv[2] ?? "http://162.35.114.19:5173").replace(/\/$/, "");
const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  let crc = 0xffffffff;
  const crcInput = Buffer.concat([typeBuffer, data]);
  for (let i = 0; i < crcInput.length; i += 1) {
    crc ^= crcInput[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodeRgbaPng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function testPng(width, height, r, g, b) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodeRgbaPng(width, height, rgba).toString("base64");
}

async function json(method, path, body, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body != null ? { "Content-Type": "application/json" } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep */ }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (error) {
    return { ok: false, status: 0, body: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`Live Step 3 verification — ${BASE}`);

  const deploy = await json("GET", "/api/deployment");
  const sha = deploy.body?.deployedCommit ?? deploy.body?.requestedCommit ?? "";
  record("deployed commit matches Step 3", String(sha).startsWith("d8a6dc4"), sha.slice(0, 12));

  const stamp = `STEP3-LIVE-${Date.now()}`;
  const created = await json("POST", "/api/workspace/projects", { name: stamp });
  const projectId = created.body?.project?.id;
  record("create project", created.ok && Boolean(projectId), projectId ?? "");
  if (!projectId) {
    process.exit(1);
  }

  await json("POST", `/api/workspace/projects/${projectId}`, { action: "open" });

  const imageIds = [];
  for (const [i, color] of [[210, 80, 60], [60, 120, 210], [40, 160, 90]].entries()) {
    const up = await json("POST", `/api/workspace/projects/${projectId}/images`, {
      fileName: `step3-${i + 1}.png`,
      mimeType: "image/png",
      dataBase64: testPng(320, 240, color[0], color[1], color[2]),
      width: 320,
      height: 240,
    });
    if (up.body?.image?.id) imageIds.push(up.body.image.id);
  }
  record("upload product images", imageIds.length >= 2, imageIds.join(", "));

  await json("POST", `/api/workspace/projects/${projectId}`, {
    changes: {
      productInformation: {
        name: "Brown Oxford Shoe",
        category: "Shoes",
        description: "Formal brown leather-like oxford",
        price: 20000,
        originalPrice: 25000,
        currency: "RWF",
      },
      campaignInformation: {
        objective: "Product Showcase",
        callToAction: "Gura ubu",
        platforms: ["tiktok"],
      },
      language: "Kinyarwanda",
      platform: "tiktok",
      targetAudience: "Everyone",
    },
  });

  const brief = await json("PUT", `/api/marketing-brief/projects/${projectId}`, {
    campaign: {
      platforms: ["tiktok"],
      language: "Kinyarwanda",
      objective: "Product Showcase",
    },
    output: {
      duration: "30s",
    },
    userDefined: {
      currentPrice: 20000,
      originalPrice: 25000,
      currency: "RWF",
      videoPlatformId: "tiktok",
    },
  });
  record("marketing brief updated", brief.ok, String(brief.status));

  const classic = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "CLASSIC_SHOWCASE",
    creativeTone: "Premium",
    regenerate: true,
    durationSeconds: 30,
  });
  const classicMode = classic.body?.plan?.productionMode;
  const classicScenes = classic.body?.plan?.scenes?.length ?? 0;
  const classicTotal = (classic.body?.plan?.scenes ?? []).reduce(
    (sum, scene) => sum + (scene.durationMs ?? Math.round((scene.durationSeconds || 0) * 1000)),
    0,
  );
  record("generate CLASSIC_SHOWCASE plan", classic.ok && classicScenes > 0, `${classicScenes} scenes`);
  record("persisted productionMode is CLASSIC_SHOWCASE", classicMode === "CLASSIC_SHOWCASE", String(classicMode));
  record("scene timing near 30s", Math.abs(classicTotal - 30000) <= 2500, `${classicTotal}ms`);
  record("same projectId on plan", classic.body?.plan?.projectId === projectId, classic.body?.plan?.projectId ?? "");
  record(
    "discount only when previous > current",
    (classic.body?.plan?.commercial?.pricing?.discountPercentage ?? 0) > 0,
    String(classic.body?.plan?.commercial?.pricing?.discountPercentage),
  );
  record("every scene has assetId", (classic.body?.plan?.scenes ?? []).every((s) => s.assetId), "");

  const reloaded = await json("GET", `/api/workspace/projects/${projectId}/plan`);
  record(
    "refresh restores CLASSIC_SHOWCASE",
    reloaded.body?.plan?.productionMode === "CLASSIC_SHOWCASE",
    String(reloaded.body?.plan?.productionMode),
  );

  const motion = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "AI_PRODUCT_MOTION",
    creativeTone: "Modern",
    regenerate: true,
    durationSeconds: 15,
  });
  record(
    "switch to AI_PRODUCT_MOTION persists",
    motion.body?.plan?.productionMode === "AI_PRODUCT_MOTION",
    String(motion.body?.plan?.productionMode),
  );
  const motionTotal = (motion.body?.plan?.scenes ?? []).reduce(
    (sum, scene) => sum + (scene.durationMs ?? Math.round((scene.durationSeconds || 0) * 1000)),
    0,
  );
  record("15s duration controls scene total", Math.abs(motionTotal - 15000) <= 2500, `${motionTotal}ms`);

  const updateMode = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    changes: { productionMode: "CLASSIC_SHOWCASE" },
  });
  record(
    "updatePlan persists productionMode alone",
    updateMode.body?.plan?.productionMode === "CLASSIC_SHOWCASE",
    String(updateMode.body?.plan?.productionMode),
  );

  const finalized = await json("POST", `/api/workspace/projects/${projectId}/plan/finalize`, {});
  record(
    "finalize ready for Step 4",
    finalized.ok && finalized.body?.plan?.productionStatus === "READY_FOR_VIDEO_PRODUCTION",
    finalized.body?.plan?.productionStatus ?? finalized.body?.error ?? "",
  );
  record(
    "finalized mode reaches Step 4 payload source",
    finalized.body?.plan?.productionMode === "CLASSIC_SHOWCASE",
    String(finalized.body?.plan?.productionMode),
  );
  record(
    "language remains Kinyarwanda-aware in analyses",
    String(finalized.body?.plan?.analyses?.language ?? "").toLowerCase().includes("kinyarwanda")
      || String(finalized.body?.plan?.audioDirection ?? "").toLowerCase().includes("kinyarwanda"),
    String(finalized.body?.plan?.analyses?.language ?? finalized.body?.plan?.audioDirection ?? ""),
  );

  const invalidDiscount = await json("POST", `/api/workspace/projects/${projectId}`, {
    changes: {
      productInformation: {
        name: "Brown Oxford Shoe",
        category: "Shoes",
        description: "Formal brown leather-like oxford",
        price: 25000,
        originalPrice: 20000,
        currency: "RWF",
      },
    },
  });
  record("can update invalid previous price on project", invalidDiscount.ok);
  const regen = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "CLASSIC_SHOWCASE",
    regenerate: true,
    durationSeconds: 30,
  });
  record(
    "invalid previous price does not invent discount",
    (regen.body?.plan?.commercial?.pricing?.discountPercentage ?? null) == null,
    String(regen.body?.plan?.commercial?.pricing?.discountPercentage),
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} Step 3 live checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
