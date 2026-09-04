#!/usr/bin/env node
/**
 * Live STEP 5 — product image upload, dedupe, project isolation.
 */
const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function api(pathname, { method = "GET", body, retries = 10 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const res = await fetch(`${BASE}${pathname}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (res.ok) return { status: res.status, json };
    last = new Error(`${method} ${pathname} -> ${res.status}: ${text.slice(0, 300)}`);
    if (res.status === 503 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 2500 + attempt * 1500));
      continue;
    }
    throw last;
  }
  throw last;
}

async function main() {
  const checks = [];
  const pass = (n, d) => { checks.push({ n, ok: true, d }); console.log(`PASS ${n}: ${d}`); };
  const fail = (n, d) => { checks.push({ n, ok: false, d }); console.error(`FAIL ${n}: ${d}`); };

  const health = await api("/api/health");
  pass("health", health.json.status || "ok");

  const deploy = await api("/api/deployment");
  const commit = String(deploy.json.deployedCommit || "").slice(0, 7);
  if (EXPECTED && commit !== EXPECTED) fail("deploy-commit", `got ${commit} expected ${EXPECTED}`);
  else pass("deploy-commit", `${commit} verified=${deploy.json.verifiedLive}`);

  const a = await api("/api/workspace/projects", { method: "POST", body: { name: `STEP5-A-${Date.now()}` } });
  const b = await api("/api/workspace/projects", { method: "POST", body: { name: `STEP5-B-${Date.now()}` } });
  const projectA = a.json.project?.id;
  const projectB = b.json.project?.id;
  if (!projectA || !projectB) throw new Error("project create failed");
  pass("projects", `${projectA} / ${projectB}`);

  const up1 = await api(`/api/workspace/projects/${projectA}/images`, {
    method: "POST",
    body: { fileName: "lamp.png", mimeType: "image/png", dataBase64: PNG },
  });
  const img1 = up1.json.image;
  if (!img1?.id || !img1.checksumSha256) fail("upload-first", JSON.stringify(up1.json).slice(0, 200));
  else pass("upload-first", `${img1.id} checksum=${String(img1.checksumSha256).slice(0, 12)}… status=${up1.status}`);

  const up2 = await api(`/api/workspace/projects/${projectA}/images`, {
    method: "POST",
    body: { fileName: "lamp-copy.png", mimeType: "image/png", dataBase64: PNG },
  });
  if (up2.json.image?.id !== img1.id || !up2.json.reused) {
    fail("dedupe-same-project", `id=${up2.json.image?.id} reused=${up2.json.reused}`);
  } else pass("dedupe-same-project", `reused ${img1.id} http=${up2.status}`);

  const projA = await api(`/api/workspace/projects/${projectA}`);
  const originalsA = (projA.json.project?.productImages ?? projA.json.productImages ?? [])
    .filter((i) => !i.parentAssetId && i.origin !== "derived");
  if (originalsA.length !== 1) fail("no-uncontrolled-dupes", `count=${originalsA.length}`);
  else pass("no-uncontrolled-dupes", `originals=${originalsA.length}`);

  const upB = await api(`/api/workspace/projects/${projectB}/images`, {
    method: "POST",
    body: { fileName: "lamp.png", mimeType: "image/png", dataBase64: PNG },
  });
  if (upB.json.image?.id === img1.id) fail("cross-project-isolation", "shared asset id");
  else pass("cross-project-isolation", `B=${upB.json.image?.id}`);

  const restore = await api(`/api/workspace/projects/${projectA}`);
  const restored = (restore.json.project?.productImages ?? restore.json.productImages ?? [])
    .some((i) => i.id === img1.id);
  if (!restored) fail("persist-restore", "missing asset after reload");
  else pass("persist-restore", img1.id);

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, commit, projectA, checks }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
