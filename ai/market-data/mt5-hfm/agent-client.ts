/**
 * Node client for the local HFM MT5 Demo agent (AF_UNIX).
 * Never logs passwords. Demo-only methods.
 */
import net from "node:net";
import { randomBytes } from "node:crypto";
import { AiSecretsManager } from "../../connector-management/secrets-manager.js";
import {
  MT5_HFM_AGENT_MAX_REQUEST_BYTES,
  MT5_HFM_AGENT_MAX_RESPONSE_BYTES,
  MT5_HFM_AGENT_SOCKET_PATH,
  MT5_HFM_AGENT_TOKEN_SECRET_ID,
  buildAgentRequest,
  encodeFrame,
  isAllowedMt5HfmAgentMethod,
  isForbiddenTradingMethod,
  tryDecodeFrame,
  type Mt5HfmAgentMethod,
  type Mt5HfmAgentResponse,
} from "./agent-protocol.js";
import { assertBridgeEnvironmentIsDemo } from "./bridge-guards.js";

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return `${process.cwd()}/data`;
}

let cachedToken: string | null = null;

export async function ensureMt5HfmAgentToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const secrets = new AiSecretsManager();
  await secrets.initialize(resolveStorageRoot());
  if (!secrets.isUnlocked()) {
    throw new Error("Secrets vault locked; cannot load MT5 agent token. Set KWIZERA_SECRETS_PASSPHRASE.");
  }
  if (!secrets.has(MT5_HFM_AGENT_TOKEN_SECRET_ID)) {
    const token = randomBytes(32).toString("base64url");
    await secrets.set(MT5_HFM_AGENT_TOKEN_SECRET_ID, token);
  }
  cachedToken = secrets.get(MT5_HFM_AGENT_TOKEN_SECRET_ID);
  return cachedToken;
}

export async function rotateMt5HfmAgentToken(): Promise<{ rotated: true; hint: string }> {
  const secrets = new AiSecretsManager();
  await secrets.initialize(resolveStorageRoot());
  if (!secrets.isUnlocked()) {
    throw new Error("Secrets vault locked; cannot rotate MT5 agent token.");
  }
  const token = randomBytes(32).toString("base64url");
  await secrets.set(MT5_HFM_AGENT_TOKEN_SECRET_ID, token);
  cachedToken = token;
  return { rotated: true, hint: token.slice(-4) };
}

export async function callMt5HfmAgent(
  method: Mt5HfmAgentMethod,
  body: Record<string, unknown> = {},
  options?: { socketPath?: string; timeoutMs?: number },
): Promise<Mt5HfmAgentResponse> {
  if (isForbiddenTradingMethod(method) || !isAllowedMt5HfmAgentMethod(method)) {
    return {
      v: 1,
      requestId: "local",
      ok: false,
      code: "METHOD_FORBIDDEN",
      error: "Unsupported or forbidden agent method.",
    };
  }
  if (method.startsWith("demo.")) {
    assertBridgeEnvironmentIsDemo("demo");
  }
  // Never accept live password fields from callers.
  if ("password" in body && method !== "demo.login") {
    delete body.password;
  }

  const token = await ensureMt5HfmAgentToken();
  const request = buildAgentRequest(token, method, body);
  const socketPath = options?.socketPath ?? process.env.KWIZERA_MT5_HFM_AGENT_SOCK ?? MT5_HFM_AGENT_SOCKET_PATH;
  const timeoutMs = options?.timeoutMs ?? 90_000;

  return await new Promise<Mt5HfmAgentResponse>((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath });
    let buf = Buffer.alloc(0);
    let settled = false;
    const timer = setTimeout(() => {
      fail(Object.assign(new Error("MT5 agent request timed out"), { code: "AGENT_TIMEOUT" }));
    }, timeoutMs);

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    };

    socket.on("connect", () => {
      const frame = encodeFrame(request);
      if (frame.length - 4 > MT5_HFM_AGENT_MAX_REQUEST_BYTES) {
        fail(Object.assign(new Error("Request too large"), { code: "FRAME_TOO_LARGE" }));
        return;
      }
      socket.write(frame);
    });

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      try {
        const decoded = tryDecodeFrame(buf, MT5_HFM_AGENT_MAX_RESPONSE_BYTES);
        if (!decoded) return;
        const parsed = JSON.parse(decoded.frame.toString("utf8")) as Mt5HfmAgentResponse;
        settled = true;
        clearTimeout(timer);
        socket.end();
        resolve(parsed);
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Invalid agent frame"));
      }
    });

    socket.on("error", (error) => {
      fail(
        Object.assign(
          new Error(
            error.message.includes("ENOENT")
              ? "MT5 agent socket not available (agent not running)."
              : error.message,
          ),
          { code: error.message.includes("ENOENT") ? "AGENT_UNAVAILABLE" : "AGENT_SOCKET_ERROR" },
        ),
      );
    });
  });
}

/** Test helper — clear cached token between unit tests. */
export function resetMt5HfmAgentClientForTests(): void {
  cachedToken = null;
}
