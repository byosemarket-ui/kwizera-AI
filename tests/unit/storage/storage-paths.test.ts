import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findProjectRoot,
  isUsableStorageRoot,
  resolveStoragePath,
  resolveStorageRoot,
} from "../../../storage/paths/storage-paths.js";

const originalRoot = process.env.KWIZERA_STORAGE_ROOT;
const originalProject = process.env.KWIZERA_PROJECT_ROOT;

afterEach(() => {
  if (originalRoot === undefined) delete process.env.KWIZERA_STORAGE_ROOT;
  else process.env.KWIZERA_STORAGE_ROOT = originalRoot;
  if (originalProject === undefined) delete process.env.KWIZERA_PROJECT_ROOT;
  else process.env.KWIZERA_PROJECT_ROOT = originalProject;
});

describe("storage path resolution", () => {
  it("honors KWIZERA_STORAGE_ROOT", () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-storage-"));
    process.env.KWIZERA_STORAGE_ROOT = temp;
    expect(path.resolve(resolveStorageRoot())).toBe(path.resolve(temp));
    fs.rmSync(temp, { recursive: true, force: true });
  });

  it("honors an explicit override over the environment", () => {
    process.env.KWIZERA_STORAGE_ROOT = path.join(os.tmpdir(), "kwizera-env-root");
    const override = path.join(os.tmpdir(), "kwizera-override-root");
    expect(path.resolve(resolveStorageRoot(override))).toBe(path.resolve(override));
  });

  it("rejects Windows drive-letter roots on non-Windows hosts", () => {
    if (process.platform === "win32") {
      expect(isUsableStorageRoot("D:\\KWIZERA-AI-STUDIO")).toBe(true);
    } else {
      expect(isUsableStorageRoot("D:\\KWIZERA-AI-STUDIO")).toBe(false);
      expect(isUsableStorageRoot("C:/Users/dev/studio")).toBe(false);
    }
    expect(isUsableStorageRoot("")).toBe(false);
    expect(isUsableStorageRoot(undefined)).toBe(false);
  });

  it("joins storage segments with the OS path separator", () => {
    const root = path.join(os.tmpdir(), "kwizera-join");
    expect(resolveStoragePath(root, "uploads")).toBe(path.join(root, "uploads"));
    expect(resolveStoragePath(root, "productIntelligence")).toBe(path.join(root, "product-intelligence"));
  });

  it("finds the project root from this module", () => {
    const found = findProjectRoot();
    expect(fs.existsSync(path.join(found, "package.json"))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(found, "package.json"), "utf8")) as { name: string };
    expect(pkg.name).toBe("kwizera-ai-studio");
  });
});
