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

describe("canonical GitHub-to-VPS deploy", () => {
  it("locks concurrent deploys and checks out the requested SHA, not git pull tip", () => {
    const sh = read("deploy/update-from-github.sh");
    expect(sh).toContain("flock -n");
    expect(sh).toContain("KWIZERA_DEPLOY_SHA");
    expect(sh).toContain("checkout --detach --force");
    expect(sh).not.toMatch(/git pull --ff-only/);
    expect(sh).toContain("rolling back");
    expect(sh).toContain("/var/lib/kwizera-ai-studio");
    expect(sh).not.toMatch(/\brm\s+-rf\s+.*kwizera-ai-studio/);
    expect(sh).toContain("runtimeReady");
    expect(sh).toContain("verify-live-http.mjs");
    expect(sh).toContain("record-status.mjs");
  });

  it("fails if Studio HTML is the Dev Dashboard or required artifacts are missing", () => {
    const sh = read("deploy/update-from-github.sh");
    expect(sh).toContain("dist/dev/server/production-gateway.js");
    expect(sh).toContain("dist/dev/server/index.js");
    expect(sh).toContain("Dev Dashboard");
    const verify = read("deploy/verify-live-http.mjs");
    expect(verify).toContain("/api/health");
    expect(verify).toContain("/desktop/");
    expect(verify).toContain("/dev");
    expect(verify).toMatch(/Dev Dashboard/);
  });

  it("GitHub Actions deploys the exact GITHUB_SHA over SSH secrets only", () => {
    const yml = read(".github/workflows/production-deploy.yml");
    expect(yml).toContain("on:");
    expect(yml).toContain("branches: [main]");
    expect(yml).toContain("github.sha");
    expect(yml).toContain("KWIZERA_DEPLOY_SHA");
    expect(yml).toContain("secrets.VPS_HOST");
    expect(yml).toContain("secrets.VPS_USER");
    expect(yml).toContain("secrets.VPS_SSH_KEY");
    expect(yml).toContain("secrets.VPS_KNOWN_HOSTS");
    expect(yml).toContain("BatchMode=yes");
    expect(yml).toContain("npm run build:production");
    expect(yml).toContain("npm run verify:studio-ui");
    expect(yml).not.toContain("162.35.114.19");
    expect(yml).not.toMatch(/BEGIN (OPENSSH|RSA|EC) PRIVATE KEY/);
    expect(yml).not.toMatch(/password:/i);
    expect(yml).toContain("cancel-in-progress: false");
  });

  it("AI Me reads real /api/deployment and does not invent Live", () => {
    const sidebar = read("desktop/shell/RightSidebar.tsx");
    expect(sidebar).toContain("/api/deployment");
    expect(sidebar).toContain("verifiedLive");
    expect(sidebar).toContain("Deploying");
    expect(sidebar).toContain("Rolled Back");
    const api = read("dev/server/index.ts");
    expect(api).toContain("/api/deployment");
    expect(api).toContain("loadDeploymentRecord");
  });
});
