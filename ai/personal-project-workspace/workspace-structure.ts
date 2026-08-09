import * as fs from "fs";
import * as path from "path";
import { WORKSPACE_FOLDERS } from "./types.js";

/** Ensure workspace folder tree exists without overwriting user files. */
export function ensureWorkspaceStructure(workspaceRoot: string): {
  created: string[];
  existing: string[];
} {
  const created: string[] = [];
  const existing: string[] = [];
  fs.mkdirSync(workspaceRoot, { recursive: true });
  for (const folder of WORKSPACE_FOLDERS) {
    const dir = path.join(workspaceRoot, folder);
    if (fs.existsSync(dir)) existing.push(folder);
    else {
      fs.mkdirSync(dir, { recursive: true });
      created.push(folder);
    }
  }
  return { created, existing };
}

export function ensureProjectStructure(projectRoot: string): string[] {
  const created: string[] = [];
  fs.mkdirSync(projectRoot, { recursive: true });
  for (const folder of ["Images", "Videos", "Audio", "Assets", "Exports", "History", "Cache"]) {
    const dir = path.join(projectRoot, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      created.push(folder);
    }
  }
  return created;
}

/** Write file only if missing, or write sidecar version — never overwrite existing user content. */
export function writeUserSafeFile(
  filePath: string,
  contents: string,
  options?: { allowOverwriteMeta?: boolean },
): { written: boolean; path: string; skippedOverwrite: boolean } {
  if (fs.existsSync(filePath) && !options?.allowOverwriteMeta) {
    return { written: false, path: filePath, skippedOverwrite: true };
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  return { written: true, path: filePath, skippedOverwrite: false };
}

export function estimateDirBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else {
        try {
          total += fs.statSync(full).size;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return total;
}
