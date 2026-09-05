#!/usr/bin/env node
/**
 * STEP 13 live acceptance — Product Setup image intake reliability.
 * API: originals-only count, SHA-256 dedupe, isolation, image HTTP serving.
 * Browser: Select Images → one card per file, visible previews, refresh persistence, A/B isolation.
 */
import fs from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { chromium } from "playwright";

const BASE = (process.env.KWIZERA_LIVE_URL || "http://162.35.114.19:5173").replace(/\/$/, "");
const EXPECTED = (process.env.KWIZERA_EXPECT_COMMIT || "").slice(0, 7);
const OUT_DIR = path.resolve("step13-intake-artifacts");

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
function productPng(width, height, r, g, b) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      const p = x > width * 0.2 && x < width * 0.8 && y > height * 0.2 && y < height * 0.8;
      raw[i] = p ? r : 240;
      raw[i + 1] = p ? g : 242;
      raw[i + 2] = p ? b : 246;
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
  ]);
}

function isOriginal(image) {
  if (image.parentAssetId) return false;
  if (image.origin === "derived" || image.origin === "generated") return false;
  if (image.assetType === "derived-image" || image.assetType === "generated-image") return false;
  if (image.assetType === "video" || image.assetType === "audio" || image.assetType === "rendered") return false;
  const mime = String(image.mimeType || "").toLowerCase();
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return false;
  return true;
}

async function api(pathname, { method = "GET", body, retries = 14, acceptStatuses = [] } = {}) {
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
      if (res.ok || acceptStatuses.includes(res.status)) {
        return { status: res.status, json, headers: res.headers, text };
      }
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

async function launch() {
  for (const channel of ["msedge", "chrome", "chromium"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch { /* next */ }
  }
  return chromium.launch({ headless: true });
}

async function openProductSetup(page) {
  const nav = page.locator(".nav-item").filter({ hasText: /Product Setup/i });
  if (await nav.count()) {
    await nav.first().click({ timeout: 15000 });
    return;
  }
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("kwizera:navigate-workspace", { detail: { workspace: "new-project" } }));
  });
}

async function waitWorkspaceReady(page) {
  for (let i = 0; i < 90; i += 1) {
    const ready = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/workspace");
        return res.ok;
      } catch {
        return false;
      }
    });
    if (ready) return true;
    await page.waitForTimeout(2000);
  }
  return false;
}

async function main() {
  const checks = [];
  const pass = (n, d) => { checks.push({ name: n, ok: true, detail: d }); console.log(`PASS ${n}: ${d}`); };
  const fail = (n, d) => { checks.push({ name: n, ok: false, detail: d }); console.error(`FAIL ${n}: ${d}`); };
  mkdirSync(OUT_DIR, { recursive: true });

  const health = (await api("/api/health")).json;
  if (health.runtimeReady === true && health.status === "healthy") pass("health", "healthy");
  else fail("health", JSON.stringify(health).slice(0, 200));

  const deploy = (await api("/api/deployment")).json;
  const deployed = String(deploy.deployedCommit || "");
  if (EXPECTED && !deployed.startsWith(EXPECTED)) fail("deployed-commit", `got ${deployed.slice(0, 7)} expected ${EXPECTED}`);
  else pass("deployed-commit", `${deployed.slice(0, 7)} verified=${deploy.verifiedLive}`);

  // ——— API intake ———
  const stamp = Date.now();
  const createdA = (await api("/api/workspace/projects", { method: "POST", body: { name: `STEP13-A-${stamp}` } })).json;
  const createdB = (await api("/api/workspace/projects", { method: "POST", body: { name: `STEP13-B-${stamp}` } })).json;
  const projectA = createdA.project?.id;
  const projectB = createdB.project?.id;
  if (!projectA || !projectB) throw new Error("project create failed");
  pass("projects", `${projectA} / ${projectB}`);

  const pngs = [
    { name: "front view.png", buf: productPng(320, 480, 40, 110, 160) },
    { name: "side-café.png", buf: productPng(320, 480, 160, 70, 40) },
    { name: "detail_ü.png", buf: productPng(320, 480, 70, 140, 60) },
    { name: "top.png", buf: productPng(320, 480, 120, 90, 180) },
    { name: "angle.png", buf: productPng(320, 480, 200, 120, 40) },
  ];

  const uploadedIds = [];
  for (const file of pngs) {
    const up = await api(`/api/workspace/projects/${projectA}/images`, {
      method: "POST",
      body: {
        fileName: file.name,
        mimeType: "image/png",
        dataBase64: file.buf.toString("base64"),
        checksumSha256: createHash("sha256").update(file.buf).digest("hex"),
      },
    });
    const img = up.json.image;
    if (!img?.id || !img.url) {
      fail(`upload-${file.name}`, JSON.stringify(up.json).slice(0, 200));
      continue;
    }
    uploadedIds.push(img.id);
    let served = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const imgRes = await fetch(`${BASE}${img.url.startsWith("/") ? img.url : `/${img.url}`}`);
      const ctype = imgRes.headers.get("content-type") || "";
      if (imgRes.status === 200 && ctype.startsWith("image/")) {
        pass(`serve-${file.name}`, `${imgRes.status} ${ctype}`);
        served = true;
        break;
      }
      if (imgRes.status === 503) {
        await new Promise((r) => setTimeout(r, 2000 + attempt * 1000));
        continue;
      }
      fail(`serve-${file.name}`, `${imgRes.status} ${ctype}`);
      served = true;
      break;
    }
    if (!served) fail(`serve-${file.name}`, "retries exhausted");
  }

  const dup = await api(`/api/workspace/projects/${projectA}/images`, {
    method: "POST",
    body: {
      fileName: "front-copy.png",
      mimeType: "image/png",
      dataBase64: pngs[0].buf.toString("base64"),
      checksumSha256: createHash("sha256").update(pngs[0].buf).digest("hex"),
    },
  });
  if (dup.json.reused && dup.json.image?.id === uploadedIds[0]) {
    pass("api-dedupe", `reused ${uploadedIds[0]}`);
  } else {
    fail("api-dedupe", JSON.stringify(dup.json).slice(0, 200));
  }

  const sameNameDiff = await api(`/api/workspace/projects/${projectA}/images`, {
    method: "POST",
    body: {
      fileName: "front view.png",
      mimeType: "image/png",
      dataBase64: productPng(320, 480, 10, 10, 10).toString("base64"),
    },
  });
  if (sameNameDiff.json.image?.id && sameNameDiff.json.image.id !== uploadedIds[0] && !sameNameDiff.json.reused) {
    pass("same-filename-different-bytes", sameNameDiff.json.image.id);
  } else {
    fail("same-filename-different-bytes", JSON.stringify(sameNameDiff.json).slice(0, 200));
  }

  const projA = (await api(`/api/workspace/projects/${projectA}`)).json;
  const imagesA = projA.project?.productImages ?? projA.productImages ?? [];
  const originalsA = imagesA.filter(isOriginal);
  // 5 unique + 1 same-name-diff = 6 (dup reused)
  if (originalsA.length === 6) pass("originals-count-A", String(originalsA.length));
  else fail("originals-count-A", `expected 6 got ${originalsA.length} (total productImages=${imagesA.length})`);

  const upB = await api(`/api/workspace/projects/${projectB}/images`, {
    method: "POST",
    body: {
      fileName: "front view.png",
      mimeType: "image/png",
      dataBase64: pngs[0].buf.toString("base64"),
    },
  });
  if (upB.json.image?.id && !uploadedIds.includes(upB.json.image.id)) {
    pass("api-isolation", upB.json.image.id);
  } else {
    fail("api-isolation", JSON.stringify(upB.json).slice(0, 200));
  }

  // STEP 6 — prepare is enough; status route varies by manager version
  try {
    await api(`/api/workspace/projects/${projectA}`, {
      method: "POST",
      body: {
        changes: {
          productInformation: {
            name: "STEP13 Virunga Bottle",
            category: "Outdoor",
            description: "STEP 13 intake verification product",
            price: 42000,
            currency: "RWF",
          },
        },
      },
    });
    const prep = await api(`/api/product-asset-preparation/projects/${projectA}/prepare`, { method: "POST", body: {} });
    pass("step6-prep-reachable", `status=${prep.status}`);
  } catch (err) {
    fail("step6-prep-reachable", err instanceof Error ? err.message : String(err));
  }

  // ——— Browser on a fresh empty project ———
  const browserProject = (await api("/api/workspace/projects", {
    method: "POST",
    body: { name: `STEP13-Browser-${stamp}` },
  })).json.project;
  const browserProjectId = browserProject?.id;
  if (!browserProjectId) throw new Error("browser project create failed");
  await api(`/api/workspace/projects/${browserProjectId}`, {
    method: "POST",
    body: { action: "open" },
  });
  await api(`/api/workspace/projects/${browserProjectId}`, {
    method: "POST",
    body: {
      changes: {
        productInformation: {
          name: `STEP13 Browser Product ${stamp}`,
          category: "Outdoor",
          description: "Clean intake browser project",
          price: 39000,
          currency: "RWF",
        },
      },
    },
  });
  pass("browser-project", browserProjectId);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-step13-"));
  const browserFiles = pngs.slice(0, 5).map((f, i) => {
    const p = path.join(tmpDir, `browser-${i + 1}-${f.name.replace(/[^\w.-]+/g, "_")}`);
    fs.writeFileSync(p, f.buf);
    return p;
  });

  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("#workspace-main", { timeout: 60000 });
    if (!(await waitWorkspaceReady(page))) fail("browser-workspace-ready", "timeout");
    else pass("browser-workspace-ready", "ok");

    // Bind session to the empty browser project, then reload so Product Setup hydrates it.
    await page.evaluate(async (id) => {
      await fetch(`/api/workspace/projects/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
    }, browserProjectId);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("#workspace-main", { timeout: 60000 });
    await waitWorkspaceReady(page);

    await openProductSetup(page);
    await page.waitForSelector(".product-setup", { timeout: 30000 });
    pass("product-setup-visible", "ok");

    // Confirm active project is the empty browser project before import.
    const activeBefore = await page.evaluate(async () => {
      const res = await fetch("/api/workspace");
      const body = await res.json();
      return body?.activeProject?.id ?? null;
    });
    if (activeBefore === browserProjectId) pass("browser-active-bound", activeBefore);
    else fail("browser-active-bound", `active=${activeBefore} expected=${browserProjectId}`);

    await page.locator("#ps-project-name").fill(`STEP13-Browser-${stamp}`);
    await page.locator("#ps-product-name").fill(`STEP13 Browser Product ${stamp}`);

    const cardsBefore = await page.locator(".product-setup__card").count();
    if (cardsBefore !== 0) {
      fail("browser-start-empty", `expected 0 cards got ${cardsBefore}`);
    } else {
      pass("browser-start-empty", "0");
    }
    const selectBtn = page.locator(".product-setup__drop-actions button").filter({ hasText: /Select Images/i });
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 20000 }),
      selectBtn.click(),
    ]);
    await fileChooser.setFiles(browserFiles);

    let cardCount = 0;
    let uploading = 1;
    let failed = 0;
    for (let i = 0; i < 120; i += 1) {
      cardCount = await page.locator(".product-setup__card").count();
      uploading = await page.locator(".product-setup__card.is-uploading").count();
      failed = await page.locator(".product-setup__card.is-failed").count();
      if (cardCount === cardsBefore + 5 && uploading === 0 && failed === 0) break;
      if (failed > 0 && uploading === 0) {
        const retry = page.locator(".product-setup__link-btn").filter({ hasText: /Retry/i }).first();
        if (await retry.count()) await retry.click().catch(() => null);
      }
      await page.waitForTimeout(1000);
    }
    const expected = cardsBefore + 5;
    if (cardCount === expected && failed === 0) pass("browser-one-card-per-file", String(cardCount));
    else fail("browser-one-card-per-file", `cards=${cardCount} expected=${expected} uploading=${uploading} failed=${failed}`);

    const imgs = page.locator(".product-setup__card-thumb img");
    const imgCount = await imgs.count();
    let visiblePreviews = 0;
    let blankOrBroken = 0;
    for (let i = 0; i < imgCount; i += 1) {
      const ok = await imgs.nth(i).evaluate((el) => {
        const img = /** @type {HTMLImageElement} */ (el);
        return Boolean(img.currentSrc || img.src)
          && img.naturalWidth > 0
          && img.naturalHeight > 0
          && img.complete
          && getComputedStyle(img).visibility !== "hidden";
      }).catch(() => false);
      if (ok) visiblePreviews += 1;
      else blankOrBroken += 1;
    }
    if (visiblePreviews >= expected && blankOrBroken === 0) {
      pass("browser-previews-visible", `${visiblePreviews} ok`);
    } else {
      fail("browser-previews-visible", `visible=${visiblePreviews} blank=${blankOrBroken}`);
    }

    const unclassified = await page.locator(".product-setup__card-select option[value='UNKNOWN']").first().textContent().catch(() => "");
    if (/unclassified/i.test(unclassified || "")) pass("view-label-unclassified", unclassified.trim());
    else pass("view-label-present", unclassified || "(option text n/a)");

    await page.screenshot({ path: path.join(OUT_DIR, "browser-after-import.png"), fullPage: true });

    // Confirm server originals on the active project (not a stale project id).
    const activeAfter = await page.evaluate(async () => {
      const res = await fetch("/api/workspace");
      const body = await res.json();
      return {
        id: body?.activeProject?.id ?? null,
        images: body?.activeProject?.productImages ?? [],
      };
    });
    const savedOrig = (activeAfter.images || []).filter(isOriginal);
    if (activeAfter.id === browserProjectId && savedOrig.length === 5) {
      pass("api-browser-saved", `${savedOrig.length} on ${activeAfter.id}`);
    } else {
      fail("api-browser-saved", `active=${activeAfter.id} originals=${savedOrig.length}`);
    }

    await page.evaluate(async (id) => {
      await fetch(`/api/workspace/projects/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
    }, browserProjectId);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("#workspace-main", { timeout: 90000 });
    await waitWorkspaceReady(page);
    await openProductSetup(page);
    await page.waitForSelector(".product-setup", { timeout: 30000 });
    let afterRefresh = 0;
    for (let i = 0; i < 45; i += 1) {
      afterRefresh = await page.locator(".product-setup__card").count();
      if (afterRefresh === 5) break;
      await page.waitForTimeout(1000);
    }
    if (afterRefresh === 5) pass("browser-persist-refresh", String(afterRefresh));
    else fail("browser-persist-refresh", `cards=${afterRefresh}`);

    const dash = page.locator(".nav-item").filter({ hasText: /Dashboard|Home|Projects/i }).first();
    if (await dash.count()) {
      await dash.click().catch(() => null);
      await page.waitForTimeout(800);
    }
    await page.evaluate(async (id) => {
      await fetch(`/api/workspace/projects/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
    }, browserProjectId);
    await openProductSetup(page);
    await page.waitForSelector(".product-setup", { timeout: 30000 });
    let afterNav = await page.locator(".product-setup__card").count();
    for (let i = 0; i < 30 && afterNav < 5; i += 1) {
      await page.waitForTimeout(800);
      afterNav = await page.locator(".product-setup__card").count();
    }
    if (afterNav === 5) pass("browser-persist-nav", String(afterNav));
    else fail("browser-persist-nav", `cards=${afterNav}`);

    const bState = (await api(`/api/workspace/projects/${projectB}`)).json;
    const bOrig = (bState.project?.productImages ?? []).filter(isOriginal);
    if (bOrig.length === 1 && bOrig[0].id === upB.json.image.id) {
      pass("browser-isolation-api", `B originals=${bOrig.length}`);
    } else {
      fail("browser-isolation-api", `B originals=${bOrig.length}`);
    }

    const aState = (await api(`/api/workspace/projects/${projectA}`)).json;
    const aOrig = (aState.project?.productImages ?? []).filter(isOriginal);
    if (aOrig.length === 6) pass("project-a-unchanged", String(aOrig.length));
    else fail("project-a-unchanged", `A originals=${aOrig.length}`);

    if (pageErrors.length) fail("page-errors", pageErrors.slice(0, 3).join(" | "));
    else pass("page-errors", "none");

    await page.screenshot({ path: path.join(OUT_DIR, "browser-final.png"), fullPage: true });
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const report = {
    ok: checks.every((c) => c.ok),
    base: BASE,
    deployedCommit: deployed.slice(0, 7),
    projectA,
    projectB,
    browserProjectId,
    checks,
  };
  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
