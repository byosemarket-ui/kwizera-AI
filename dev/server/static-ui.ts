import fs from "node:fs";
import path from "node:path";

export const STUDIO_INDEX_RELATIVE = path.join("dev", "ui", "desktop", "index.html");
export const LEGACY_INDEX_RELATIVE = path.join("dev", "ui", "index.html");

const STUDIO_ENTRY = new Set(["/", "/desktop", "/desktop/"]);
const LEGACY_ENTRY = new Set(["/dev", "/dev/", "/dev-dashboard"]);

export type PublicUiResolution =
  | { kind: "studio" | "legacy" | "asset"; filePath: string }
  | { kind: "missing-studio" }
  | { kind: "not-found" };

export function isLegacyDashboardPath(pathname: string): boolean {
  return LEGACY_ENTRY.has(pathname);
}

export function isStudioEntryPath(pathname: string): boolean {
  return STUDIO_ENTRY.has(pathname);
}

export function isStaticAssetPath(pathname: string): boolean {
  const leaf = pathname.split("/").pop() ?? "";
  return /\.[a-z0-9]+$/i.test(leaf);
}

export function resolveUiAsset(pathname: string, uiDir: string): string | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const filePath = path.resolve(uiDir, `.${decodedPath}`);
  return filePath === uiDir || filePath.startsWith(`${uiDir}${path.sep}`) ? filePath : null;
}

/**
 * Public static routing for KWIZERA AI STUDIO.
 *
 * / and /desktop → professional studio (Vite output)
 * /dev → legacy Dev Dashboard
 * Missing studio files must not silently fall back to the Dev Dashboard.
 */
export function resolvePublicUiFile(pathname: string, uiDir: string): PublicUiResolution {
  const desktopIndex = path.join(uiDir, "desktop", "index.html");
  const legacyIndex = path.join(uiDir, "index.html");

  if (isLegacyDashboardPath(pathname)) {
    if (!fs.existsSync(legacyIndex) || !fs.statSync(legacyIndex).isFile()) return { kind: "not-found" };
    return { kind: "legacy", filePath: legacyIndex };
  }

  if (isStudioEntryPath(pathname)) {
    if (!fs.existsSync(desktopIndex) || !fs.statSync(desktopIndex).isFile()) return { kind: "missing-studio" };
    return { kind: "studio", filePath: desktopIndex };
  }

  const asset = resolveUiAsset(pathname, uiDir);
  if (asset && fs.existsSync(asset) && fs.statSync(asset).isFile()) {
    return { kind: "asset", filePath: asset };
  }

  if (isStaticAssetPath(pathname)) {
    return { kind: "not-found" };
  }

  if (!fs.existsSync(desktopIndex) || !fs.statSync(desktopIndex).isFile()) {
    return { kind: "missing-studio" };
  }
  return { kind: "studio", filePath: desktopIndex };
}

export function studioIndexExists(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, STUDIO_INDEX_RELATIVE));
}
