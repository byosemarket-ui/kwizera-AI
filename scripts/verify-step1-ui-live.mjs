#!/usr/bin/env node
/** Visual verification for Step 1 Product Setup on live production. */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://162.35.114.19:5173/";
const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

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
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1500);

let workspace = await page.locator("#workspace-main").getAttribute("data-workspace");
if (workspace !== "new-project") {
  const productSetup = page.locator(".nav-item").filter({ hasText: "Product Setup" }).first();
  if (await productSetup.count()) {
    await productSetup.click({ noWaitAfter: true });
    await page.waitForTimeout(2000);
    workspace = await page.locator("#workspace-main").getAttribute("data-workspace");
  }
}

const project = page.getByText("Chestnut Oxford").first();
if (await project.count()) {
  await project.click({ noWaitAfter: true });
  await page.waitForTimeout(2000);
}

const metrics = await page.evaluate(() => {
  const root = document.querySelector(".product-setup");
  const footer = document.querySelector(".product-setup__footer");
  const stepLabel = document.querySelector(".kw-workflow-progress__step-label")?.textContent ?? "";
  const inputBg = root?.querySelector("input") ? getComputedStyle(root.querySelector("input")).backgroundColor : "";
  const ddColor = root?.querySelector(".product-setup__summary-grid dd") ? getComputedStyle(root.querySelector(".product-setup__summary-grid dd")).color : "";
  const toolbarBtns = Array.from(document.querySelectorAll(".quick-action-btn span")).map((s) => s.textContent?.trim()).filter(Boolean);
  const footerRect = footer?.getBoundingClientRect();
  const canvas = document.querySelector(".production-main-panel");
  const canvasRect = canvas?.getBoundingClientRect();
  return {
    workspace: document.querySelector("#workspace-main")?.getAttribute("data-workspace"),
    hasSetup: Boolean(root),
    stepLabel,
    inputBg,
    ddColor,
    toolbarBtns,
    footerH: footer ? Math.round(footerRect.height) : 0,
    footerSticky: footer ? getComputedStyle(footer).position : "",
    continueText: footer?.querySelector(".product-setup__continue")?.textContent?.trim() ?? "",
    summaryVisible: Boolean(root?.querySelector(".product-setup__summary-grid dd")?.textContent?.trim()),
    gridCards: root?.querySelectorAll(".product-setup__card").length ?? 0,
    canvasBottom: canvasRect ? canvasRect.bottom : 0,
    footerTop: footerRect ? footerRect.top : 0,
  };
});

await page.screenshot({ path: "step1-ui-verified.png", fullPage: true });

record("Step 1 workspace open", metrics.workspace === "new-project", metrics.workspace ?? "missing");
record("Product setup root rendered", metrics.hasSetup, "");
record("3-step progress indicator", /STEP 1 OF 3/i.test(metrics.stepLabel), metrics.stepLabel);
record("Dark integrated inputs", !/rgb\(255, 255, 255\)/i.test(metrics.inputBg), metrics.inputBg);
record("Summary values readable", metrics.summaryVisible, metrics.ddColor);
record("Compact sticky footer", metrics.footerH > 0 && metrics.footerH <= 72, `h=${metrics.footerH}, pos=${metrics.footerSticky}`);
record("Continue action label", /Continue to Video Plan/i.test(metrics.continueText), metrics.continueText);
record("Toolbar filtered for Step 1", metrics.toolbarBtns.length <= 4, metrics.toolbarBtns.join(", "));
record("Image cards present", metrics.gridCards >= 1, String(metrics.gridCards));
record("No critical console errors", errors.filter((e) => !/favicon/i.test(e)).length === 0, errors.slice(0, 2).join(" | "));

const failed = results.filter((r) => !r.pass).length;
console.log(`\n--- ${results.length - failed}/${results.length} passed ---`);
await browser.close();
process.exit(failed ? 1 : 0);
