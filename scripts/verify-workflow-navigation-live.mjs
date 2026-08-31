#!/usr/bin/env node
/** Live browser verification: Step 1 → Step 2 → Step 3 → Step 4 workflow navigation. */
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
      /* try next */
    }
  }
  return chromium.launch({ headless: true });
}

async function openProductSetup(page) {
  const candidates = [
    page.locator(".nav-item").filter({ hasText: /Product Setup/i }),
    page.locator('[data-workspace-nav="new-project"]'),
    page.getByRole("button", { name: /Product Setup/i }),
  ];
  for (const loc of candidates) {
    if (await loc.count()) {
      await loc.first().click({ timeout: 15000 });
      return true;
    }
  }
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("kwizera:navigate-workspace", { detail: { workspace: "new-project" } }));
  });
  return true;
}

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const pageErrors = [];
const consoleErrors = [];

page.on("pageerror", (err) => pageErrors.push(err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("#workspace-main", { timeout: 60000 });
  await page.waitForTimeout(2000);
  record("App shell mounted", true);

  await openProductSetup(page);
  await page.waitForTimeout(2000);
  await page.waitForSelector(".product-setup", { timeout: 30000 }).catch(() => null);
  record("Step 1 workspace visible", (await page.locator(".product-setup").count()) > 0);

  const projectName = page.locator("#ps-project-name");
  if (await projectName.count()) {
    const val = await projectName.inputValue();
    if (!val.trim()) await projectName.fill("Workflow Nav Test");
  }
  const productName = page.locator("#ps-product-name");
  if (await productName.count()) {
    const val = await productName.inputValue();
    if (!val.trim()) await productName.fill("Workflow Nav Test Product");
  }

  const continueBtn = page.locator(".product-setup__continue");
  await continueBtn.waitFor({ state: "visible", timeout: 30000 });
  for (let i = 0; i < 90 && (await continueBtn.isDisabled()); i += 1) {
    await page.waitForTimeout(500);
  }
  const canContinue = !(await continueBtn.isDisabled());
  record("Continue button enabled", canContinue, canContinue ? "" : "Step 1 prerequisites not met on live site");

  if (canContinue) {
    await continueBtn.click();
    let step2 = false;
    for (let i = 0; i < 45; i += 1) {
      const ws = await page.locator("#workspace-main").getAttribute("data-workspace");
      const recovery = await page.locator("text=KWIZERA AI STUDIO — recovery").count();
      const vr = await page.locator(".vr-page").count();
      if (recovery > 0) break;
      if (ws === "video-requirements" && vr > 0) {
        step2 = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    const ws = await page.locator("#workspace-main").getAttribute("data-workspace");
    const recovery = (await page.locator("text=KWIZERA AI STUDIO — recovery").count()) > 0;
    record("No recovery screen after Step 1 → 2", !recovery);
    record("Workspace is video-requirements", ws === "video-requirements", ws ?? "missing");
    record("Step 2 page renders (.vr-page)", step2);
    record("STEP 2 OF 4 visible", (await page.locator("text=STEP 2 OF 4").count()) > 0);
    record("VIDEO PLAN visible", (await page.locator("text=VIDEO PLAN").count()) > 0);

    if (step2) {
      const step3Btn = page.locator(".vr-continue");
      for (let i = 0; i < 30 && (await step3Btn.isDisabled()); i += 1) {
        await page.waitForTimeout(500);
      }
      if (!(await step3Btn.isDisabled())) {
        await step3Btn.click();
        let step3 = false;
        for (let i = 0; i < 30; i += 1) {
          const ws3 = await page.locator("#workspace-main").getAttribute("data-workspace");
          const recovery3 = await page.locator("text=KWIZERA AI STUDIO — recovery").count();
          if (recovery3 > 0) break;
          if (ws3 === "video-style") {
            step3 = true;
            break;
          }
          await page.waitForTimeout(1000);
        }
        record("Step 2 → Step 3 without recovery", !(await page.locator("text=KWIZERA AI STUDIO — recovery").count()));
        record("Workspace is video-style", (await page.locator("#workspace-main").getAttribute("data-workspace")) === "video-style");
        record("Step 3 workspace renders", step3);

        if (step3) {
          const modeCard = page.locator(".vs-mode-card:not(.is-unavailable)").first();
          if (await modeCard.count()) {
            await modeCard.click();
            await page.waitForTimeout(2000);
            record("Step 3 style card selectable", await modeCard.evaluate((el) => el.classList.contains("is-selected")));
          }

          const step4Btn = page.locator(".vs-footer__right .primary");
          for (let i = 0; i < 60 && (await step4Btn.isDisabled()); i += 1) {
            await page.waitForTimeout(1000);
          }
          if (!(await step4Btn.isDisabled())) {
            await step4Btn.click();
            let step4 = false;
            for (let i = 0; i < 45; i += 1) {
              const ws4 = await page.locator("#workspace-main").getAttribute("data-workspace");
              const recovery4 = await page.locator("text=KWIZERA AI STUDIO — recovery").count();
              const fr = await page.locator(".fr-page").count();
              if (recovery4 > 0) break;
              if (ws4 === "final-video-review" && fr > 0) {
                step4 = true;
                break;
              }
              await page.waitForTimeout(1000);
            }
            record("Step 3 → Step 4 without recovery", !(await page.locator("text=KWIZERA AI STUDIO — recovery").count()));
            record("Workspace is final-video-review", (await page.locator("#workspace-main").getAttribute("data-workspace")) === "final-video-review");
            record("Step 4 production UI renders (.fr-page)", step4);
            record("STEP 4 OF 4 or CREATING YOUR VIDEO visible",
              (await page.locator("text=STEP 4 OF 4").count()) > 0
              || (await page.locator("text=CREATING YOUR VIDEO").count()) > 0);
            if (step4) {
              await page.waitForTimeout(5000);
              const hasProgress = (await page.locator(".fr-progress-pct").count()) > 0
                || (await page.locator("text=Video ready").count()) > 0
                || (await page.locator("text=Your Video Is Ready").count()) > 0;
              record("Step 4 shows production progress or ready state", hasProgress);
            }
          } else {
            record("Step 3 → Step 4 continue enabled", false, "plan prerequisites not met");
          }
        }
      } else {
        record("Step 2 → Step 3 continue enabled", false, "prerequisites not met");
      }
    }
  }

  record("No React error #130 in page errors", !pageErrors.some((e) => /130|invalid element/i.test(e)));
  record("No uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));

  await page.screenshot({ path: "workflow-navigation-live.png", fullPage: true });
} catch (error) {
  record("Verification script", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
