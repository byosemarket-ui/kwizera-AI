#!/usr/bin/env node
/**
 * Post-restart live checks against the production gateway.
 * BASE_URL defaults to http://127.0.0.1:5173
 */
const base = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

async function get(pathname) {
  const res = await fetch(`${base}${pathname}`, { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  return { status: res.status, text };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const healthRes = await get("/api/health");
const health = parseJson(healthRes.text);
if (healthRes.status !== 200 || !health || health.ok !== true || health.status !== "healthy" || health.runtimeReady !== true) {
  console.error("FAIL  /api/health", healthRes.status, healthRes.text.slice(0, 400));
  process.exit(1);
}
console.log("PASS  /api/health runtimeReady=true");

async function assertStudio(pathname) {
  const { status, text } = await get(pathname);
  if (status !== 200) {
    console.error(`FAIL  ${pathname} status ${status}`);
    process.exit(1);
  }
  if (/Dev Dashboard/i.test(text)) {
    console.error(`FAIL  ${pathname} served the legacy Dev Dashboard`);
    process.exit(1);
  }
  if (!/KWIZERA AI STUDIO/i.test(text)) {
    console.error(`FAIL  ${pathname} missing KWIZERA AI STUDIO title`);
    process.exit(1);
  }
  console.log(`PASS  ${pathname} professional studio`);
}

await assertStudio("/");
await assertStudio("/desktop/");

const legacy = await get("/dev");
if (legacy.status !== 200 || !/Dev Dashboard/i.test(legacy.text)) {
  console.error("FAIL  /dev is not the legacy Dev Dashboard");
  process.exit(1);
}
console.log("PASS  /dev legacy Dev Dashboard");

const deployRes = await get("/api/deployment");
const deploy = parseJson(deployRes.text);
if (deployRes.status !== 200 || !deploy || typeof deploy.status !== "string") {
  console.error("FAIL  /api/deployment", deployRes.status, deployRes.text.slice(0, 400));
  process.exit(1);
}
if (deploy.verifiedLive === true && (deploy.status !== "live" || deploy.result !== "success")) {
  console.error("FAIL  /api/deployment claimed verifiedLive without live+success");
  process.exit(1);
}
console.log("PASS  /api/deployment", deploy.status, deploy.deployedCommit ?? "");
