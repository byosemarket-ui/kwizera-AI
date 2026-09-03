#!/usr/bin/env node
/**
 * Live STEP 2 typography acceptance against production.
 * Uses existing workspace / planning / video-production APIs only.
 */
import { encodeRgbaPng } from "../ai/creative-workspace/png-pixels.js";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");

async function api(pathname, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

function solidPng(r, g, b) {
  const rgba = Buffer.alloc(96 * 128 * 4);
  for (let i = 0; i < 96 * 128; i += 1) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return encodeRgbaPng(96, 128, rgba).toString("base64");
}

async function waitJob(projectId, jobId) {
  const started = Date.now();
  while (Date.now() - started < 300_000) {
    const payload = await api(`/api/video-production/projects/${projectId}/jobs/${jobId}`);
    const job = payload.job ?? payload;
    if (job.status === "completed" || job.status === "failed") return job;
    process.stdout.write(`  job ${job.status} ${job.stage ?? ""} ${job.progress ?? 0}% ${job.stageMessage ?? ""}\n`);
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error("Render job timed out");
}

async function main() {
  const checks = [];
  const pass = (name, detail) => { checks.push({ name, ok: true, detail }); console.log(`PASS ${name}: ${detail}`); };
  const fail = (name, detail) => { checks.push({ name, ok: false, detail }); console.error(`FAIL ${name}: ${detail}`); };

  const health = await api("/api/health");
  pass("health", health.status || "ok");

  const deploy = await api("/api/deployment");
  pass("deployment", `${deploy.deployedCommit?.slice(0, 7)} verified=${deploy.verifiedLive}`);

  const typo = await api("/api/typography/diagnostics");
  if (!typo.fallbackFontAvailable || !typo.rendererFontResolutionReady) fail("typography-diagnostics", JSON.stringify(typo));
  else pass("typography-diagnostics", `${typo.verifiedFontCount} fonts fallback=${typo.fallbackFamily}`);

  const created = await api("/api/workspace/projects", {
    method: "POST",
    body: { name: `STEP2-TYPO-${Date.now()}` },
  });
  const projectId = created.project?.id;
  if (!projectId) throw new Error("No project id");
  pass("project-create", projectId);

  await api(`/api/workspace/projects/${projectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: "Kwamamaza Smart Phone",
          category: "technology gadgets",
          description: "Discover the future of smart technology. Découvrez une nouvelle expérience. Kwamamaza ibicuruzwa byawe mu buryo bugezweho.",
          price: 180000,
          originalPrice: 240000,
          currency: "RWF",
        },
        brandInformation: { name: "KWIZERA", website: "https://example.com" },
        campaignInformation: { name: "Launch", objective: "conversions", callToAction: "Buy now" },
        platform: "tiktok",
        language: "rw",
      },
    },
  });
  pass("product-update", "technology + multilingual copy");

  await api(`/api/workspace/projects/${projectId}/images`, {
    method: "POST",
    body: {
      fileName: "product.png",
      mimeType: "image/png",
      dataBase64: solidPng(35, 90, 160),
    },
  });
  pass("upload-image", "png uploaded");

  const planRes = await api(`/api/workspace/projects/${projectId}/plan`, {
    method: "POST",
    body: { action: "generate", productionMode: "AI_PRODUCT_MOTION" },
  });
  const plan = planRes.plan;
  if (!plan?.id) fail("creative-plan", JSON.stringify(planRes).slice(0, 300));
  else pass("creative-plan", `scenes=${plan.scenes?.length ?? 0}`);

  await api(`/api/workspace/projects/${projectId}/plan/finalize`, { method: "POST", body: {} });
  pass("plan-finalize", "approved");

  const videoRes = await api(`/api/video-production/projects/${projectId}`, { method: "POST", body: {} });
  const video = videoRes.video ?? videoRes;
  const hasTypography = Boolean(video.typographyPlan?.scenes?.length)
    || video.timeline?.some((clip) => clip.text?.some((layer) => layer.typography));
  if (!hasTypography) fail("typography-on-timeline", "missing typography payload");
  else {
    const regions = [...new Set(
      (video.timeline ?? []).flatMap((clip) => (clip.text ?? []).map((layer) => layer.typographyRegion || layer.position)),
    )];
    pass("typography-on-timeline", `regions=${regions.join(",") || "none"}`);
  }

  const render = await api(`/api/video-production/projects/${projectId}/render`, {
    method: "POST",
    body: { preset: "standard" },
  });
  const jobId = render.job?.id;
  if (!jobId) throw new Error("No render job");
  pass("render-queued", jobId);

  const finished = await waitJob(projectId, jobId);
  if (finished.status !== "completed") fail("render-complete", `${finished.status} ${finished.error || ""}`);
  else pass("render-complete", `overlay=${finished.textOverlay} progress=${finished.progress}`);

  if (finished.textOverlay !== "applied") fail("text-overlay-applied", String(finished.textOverlay));
  else pass("text-overlay-applied", "applied");

  const finalPayload = await api(`/api/video-production/projects/${projectId}`);
  const finalVideo = finalPayload.video ?? finalPayload;
  if (!finalVideo?.output?.assetId || !(finalVideo.output.sizeBytes > 1000)) {
    fail("output-file", JSON.stringify(finalVideo?.output ?? null));
  } else {
    pass("output-file", `${finalVideo.output.width}x${finalVideo.output.height} ${finalVideo.output.sizeBytes}B`);
  }

  const assetId = finalVideo?.output?.assetId;
  if (assetId) {
    const dl = await fetch(`${BASE}/api/workspace/projects/${projectId}/videos/${assetId}.mp4`);
    const buf = Buffer.from(await dl.arrayBuffer());
    if (!dl.ok || buf.length < 1000) fail("download", `status=${dl.status} bytes=${buf.length}`);
    else pass("download", `${buf.length} bytes`);
  }

  const failed = checks.filter((item) => !item.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    projectId,
    commit: deploy.deployedCommit,
    textOverlay: finished.textOverlay,
    checks,
  }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
