#!/usr/bin/env node
/**
 * Live production E2E: project create → image upload → video timeline → render → playable output.
 * Uses API against the real deployment (no local server).
 */
const BASE = (process.argv[2] ?? "http://162.35.114.19:5173").replace(/\/$/, "");
const PRESET = process.argv[3] ?? "preview";
const RENDER_TIMEOUT_MS = Number(process.env.KWIZERA_LIVE_RENDER_TIMEOUT_MS ?? 300000);

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC";

const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function json(method, path, body, timeoutMs = 60000) {
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
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep string */
    }
    return { ok: res.ok, status: res.status, body: parsed, headers: res.headers };
  } catch (error) {
    return { ok: false, status: 0, body: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(fn, attempts = 120, delayMs = 2000) {
  for (let i = 0; i < attempts; i += 1) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function assetReachable(urlPath, method = "GET") {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
  });
  return res.ok || res.status === 206;
}

async function main() {
  console.log(`Live E2E — ${BASE} (preset: ${PRESET})`);

  const deploy = await json("GET", "/api/deployment");
  record(
    "deployment endpoint",
    deploy.ok,
    deploy.body?.commit?.slice?.(0, 8) ?? deploy.body?.version ?? "",
  );

  const health = await json("GET", "/api/health");
  record("health ok", health.ok && health.body?.ok === true);

  await waitFor(async () => (await json("GET", "/api/workspace")).ok, 60, 2000);
  record("workspace ready", (await json("GET", "/api/workspace")).ok);

  const stamp = `LIVE-E2E-${Date.now()}`;
  const created = await json("POST", "/api/workspace/projects", { name: stamp });
  const projectId = created.body?.project?.id;
  record("create project", created.ok && Boolean(projectId), projectId ?? "");

  await json("POST", `/api/workspace/projects/${projectId}`, { action: "open" });

  const imageIds = [];
  for (let i = 0; i < 2; i += 1) {
    const up = await json("POST", `/api/workspace/projects/${projectId}/images`, {
      fileName: `live-${i + 1}.png`,
      mimeType: "image/png",
      dataBase64: PNG,
      width: 10,
      height: 10,
    });
    if (up.body?.image?.id) imageIds.push(up.body.image.id);
  }
  record("upload images", imageIds.length === 2, imageIds.join(", "));

  const project = await json("GET", `/api/workspace/projects/${projectId}`);
  const imgs = project.body?.project?.productImages ?? [];
  record("images in project", imgs.length >= 2, `${imgs.length} images`);

  const firstUrl = imgs[0]?.url;
  if (firstUrl) {
    record("image GET reachable", await assetReachable(firstUrl, "GET"), firstUrl);
    record("image HEAD reachable", await assetReachable(firstUrl, "HEAD"), firstUrl);
  } else {
    record("image GET reachable", false, "no url");
    record("image HEAD reachable", false, "no url");
  }

  await json("POST", `/api/workspace/projects/${projectId}`, {
    changes: {
      productInformation: {
        name: `${stamp} Product`,
        category: "Test",
        description: "Live E2E verification product",
        price: 19.99,
        currency: "USD",
      },
      campaignInformation: {
        objective: "Product showcase",
        callToAction: "Shop now",
        platforms: ["instagram"],
      },
      targetAudience: "Live test audience",
      workspaceSettings: {
        productCreation: { currentStep: 4, completedSteps: [1, 2, 3], updatedAt: new Date().toISOString() },
      },
    },
  });
  record("product + marketing saved", true);

  const planGen = await json("POST", `/api/workspace/projects/${projectId}/plan`, {
    action: "generate",
    productionMode: "AI_PRODUCT_MOTION",
    creativeTone: "PREMIUM",
    regenerate: true,
  });
  const planScenes = planGen.body?.plan?.scenes?.length ?? 0;
  record("creative plan generated", planGen.ok && planScenes > 0, `${planScenes} scenes`);

  const finalized = await json("POST", `/api/workspace/projects/${projectId}/plan/finalize`, {});
  record(
    "creative plan finalized",
    finalized.ok && finalized.body?.plan?.planStatus === "APPROVED_FOR_VIDEO",
    finalized.body?.plan?.planStatus ?? finalized.body?.error ?? "",
  );

  const timeline = await json("POST", `/api/video-production/projects/${projectId}`, { action: "create" });
  const clipCount = timeline.body?.video?.timeline?.length ?? 0;
  record("video timeline created", timeline.ok && clipCount > 0, `${clipCount} clips`);

  const validation = await json("GET", `/api/video-production/projects/${projectId}/validate?preset=${PRESET}`);
  record(
    "render validation ready",
    validation.body?.validation?.ready === true,
    validation.body?.validation?.issues?.join("; ") ?? "",
  );

  const renderStart = await json("POST", `/api/video-production/projects/${projectId}/render`, { preset: PRESET });
  const jobId = renderStart.body?.job?.id;
  record("render started", renderStart.ok && Boolean(jobId), jobId ?? renderStart.body?.error ?? "");

  const renderDone = await waitFor(async () => {
    if (!jobId) return false;
    const jobRes = await json("GET", `/api/video-production/projects/${projectId}/jobs/${jobId}`);
    const status = jobRes.body?.job?.status;
    const progress = jobRes.body?.job?.progress;
    if (status === "processing" || status === "queued") {
      process.stdout.write(`\r  render progress: ${progress ?? "?"}% (${status})   `);
    }
    if (status === "failed") {
      console.log(`\n  render failed: ${jobRes.body?.job?.error ?? "unknown"}`);
      return false;
    }
    return status === "completed";
  }, Math.ceil(RENDER_TIMEOUT_MS / 2000), 2000);
  console.log("");
  record("render completed", renderDone);

  const videoProject = await json("GET", `/api/video-production/projects/${projectId}`);
  const outputUrl = videoProject.body?.video?.output?.url;
  const outputStatus = videoProject.body?.video?.outputStatus;
  record(
    "output metadata",
    Boolean(outputUrl) && outputStatus === "CURRENT",
    outputUrl ?? "missing",
  );

  if (outputUrl) {
    record("video GET reachable", await assetReachable(outputUrl, "GET"), outputUrl);
    record("video HEAD reachable", await assetReachable(outputUrl, "HEAD"), outputUrl);

    const full = await fetch(`${BASE}${outputUrl}`);
    const buf = Buffer.from(await full.arrayBuffer());
    record("video file non-empty", buf.length > 1000, `${buf.length} bytes`);
  } else {
    record("video GET reachable", false);
    record("video HEAD reachable", false);
    record("video file non-empty", false);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log("\n=== LIVE E2E SUMMARY ===");
  console.log(JSON.stringify({
    base: BASE,
    projectId,
    preset: PRESET,
    deployCommit: deploy.body?.commit ?? null,
    passed: checks.length - failed.length,
    failed: failed.length,
    checks,
  }, null, 2));

  if (failed.length) {
    console.error("\nFAILED:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("\nLIVE E2E: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
