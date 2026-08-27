import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findOllamaBinary, resetOllamaBinaryCache } from "../../../../ai/model-management/local-ollama.js";

const originalPath = process.env.PATH;
const originalOllamaPath = process.env.OLLAMA_PATH;
const originalOllamaBin = process.env.OLLAMA_BIN;

afterEach(() => {
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  if (originalOllamaPath === undefined) delete process.env.OLLAMA_PATH;
  else process.env.OLLAMA_PATH = originalOllamaPath;
  if (originalOllamaBin === undefined) delete process.env.OLLAMA_BIN;
  else process.env.OLLAMA_BIN = originalOllamaBin;
  resetOllamaBinaryCache();
});

describe("findOllamaBinary", () => {
  it("does not return a bare ollama name when the binary is not installed", () => {
    delete process.env.OLLAMA_PATH;
    delete process.env.OLLAMA_BIN;
    process.env.PATH = os.tmpdir();
    resetOllamaBinaryCache();
    const found = findOllamaBinary();
    expect(found).not.toBe("ollama");
    expect(found).not.toBe("ollama.exe");
    if (found) expect(fs.existsSync(found)).toBe(true);
  });

  it("honors OLLAMA_PATH when the file exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-ollama-"));
    const binary = path.join(dir, process.platform === "win32" ? "ollama.exe" : "ollama");
    fs.writeFileSync(binary, "");
    process.env.OLLAMA_PATH = binary;
    resetOllamaBinaryCache();
    expect(findOllamaBinary()).toBe(binary);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
