#!/usr/bin/env node
/**
 * Verifies the production studio static bundle and public routing
 * without booting KWIZERA AI Core.
 */
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = path.join(root, "dev", "ui");
const desktopIndex = path.join(uiDir, "desktop", "index.html");
const legacyIndex = path.join(uiDir, "index.html");
const staticUiJs = path.join(root, "dist", "dev", "server", "static-ui.js");

if (!fs.existsSync(desktopIndex)) {
  console.error("FAIL  studio index missing:", desktopIndex);
  process.exit(1);
}
if (/Dev Dashboard/i.test(fs.readFileSync(desktopIndex, "utf8"))) {
  console.error("FAIL  studio index is the legacy Dev Dashboard");
  process.exit(1);
}
if (!fs.existsSync(legacyIndex) || !/Dev Dashboard/i.test(fs.readFileSync(legacyIndex, "utf8"))) {
  console.error("FAIL  legacy /dev dashboard missing");
  process.exit(1);
}
if (!fs.existsSync(staticUiJs)) {
  console.error("FAIL  compiled static-ui.js missing — run npm run build:production");
  process.exit(1);
}

const { resolvePublicUiFile } = await import(pathToFileURL(staticUiJs).href);

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

const server = createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  const resolved = resolvePublicUiFile(pathname, uiDir);
  if (resolved.kind === "missing-studio" || resolved.kind === "not-found") {
    res.writeHead(resolved.kind === "missing-studio" ? 503 : 404);
    res.end(resolved.kind);
    return;
  }
  const body = fs.readFileSync(resolved.filePath);
  res.writeHead(200, { "Content-Type": contentType(resolved.filePath) });
  res.end(body);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;

async function check(pathname, expectTitle) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`);
  const text = await res.text();
  if (res.status !== 200) {
    throw new Error(`${pathname} status ${res.status}`);
  }
  if (!text.includes(expectTitle)) {
    throw new Error(`${pathname} missing ${expectTitle}; got: ${text.slice(0, 180)}`);
  }
  if (expectTitle === "KWIZERA AI STUDIO" && text.includes("Dev Dashboard")) {
    throw new Error(`${pathname} still served the Dev Dashboard`);
  }
  console.log(`PASS  ${pathname} → ${expectTitle}`);
}

try {
  await check("/", "KWIZERA AI STUDIO");
  await check("/desktop/", "KWIZERA AI STUDIO");
  await check("/dev", "Dev Dashboard");
  console.log("PASS  studio static routing");
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
