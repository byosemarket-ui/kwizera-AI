import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isLegacyDashboardPath,
  isStudioEntryPath,
  resolvePublicUiFile,
} from "../../../../dev/server/static-ui.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function makeUi(options: { studio?: boolean; legacy?: boolean; asset?: boolean }) {
  const uiDir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ui-"));
  dirs.push(uiDir);
  if (options.legacy !== false) {
    fs.writeFileSync(path.join(uiDir, "index.html"), "<title>KWIZERA AI STUDIO — Dev Dashboard</title>");
    fs.writeFileSync(path.join(uiDir, "styles.css"), "body{}");
  }
  if (options.studio) {
    fs.mkdirSync(path.join(uiDir, "desktop", "assets"), { recursive: true });
    fs.writeFileSync(path.join(uiDir, "desktop", "index.html"), "<title>KWIZERA AI STUDIO</title>");
    fs.writeFileSync(path.join(uiDir, "desktop", "assets", "app.js"), "console.log(1)");
  }
  return uiDir;
}

describe("public studio static routing", () => {
  it("classifies studio and legacy entry paths", () => {
    expect(isStudioEntryPath("/")).toBe(true);
    expect(isStudioEntryPath("/desktop")).toBe(true);
    expect(isStudioEntryPath("/desktop/")).toBe(true);
    expect(isLegacyDashboardPath("/dev")).toBe(true);
    expect(isLegacyDashboardPath("/")).toBe(false);
  });

  it("serves the professional studio at / and /desktop/", () => {
    const uiDir = makeUi({ studio: true });
    for (const pathname of ["/", "/desktop", "/desktop/"]) {
      const resolved = resolvePublicUiFile(pathname, uiDir);
      expect(resolved.kind).toBe("studio");
      if (resolved.kind === "studio") {
        expect(resolved.filePath).toBe(path.join(uiDir, "desktop", "index.html"));
        expect(fs.readFileSync(resolved.filePath, "utf8")).not.toContain("Dev Dashboard");
      }
    }
  });

  it("serves the legacy Dev Dashboard only at /dev", () => {
    const uiDir = makeUi({ studio: true });
    const resolved = resolvePublicUiFile("/dev", uiDir);
    expect(resolved.kind).toBe("legacy");
    if (resolved.kind === "legacy") {
      expect(fs.readFileSync(resolved.filePath, "utf8")).toContain("Dev Dashboard");
    }
  });

  it("does not fall back to the Dev Dashboard when the studio bundle is missing", () => {
    const uiDir = makeUi({ studio: false });
    expect(resolvePublicUiFile("/", uiDir).kind).toBe("missing-studio");
    expect(resolvePublicUiFile("/desktop/", uiDir).kind).toBe("missing-studio");
    expect(resolvePublicUiFile("/home", uiDir).kind).toBe("missing-studio");
  });

  it("does not send unknown client routes to the legacy dashboard", () => {
    const uiDir = makeUi({ studio: true });
    const resolved = resolvePublicUiFile("/open-project", uiDir);
    expect(resolved.kind).toBe("studio");
  });

  it("404s missing static assets instead of serving HTML", () => {
    const uiDir = makeUi({ studio: true });
    expect(resolvePublicUiFile("/desktop/assets/missing.js", uiDir).kind).toBe("not-found");
    expect(resolvePublicUiFile("/styles.css", uiDir).kind).toBe("asset");
  });
});
