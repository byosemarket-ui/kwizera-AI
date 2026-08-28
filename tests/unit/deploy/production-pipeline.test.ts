import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("VPS production pipeline must build the studio UI", () => {
  it("npm run build:production is the full build, not server-only", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["build:production"]).toBe("node scripts/build-production.mjs");
    expect(pkg.scripts["build:production"]).not.toContain("server-only");
    expect(pkg.scripts["build:production:server"]).toContain("--server-only");
    expect(pkg.dependencies?.vite).toBeTruthy();
  });

  it("build-production.mjs always runs Vite and requires desktop index.html", () => {
    const src = read("scripts/build-production.mjs");
    expect(src).toContain("desktop.vite.config.ts");
    expect(src).toContain("dev/ui/desktop/index.html");
    expect(src).toContain("Dev Dashboard");
    expect(src).toMatch(/serverOnly|server-only/);
  });

  it("update-from-github.sh runs the full production build and fails without the studio index", () => {
    const sh = read("deploy/update-from-github.sh");
    expect(sh).toContain("npm run build:production");
    expect(sh).not.toContain("build:production:server");
    expect(sh).toContain("dev/ui/desktop/index.html");
    expect(sh).toContain("npm ci --include=dev");
  });

  it("vps-step2.sh no longer uses the server-only build for VPS deploys", () => {
    const sh = read("deploy/vps-step2.sh");
    expect(sh).toContain("npm run build:production");
    expect(sh).not.toContain("build:production:server");
    expect(sh).toContain("dev/ui/desktop/index.html");
  });

  it("apply-gateway-unit.sh rebuilds the full production bundle when the studio is missing", () => {
    const sh = read("deploy/apply-gateway-unit.sh");
    expect(sh).toContain("npm run build:production");
    expect(sh).not.toContain("build:production:server");
  });
});
