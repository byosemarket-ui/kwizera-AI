#!/usr/bin/env node
/**
 * STEP 10 live acceptance — scene composition plans on ENGINE 1 timeline.
 * Verifies compositionPlan identity, product protection hints, typography reuse,
 * dual-project isolation, and diagnostics. Does not claim STEP 11 final render ownership.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step10-composition-artifacts");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function productPng(width, height, r, g, b, edge = false) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      const left = edge ? 0.02 : 0.08;
      const right = edge ? 0.48 : 0.52;
      const top = edge ? 0.15 : 0.2;
      const bottom = edge ? 0.75 : 0.8;
      const p = x > width * left && x < width * right && y > height * top && y < height * bottom;
      const busy = !p && (x + y) % 17 < 3;
      raw[i] = p ? r : busy ? 210 : 248;
      raw[i + 1] = p ? g : busy ? 200 : 248;
      raw[i + 2] = p ? b : busy ? 190 : 250;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}

async function api(pathname, { method = "GET", body, retries = 14 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(`${BASE}${pathname}`, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      if (res.ok) return json;
      last = new Error(`${method} ${pathname} -> ${res.status}: ${text.slice(0, 400)}`);
      if (res.status === 503 || res.status === 429 || json?.status === "starting") {
        await new Promise((r) => setTimeout(r, 2500 + attempt * 1200));
        continue;
      }
      throw last;
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
      await new Promise((r) => setTimeout(r, 2500 + attempt * 1200));
    }
  }
  throw last ?? new Error("api failed");
}

async function seedProject(tag, product) {
  const created = await api("/api/workspace/projects", { method: "POST", body: { name: `STEP10-${tag}-${Date.now()}` } });
  const projectId = created.project?.id;
  if (!projectId) throw new Error("create project failed");
  await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: product.name,
          category: product.category,
          description: product.description,
          price: product.price,
          originalPrice: product.originalPrice,
          currency: "RWF",
          website: product.website,
          phone: product.phone,
          callToAction: product.cta,
        },
        brandInformation: { name: product.brand, website: product.website, colors: product.color },
        campaignInformation: { name: `Campaign ${tag}`, objective: "conversions", callToAction: product.cta },
        platform: "tiktok",
        language: "en",
        creativeTone: "Premium",
      },
    },
  });
  for (const img of product.images) {
    await api(`/api/workspace/projects/${projectId}/images`, {
      method: "POST",
      body: { fileName: img.fileName, mimeType: "image/png", dataBase64: img.dataBase64 },
    });
  }
  try {
    await api(`/api/product-asset-preparation/projects/${projectId}/prepare`, { method: "POST", body: {} });
  } catch { /* optional */ }
  await api(`/api/workspace/projects/${projectId}/plan`, {
    method: "POST",
    body: { action: "generate", productionMode: "AI_PRODUCT_MOTION", creativeTone: "Premium" },
  });
  await api(`/api/workspace/projects/${projectId}/plan/finalize`, { method: "POST", body: {} });
  return { projectId };
}

async function main() {
  const checks = [];
  const pass = (n, d) => { checks.push({ name: n, ok: true, detail: d }); console.log(`PASS ${n}: ${d}`); };
  const fail = (n, d) => { checks.push({ name: n, ok: false, detail: d }); console.error(`FAIL ${n}: ${d}`); };
  mkdirSync(OUT_DIR, { recursive: true });

  const health = await api("/api/health");
  pass("health", health.status || "ok");
  const deploy = await api("/api/deployment");
  const deployed = String(deploy.deployedCommit || "");
  if (EXPECTED && !deployed.startsWith(EXPECTED)) fail("deployed-commit", `got ${deployed.slice(0, 7)} expected ${EXPECTED}`);
  else pass("deployed-commit", `${deployed.slice(0, 7)} verified=${deploy.verifiedLive}`);

  const caps = await api("/api/video-production/capabilities?views=3");
  if (caps.sceneComposition?.compositionEngineAvailable) pass("composition-diagnostics", caps.sceneComposition.version || "ok");
  else fail("composition-diagnostics", JSON.stringify(caps.sceneComposition || {}).slice(0, 200));
  if (caps.smartCamera?.smartCameraAvailable) pass("smart-camera-still", caps.smartCamera.version || "ok");
  else fail("smart-camera-still", "missing");

  const projectA = await seedProject("A", {
    name: "Nyungwe Trail Boot",
    category: "Footwear",
    description: "Rugged trail boot for Rwanda mountain walks.",
    price: 89000,
    originalPrice: 110000,
    website: "https://www.kwizera.rw/boots",
    phone: "+250788000111",
    cta: "Order Now",
    brand: "KWIZERA",
    color: "#FF6A00",
    images: [
      { fileName: "boot-hero.png", dataBase64: productPng(360, 540, 110, 70, 40) },
      { fileName: "boot-detail.png", dataBase64: productPng(300, 300, 50, 90, 130) },
      { fileName: "boot-edge.png", dataBase64: productPng(320, 420, 130, 80, 50, true) },
    ],
  });
  pass("project-a", projectA.projectId);

  const projectB = await seedProject("B", {
    name: "Kigali Desk Lamp",
    category: "Home",
    description: "Modern desk lamp for focused work.",
    price: 42000,
    originalPrice: 55000,
    website: "https://www.kwizera.rw/lamp",
    phone: "+250788000222",
    cta: "Buy Lamp",
    brand: "KWIZERA Home",
    color: "#1A5FFF",
    images: [
      { fileName: "lamp-hero.png", dataBase64: productPng(400, 400, 40, 90, 200) },
      { fileName: "lamp-side.png", dataBase64: productPng(480, 280, 30, 60, 160) },
    ],
  });
  pass("project-b", projectB.projectId);

  const videoA = (await api(`/api/video-production/projects/${projectA.projectId}`, { method: "POST", body: {} })).video;
  if (videoA.productionMode !== "AI_PRODUCT_MOTION") fail("video-mode", String(videoA.productionMode));
  else pass("video-mode", videoA.productionMode);

  const clips = videoA.timeline ?? [];
  const withComp = clips.filter((c) => c.compositionPlan);
  if (!withComp.length) fail("composition-at-create", "missing compositionPlan");
  else {
    const biases = [...new Set(withComp.map((c) => c.compositionPlan.product?.bias).filter(Boolean))];
    const valid = withComp.filter((c) => c.compositionPlan.compositionValid !== false).length;
    pass("composition-at-create", `n=${withComp.length} biases=${biases.join("|") || "n/a"} validish=${valid}`);
    const idsOk = withComp.every((c) =>
      c.compositionPlan.projectId === projectA.projectId
      && c.compositionPlan.assetId === c.assetId
      && c.compositionPlan.sceneId === c.sceneId);
    if (!idsOk) fail("composition-identity", "project/scene/asset mismatch");
    else pass("composition-identity", "ok");
    const cameraKept = withComp.every((c) => c.cameraPlan || c.motionParams);
    if (!cameraKept) fail("camera-preserved", "camera/motion missing after composition");
    else pass("camera-preserved", "ok");
    const hasText = clips.some((c) => (c.text || []).length > 0) || Boolean(videoA.typographyPlan?.scenes?.length);
    if (!hasText) fail("typography-reused", "no timeline text / typographyPlan");
    else pass("typography-reused", `scenes=${videoA.typographyPlan?.scenes?.length ?? "layers"}`);
  }

  const videoB = (await api(`/api/video-production/projects/${projectB.projectId}`, { method: "POST", body: {} })).video;
  const assetsA = new Set(clips.map((c) => c.assetId));
  const assetsB = new Set((videoB.timeline ?? []).map((c) => c.assetId));
  if ([...assetsA].some((id) => assetsB.has(id))) fail("isolation-assets", "leak");
  else pass("isolation-assets", `A=${assetsA.size} B=${assetsB.size}`);
  const leakComp = (videoB.timeline ?? []).some((c) => c.compositionPlan?.projectId === projectA.projectId);
  if (leakComp) fail("isolation-composition", "B has A projectId");
  else pass("isolation-composition", "ok");

  // Soft live render to persist composition after camera (STEP 10 handoff readiness — not STEP 11 acceptance).
  const render = await api(`/api/video-production/projects/${projectA.projectId}/render`, {
    method: "POST",
    body: { preset: "standard" },
  });
  const jobId = render.job?.id;
  if (!jobId) throw new Error("no job");
  pass("render-queued", jobId);
  const started = Date.now();
  let finished = null;
  while (Date.now() - started < 420_000) {
    const payload = await api(`/api/video-production/projects/${projectA.projectId}/jobs/${jobId}`);
    finished = payload.job ?? payload;
    process.stdout.write(`  ${finished.status} ${finished.stage ?? ""} ${finished.progress ?? 0}%\n`);
    if (finished.status === "completed" || finished.status === "failed") break;
    await new Promise((r) => setTimeout(r, 2800));
  }
  if (finished?.status !== "completed") fail("render-complete", `${finished?.status} ${finished?.error || ""}`);
  else pass("render-complete", "ok");

  const finalVideo = (await api(`/api/video-production/projects/${projectA.projectId}`)).video;
  const finalComp = (finalVideo?.timeline ?? []).filter((c) => c.compositionPlan);
  if (!finalComp.length) fail("composition-persisted", "none after render");
  else {
    const modes = [...new Set(finalComp.map((c) => c.compositionPlan.product?.cameraMode).filter(Boolean))];
    pass("composition-persisted", `n=${finalComp.length} cameraModes=${modes.join("|") || "n/a"}`);
  }

  const failed = checks.filter((c) => !c.ok);
  const report = {
    verifiedLive: failed.length === 0,
    note: "STEP 10 composition handoff verified; STEP 11 owns final render acceptance.",
    base: BASE,
    deployedCommit: deployed,
    projectA: projectA.projectId,
    projectB: projectB.projectId,
    jobId,
    checks,
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
