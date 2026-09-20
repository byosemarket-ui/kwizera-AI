#!/usr/bin/env node
/**
 * Live Admin Control Center probe against a running KWIZERA instance.
 * Usage: node scripts/verify-admin-control-center-live.mjs [baseUrl]
 */
const base = (process.argv[2] || process.env.KWIZERA_LIVE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

async function check(pathname, opts = {}) {
  const res = await fetch(`${base}${pathname}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, text, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecrets(payload, label) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  assert(!/sk-[A-Za-z0-9]{8,}/.test(raw), `${label} leaked sk- credential`);
  assert(!/BEGIN (OPENSSH|RSA|EC) PRIVATE KEY/.test(raw), `${label} leaked private key`);
  assert(!/"credentialReference"\s*:/.test(raw), `${label} returned credentialReference`);
}

const results = [];

try {
  const health = await check("/api/health");
  assert(health.status === 200, `health status ${health.status}`);
  results.push("PASS  /api/health");

  const adminHealth = await check("/api/admin/health");
  assert(adminHealth.status === 200 && adminHealth.json?.ok, "admin health");
  assert(adminHealth.json?.initialized === true, "admin health initialized");
  results.push("PASS  /api/admin/health");

  for (const path of [
    "/api/admin/dashboard",
    "/api/admin/models",
    "/api/admin/providers",
    "/api/admin/features",
    "/api/admin/settings",
    "/api/admin/usage",
  ]) {
    const res = await check(path);
    assert(res.status === 200, `${path} status ${res.status}`);
    assert(res.json?.ok === true, `${path} missing ok:true`);
    assertNoSecrets(res.json, path);
    results.push(`PASS  ${path}`);
  }

  const dashboard = (await check("/api/admin/dashboard")).json;
  assert(dashboard.system, "dashboard.system");
  assert(dashboard.cost?.today === "Not available yet" || typeof dashboard.cost?.today === "string", "truthful cost empty state");
  results.push("PASS  dashboard empty-cost contract");

  const providers = (await check("/api/admin/providers")).json;
  for (const item of providers.items ?? []) {
    assert(item.credentialReference === undefined, `provider ${item.id} leaked credentialReference`);
    if (item.hasCredential) {
      assert(typeof item.credentialMasked === "string" && !item.credentialMasked.includes("sk-"), "masked credential");
    }
  }
  results.push("PASS  provider secret masking");

  const resolved = await check("/api/admin/features/resolve/LLM_CHAT");
  assert(resolved.status === 200, `resolve status ${resolved.status}`);
  assert(["READY", "FALLBACK", "UNAVAILABLE"].includes(resolved.json?.status), "resolve status enum");
  assertNoSecrets(resolved.json, "resolve");
  results.push("PASS  /api/admin/features/resolve/LLM_CHAT");

  for (const path of ["/admin", "/admin/dashboard", "/admin/models", "/admin/providers", "/admin/features", "/admin/settings", "/admin/system"]) {
    const page = await check(path);
    assert(page.status === 200, `${path} status ${page.status}`);
    assert(page.text.includes("KWIZERA AI STUDIO"), `${path} missing studio title`);
    assert(!page.text.includes("Dev Dashboard"), `${path} served legacy dashboard`);
    results.push(`PASS  ${path} studio HTML`);
  }

  for (const line of results) console.log(line);
  console.log(`PASS  admin live verification against ${base}`);
} catch (error) {
  for (const line of results) console.log(line);
  console.error("FAIL ", error instanceof Error ? error.message : error);
  process.exit(1);
}
