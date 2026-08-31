#!/usr/bin/env node
/**
 * Live verification: Step 1 Product Images upload via browser file picker + API persistence.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://162.35.114.19:5173/";
const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function launch() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* next */
    }
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

function writeTestPngs(dir) {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
    "base64",
  );
  const files = [];
  for (let i = 1; i <= 2; i += 1) {
    const p = path.join(dir, `upload-test-${i}.png`);
    fs.writeFileSync(p, png);
    files.push(p);
  }
  return files;
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-upload-test-"));
const testFiles = writeTestPngs(tmpDir);

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];

page.on("pageerror", (err) => pageErrors.push(err.message));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("#workspace-main", { timeout: 60000 });
  await page.waitForTimeout(1500);
  record("App shell mounted", true);

  await openProductSetup(page);
  await page.waitForSelector(".product-setup", { timeout: 30000 });
  record("Step 1 Product Setup visible", true);

  const stamp = `Upload Test ${Date.now()}`;
  await page.locator("#ps-project-name").fill(stamp);
  await page.locator("#ps-product-name").fill(`${stamp} Product`);

  const cardsBefore = await page.locator(".product-setup__card").count();

  const selectBtn = page.locator(".product-setup__drop-actions button").filter({ hasText: /Select Images/i });
  await selectBtn.waitFor({ state: "visible", timeout: 15000 });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    selectBtn.click(),
  ]);
  await fileChooser.setFiles(testFiles);
  record("File picker accepted test images", true, testFiles.map((f) => path.basename(f)).join(", "));

  let uploaded = 0;
  for (let i = 0; i < 60; i += 1) {
    uploaded = await page.locator(".product-setup__card").count();
    const uploading = await page.locator(".product-setup__card.is-uploading").count();
    const progress = await page.locator(".product-setup__upload-progress").count();
    if (uploaded >= cardsBefore + testFiles.length && uploading === 0 && progress === 0) break;
    await page.waitForTimeout(1000);
  }

  const finalCards = await page.locator(".product-setup__card").count();
  const savedCards = await page.locator(".product-setup__card:not(.is-uploading):not(.is-failed)").count();
  record(
    "Image cards appear after upload",
    finalCards >= cardsBefore + testFiles.length,
    `before=${cardsBefore} after=${finalCards}`,
  );
  record("Upload finished without stuck uploading state", (await page.locator(".product-setup__card.is-uploading").count()) === 0);
  record("At least one saved thumbnail visible", savedCards >= cardsBefore + 1, String(savedCards));

  const thumbSrc = await page.locator(".product-setup__card-thumb img").first().getAttribute("src").catch(() => null);
  record("Thumbnail has image src", Boolean(thumbSrc && thumbSrc.length > 4), thumbSrc?.slice(0, 80) ?? "none");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".product-setup", { timeout: 30000 });
  await page.waitForTimeout(2500);

  const afterRefresh = await page.locator(".product-setup__card").count();
  record("Images persist after browser refresh", afterRefresh >= cardsBefore + 1, String(afterRefresh));

  await page.screenshot({ path: "step1-upload-verified.png", fullPage: true });
  record("No page errors during upload flow", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
} catch (error) {
  record("Upload verification run", false, error instanceof Error ? error.message : String(error));
  await page.screenshot({ path: "step1-upload-failed.png", fullPage: true }).catch(() => null);
} finally {
  await browser.close();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

const failed = checks.filter((c) => !c.ok).length;
console.log(`\n--- ${checks.length - failed}/${checks.length} passed ---`);
process.exit(failed ? 1 : 0);
