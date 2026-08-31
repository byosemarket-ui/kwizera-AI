#!/usr/bin/env node
/** Reproduce Step 1 → Step 2 navigation crash on live production. */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://162.35.114.19:5173/";

async function launch() {
  for (const channel of ["msedge", "chrome"]) {
    try { return await chromium.launch({ channel, headless: true }); } catch { /* next */ }
  }
  return chromium.launch({ headless: true });
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
const pageErrors = [];

page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (err) => {
  pageErrors.push(err.message + (err.stack ? "\n" + err.stack : ""));
});

await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(2000);

const nav = page.locator(".nav-item").filter({ hasText: "Product Setup" }).first();
if (await nav.count()) {
  await nav.click({ noWaitAfter: true });
  await page.waitForTimeout(2000);
}

// Fill essentials if empty
const productName = page.locator("#ps-product-name");
if (await productName.count()) {
  const val = await productName.inputValue();
  if (!val.trim()) await productName.fill("Chestnut Oxford");
}

const projectName = page.locator("#ps-project-name");
if (await projectName.count()) {
  const val = await projectName.inputValue();
  if (!val.trim()) await projectName.fill("Chestnut Oxford");
}

const continueBtn = page.locator(".product-setup__continue");
await continueBtn.waitFor({ state: "visible", timeout: 30000 });
const disabled = await continueBtn.isDisabled();
console.log("Continue disabled:", disabled);

if (!disabled) {
  await continueBtn.click();
  await page.waitForTimeout(5000);
}

const state = await page.evaluate(() => ({
  workspace: document.querySelector("#workspace-main")?.getAttribute("data-workspace"),
  recovery: document.body.innerText.includes("KWIZERA AI STUDIO — recovery"),
  recoveryMsg: document.querySelector(".startup-recovery-panel, main.startup-recovery-panel")?.textContent?.slice(0, 200),
  step2: document.body.innerText.includes("STEP 2 OF 3") || document.body.innerText.includes("Video Plan") || document.body.innerText.includes("Product Details"),
  vrPage: Boolean(document.querySelector(".vr-page")),
}));

await page.screenshot({ path: "workflow-step2-crash.png", fullPage: true });

console.log(JSON.stringify({ state, pageErrors, consoleErrors: errors.slice(0, 15) }, null, 2));
await browser.close();
process.exit(state.recovery || pageErrors.some((e) => /130|invalid/i.test(e)) ? 1 : 0);
