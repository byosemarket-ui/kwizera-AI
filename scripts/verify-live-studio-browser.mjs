#!/usr/bin/env node
/**
 * Live production browser verification for KWIZERA AI STUDIO startup/black-screen fix.
 * Usage: node scripts/verify-live-studio-browser.mjs [url]
 */
import { chromium } from "playwright";

const BASE_URL = process.argv[2] ?? "http://162.35.114.19:5173/";
const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fnv1aChecksum(payload) {
  const text = JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

function buildExistingAccountStorage() {
  const shell = {
    workspace: "product-information",
    leftCollapsed: false,
    rightOpen: true,
    rightCollapsed: false,
    bottomExpanded: false,
    bottomHeight: 200,
    bottomTab: "activity",
    zen: false,
    panels: [],
  };
  const preferences = {
    theme: "dark",
    accent: "mint",
    uiScale: 100,
    fontScale: 100,
    highContrast: false,
    reducedMotion: false,
    activeProfile: "default",
    lastWorkspace: "product-information",
    startupMode: "restore-session",
    language: "en",
    preferredProductionMode: "guided",
    quickAccessMode: "smart",
    uiDensity: "comfortable",
    defaultExportProfile: "default",
    showWelcomeOnStartup: false,
    sidebarPinnedDefault: false,
    performanceMode: "balanced",
    cacheMaxMb: 32,
    autoPerformanceAlerts: true,
    tooltipsEnabled: true,
    confirmDestructive: true,
    showKeyboardHints: true,
    tourCompleted: false,
    defaultLayoutId: "default",
    lastOpenedProject: "Chestnut Oxford",
    window: { width: 1440, height: 900, x: 0, y: 0 },
    notificationPreferences: {
      information: true,
      warnings: true,
      errors: true,
      updates: true,
      aiSuggestions: true,
      productionComplete: true,
    },
    autoSavePreferences: { enabled: true, mode: "auto", intervalMs: 1500 },
    defaultProjectSettings: {},
  };
  const snapshot = {
    version: 1,
    id: "snap-live-test",
    savedAt: new Date().toISOString(),
    saveMode: "auto",
    cleanShutdown: false,
    session: {
      id: "sess-live-test",
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      closedAt: null,
      durationMs: 0,
      workspace: "product-information",
      projectId: null,
      projectName: "Chestnut Oxford",
      layoutId: "default",
      cleanShutdown: false,
    },
    shell,
    navigation: {
      favorites: [],
      history: [{ workspace: "product-information", at: new Date().toISOString() }],
      recent: ["product-information"],
      visitCounts: { "product-information": 3 },
      pinned: false,
      collapsedGroups: [],
      quickAccess: [],
      commandCounts: {},
      recentPanels: [],
      frequentProjects: ["Chestnut Oxford"],
      frequentAssets: [],
      frequentAiActions: [],
    },
    layoutManager: { activeLayoutId: "default", layouts: [] },
    preferences,
    dashboard: null,
    projectMemory: {
      projectId: "c594ce9b-0612-4477-9eab-1019811aeb0e",
      projectName: "Chestnut Oxford",
      productInformation: {},
      uploadedImages: [],
      marketingSettings: {},
      storyboardProgress: 0,
      productionProgress: 0,
      renderingProgress: 0,
      exportSettings: {},
      aiDecisions: [],
      updatedAt: new Date().toISOString(),
    },
    ui: { activeSidebar: "left", activeTabs: {}, scrollPositions: {}, selectedItems: [], zoomLevel: 100 },
  };
  const checksum = fnv1aChecksum(snapshot);
  snapshot.checksum = checksum;
  return {
    "kwizera.desktop-workspace.v2": JSON.stringify(shell),
    "kwizera.desktop.preferences.v1": JSON.stringify(preferences),
    "kwizera.workspace-state.snapshot.v1": JSON.stringify(snapshot),
    "kwizera.workspace-state.emergency.v1": JSON.stringify(snapshot),
    "kwizera.workspace-crash-flag.v1": JSON.stringify({ unclean: true, at: new Date().toISOString() }),
    "kwizera.project-memory.v1": JSON.stringify(snapshot.projectMemory),
  };
}

async function inspectPage(page, label) {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2500);

  const title = await page.title();
  const hasShell = await page.locator("#workspace-main").count();
  const hasBrand = await page.locator(".brand").count();
  const hasHomeContent = await page.locator(".professional-dashboard").count();
  const hasLoaderOnly = await page.locator(".startup-loading-panel").count();
  const hasRecovery = await page.locator(".startup-recovery-panel").count();
  const hasAnyMain = hasHomeContent + hasLoaderOnly + hasRecovery;
  const workspace = await page.locator("#workspace-main").getAttribute("data-workspace");
  const bodyText = ((await page.locator("body").innerText()) || "").slice(0, 500);
  const failedRequests = [];
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? "failed"}`);
  });

  record(`${label}: page title`, title.includes("KWIZERA"), title);
  record(`${label}: shell mounted`, hasShell > 0, `#workspace-main=${hasShell}`);
  record(`${label}: header brand visible`, hasBrand > 0, `.brand=${hasBrand}`);
  record(`${label}: Home dashboard rendered`, hasHomeContent > 0, `dashboard=${hasHomeContent}, loader=${hasLoaderOnly}, recovery=${hasRecovery}`);
  record(`${label}: not stuck on startup loader`, hasLoaderOnly === 0 || hasHomeContent > 0, `loader=${hasLoaderOnly}`);
  record(`${label}: main panel rendered`, hasAnyMain > 0, `panels=${hasAnyMain}`);
  record(`${label}: startup workspace is Home`, workspace === "home", `data-workspace=${workspace}`);
  record(`${label}: not blank body`, bodyText.trim().length > 20, bodyText.slice(0, 80));

  const criticalErrors = consoleErrors.filter((e) =>
    !e.includes("favicon")
    && !e.includes("404")
  );
  record(`${label}: no uncaught startup errors`, criticalErrors.length === 0, criticalErrors.slice(0, 3).join(" | "));

  return { consoleErrors: criticalErrors, failedRequests, workspace, bodyText };
}

async function launchBrowser() {
  for (const channel of ["msedge", "chrome", "chromium"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try next channel */
    }
  }
  return chromium.launch({ headless: true });
}

async function main() {
  const browser = await launchBrowser();
  try {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await inspectPage(pageA, "A fresh session");
    await contextA.close();

    const contextB = await browser.newContext();
    await contextB.addInitScript((storage) => {
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
    }, buildExistingAccountStorage());
    const pageB = await contextB.newPage();
    await inspectPage(pageB, "B existing account/session");
    await contextB.close();

    const contextC = await browser.newContext();
    await contextC.addInitScript((storage) => {
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, value);
      }
    }, buildExistingAccountStorage());
    const pageC = await contextC.newPage();
    await pageC.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60_000 });
    await pageC.waitForTimeout(1500);
    await pageC.reload({ waitUntil: "networkidle" });
    await pageC.waitForTimeout(2500);
    const workspaceAfterReload = await pageC.locator("#workspace-main").getAttribute("data-workspace");
    const hasContentAfterReload = await pageC.locator(".professional-dashboard, .startup-recovery-panel").count();
    record("C hard refresh renders", hasContentAfterReload > 0, `workspace=${workspaceAfterReload}`);
    record("C reload opens Home", workspaceAfterReload === "home", workspaceAfterReload ?? "missing");
    await contextC.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log("\n--- Summary ---");
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Browser verification crashed:", error);
  process.exit(1);
});
