/**
 * Phase 36A — Safe ForexConnect VPS runtime probe (written by provision-forexconnect.sh).
 * Never contains credentials.
 */
import fs from "node:fs/promises";
import path from "node:path";

export interface ForexConnectRuntimeProbe {
  ok: boolean;
  provider: "FOREXCONNECT";
  checkedAt?: string;
  os?: string;
  kernel?: string;
  arch?: string;
  systemPython?: string;
  sidecarPython?: string;
  venvPython?: string;
  sdkPackage?: string;
  sdkVersionRequested?: string;
  sdkVersionInstalled?: string;
  sdkImportOk?: boolean;
  sdkImportError?: string | null;
  runtimeReady?: boolean;
  enableAllowed?: boolean;
  sidecarBind?: string;
  serviceUser?: string;
  note?: string;
  probePath?: string;
  available: boolean;
}

function resolveProbePath(): string {
  const storage = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim()
    || path.join(process.cwd(), "data");
  return path.join(storage, "forexconnect", "runtime-probe.json");
}

export async function readForexConnectRuntimeProbe(): Promise<ForexConnectRuntimeProbe> {
  const probePath = resolveProbePath();
  try {
    const raw = await fs.readFile(probePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ok: true,
      provider: "FOREXCONNECT",
      checkedAt: parsed.checkedAt ? String(parsed.checkedAt) : undefined,
      os: parsed.os ? String(parsed.os) : undefined,
      kernel: parsed.kernel ? String(parsed.kernel) : undefined,
      arch: parsed.arch ? String(parsed.arch) : undefined,
      systemPython: parsed.systemPython ? String(parsed.systemPython) : undefined,
      sidecarPython: parsed.sidecarPython ? String(parsed.sidecarPython) : undefined,
      venvPython: parsed.venvPython ? String(parsed.venvPython) : undefined,
      sdkPackage: parsed.sdkPackage ? String(parsed.sdkPackage) : undefined,
      sdkVersionRequested: parsed.sdkVersionRequested
        ? String(parsed.sdkVersionRequested)
        : undefined,
      sdkVersionInstalled: parsed.sdkVersionInstalled
        ? String(parsed.sdkVersionInstalled)
        : undefined,
      sdkImportOk: Boolean(parsed.sdkImportOk),
      sdkImportError: parsed.sdkImportError == null
        ? null
        : String(parsed.sdkImportError).slice(0, 500),
      runtimeReady: Boolean(parsed.runtimeReady),
      enableAllowed: Boolean(parsed.enableAllowed),
      sidecarBind: parsed.sidecarBind ? String(parsed.sidecarBind) : "127.0.0.1:5179",
      serviceUser: parsed.serviceUser ? String(parsed.serviceUser) : undefined,
      note: parsed.note ? String(parsed.note).slice(0, 500) : undefined,
      probePath,
      available: true,
    };
  } catch {
    return {
      ok: true,
      provider: "FOREXCONNECT",
      available: false,
      probePath,
      note: "Runtime probe not found. Deploy provision-forexconnect.sh has not completed on this host.",
    };
  }
}
