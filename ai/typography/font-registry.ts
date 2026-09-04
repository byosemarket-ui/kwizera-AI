/**
 * Discover fonts that actually exist on disk. Never invent installed families.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FontPersonality, TextRole, VerifiedFont } from "./types.js";

const FONT_EXT = new Set([".ttf", ".otf", ".ttc"]);

function defaultFontDirs(): string[] {
  if (process.platform === "win32") {
    return ["C:\\Windows\\Fonts"];
  }
  return [
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    "/usr/share/fonts/truetype",
    path.join(os.homedir(), ".fonts"),
    path.join(os.homedir(), ".local/share/fonts"),
  ];
}

async function walkFonts(root: string, found: string[], depth = 0): Promise<void> {
  if (depth > 5 || found.length > 400) return;
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walkFonts(full, found, depth + 1);
    } else if (FONT_EXT.has(path.extname(entry.name).toLowerCase())) {
      found.push(full);
    }
  }
}

function classify(filePath: string): Pick<VerifiedFont, "family" | "style" | "weight" | "italic" | "bold" | "category" | "personalities" | "roles" | "latinExtended"> {
  const base = path.basename(filePath).replace(/\.(ttf|otf|ttc)$/i, "");
  const name = base.replace(/[-_]+/g, " ");
  const lower = name.toLowerCase();
  const italic = /italic|oblique/i.test(lower);
  const bold = /bold|black|heavy/i.test(lower);
  const family = name
    .replace(/bold|italic|oblique|regular|medium|light|black|heavy/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || name;

  let category: VerifiedFont["category"] = "unknown";
  const personalities: FontPersonality[] = [];
  if (/mono|consolas|courier|menlo/i.test(lower)) {
    category = "mono";
    personalities.push("monospace", "tech");
  } else if (/script|hand|comic|brush|cursive/i.test(lower)) {
    category = "script";
    personalities.push("script", "handwritten", "playful");
  } else if (/impact|bebas|display|blackletter/i.test(lower)) {
    category = "display";
    personalities.push("bold-display", "promotional", "condensed-display");
  } else if (/serif|times|georgia|garamond|palatino|cambria|dejavuserif|liberation serif|nimbus/i.test(lower) && !/sans/i.test(lower)) {
    category = "serif";
    personalities.push("serif", "editorial-serif", "luxury-serif", "premium", "cinematic", "fashion");
  } else {
    category = "sans";
    personalities.push("clean-sans", "modern-sans", "minimal", "neutral");
    if (/geo|futura|avant/i.test(lower)) personalities.push("geometric-sans");
    if (/roboto|helvetica|arial|dejavu|liberation|noto/i.test(lower)) personalities.push("tech", "humanist-sans");
  }

  const roles: TextRole[] = category === "script"
    ? ["headline", "brand", "closingMessage"]
    : category === "serif"
      ? ["title", "headline", "productName", "brand", "sceneCaption"]
      : category === "display"
        ? ["hook", "promotion", "discount", "cta", "price"]
        : ["title", "headline", "hook", "subtitle", "productName", "productFeature", "benefit", "price", "previousPrice", "discount", "promotion", "cta", "brand", "website", "phone", "sceneCaption", "closingMessage", "supporting"];

  const latinExtended = /dejavu|noto|arial|liberation|free|roboto|source|ubuntu|segoe/i.test(lower);
  return {
    family,
    style: italic && bold ? "bold-italic" : italic ? "italic" : bold ? "bold" : "regular",
    weight: bold ? 700 : 400,
    italic,
    bold,
    category,
    personalities: [...new Set(personalities)],
    roles,
    latinExtended,
  };
}

export async function discoverVerifiedFonts(opts?: {
  extraFiles?: string[];
  extraDirs?: string[];
}): Promise<VerifiedFont[]> {
  const files: string[] = [];
  const envFont = process.env.KWIZERA_FONT_FILE;
  if (envFont) files.push(envFont);
  for (const extra of opts?.extraFiles ?? []) files.push(extra);
  const dirs = [...defaultFontDirs(), ...(opts?.extraDirs ?? [])];
  for (const dir of dirs) {
    await walkFonts(dir, files);
  }

  const unique = [...new Set(files.map((item) => path.normalize(item)))];
  const fonts: VerifiedFont[] = [];
  for (const filePath of unique) {
    try {
      await fs.access(filePath);
      const meta = classify(filePath);
      fonts.push({
        id: `${meta.family.toLowerCase().replace(/\s+/g, "-")}:${path.basename(filePath)}`,
        filePath,
        verified: true,
        ...meta,
      });
    } catch {
      /* missing — skip */
    }
  }
  return fonts.sort((a, b) => a.family.localeCompare(b.family));
}

let cache: { at: number; fonts: VerifiedFont[] } | null = null;

export async function getVerifiedFonts(force = false): Promise<VerifiedFont[]> {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.fonts;
  const fonts = await discoverVerifiedFonts();
  cache = { at: Date.now(), fonts };
  return fonts;
}

export function pickFallbackFont(fonts: VerifiedFont[]): VerifiedFont | null {
  const preferred = fonts.find((font) => /dejavu sans(?! mono)/i.test(font.family) && !font.italic)
    ?? fonts.find((font) => /arial/i.test(font.family) && !/black|narrow/i.test(font.family))
    ?? fonts.find((font) => font.category === "sans" && font.latinExtended)
    ?? fonts.find((font) => font.category === "sans")
    ?? fonts[0]
    ?? null;
  return preferred;
}

export async function resolveVerifiedFontFile(): Promise<string | undefined> {
  const fonts = await getVerifiedFonts();
  return pickFallbackFont(fonts)?.filePath;
}

export function fontSupportsText(font: VerifiedFont, text: string): boolean {
  if (!text.trim()) return true;
  const needsExtended = /[^\u0000-\u007F]/.test(text);
  if (!needsExtended) return true;
  return font.latinExtended || font.category === "sans" || /dejavu|noto|arial/i.test(font.family);
}
