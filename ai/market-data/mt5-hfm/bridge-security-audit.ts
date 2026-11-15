/**
 * PHASE 3 — HFM MT5 agent bridge security audit (DESIGN ONLY — not implemented).
 *
 * Socket: `/run/kwizera/mt5-hfm-agent.sock`
 * Agent: Linux user `mt5`, dedicated unit (proposed) `kwizera-mt5-hfm-agent.service`
 * Client: KWIZERA Node backend running as `kwizera` (localhost only)
 *
 * Do not implement the agent until this design is owner-reviewed and approved.
 * Public unauthenticated TCP ports are forbidden.
 */

export const MT5_HFM_AGENT_SOCKET_PATH = "/run/kwizera/mt5-hfm-agent.sock" as const;
export const MT5_HFM_AGENT_TOKEN_SECRET_ID = "mt5-hfm:agent:token" as const;
/** Agent code is in-repo; VPS enablement still requires owner approval. */
export const MT5_HFM_BRIDGE_SECURITY_STATUS = "implemented_pending_enablement" as const;

/** Required controls before any agent implementation may proceed. */
export const MT5_HFM_BRIDGE_SECURITY_REQUIREMENTS = {
  socket: {
    path: MT5_HFM_AGENT_SOCKET_PATH,
    filesystem: "tmpfs under /run/kwizera (mode 0750, root:kwizera or root:mt5)",
    ownership: "mt5:kwizera",
    mode: "0660",
    bindAddress: "AF_UNIX only — never 0.0.0.0 / :: TCP",
    unlinkOnStart: true,
    directorySticky: "create /run/kwizera via tmpfiles.d; refuse if path is a symlink escape",
  },
  peerCredentials: {
    mechanism: "SO_PEERCRED (pid/uid/gid) on every accept",
    allowUid: ["kwizera (backend)", "mt5 (self-health only)"],
    deny: "reject root unless explicitly allowlisted for emergency ops; reject unknown uids",
    verify: "map uid → expected service account before reading any frame",
  },
  authentication: {
    sharedTokenVaultId: MT5_HFM_AGENT_TOKEN_SECRET_ID,
    tokenDelivery: "AiSecretsManager AES-GCM; loaded by backend + agent at start; never in argv",
    requestMac: "HMAC-SHA256 over (requestId|timestamp|method|bodyHash) with agent token",
    constantTimeCompare: true,
  },
  replayProtection: {
    requestId: "uuid v4 unique per request",
    timestampWindowSec: 30,
    nonceCache: "agent keeps in-memory set of recent requestIds (TTL 60s, max 4096)",
    rejectSkewedOrDuplicate: true,
  },
  framing: {
    format: "length-prefixed binary frame: u32be length + UTF-8 JSON",
    maxRequestBytes: 8192,
    maxResponseBytes: 65536,
    rejectTruncationAndOversize: true,
  },
  timeouts: {
    acceptIdleSec: 5,
    readSec: 5,
    writeSec: 5,
    loginOperationSec: 60,
    overallHandlerSec: 90,
  },
  passwordHandling: {
    transport: "single socket frame field `password` OR O_EXCL 0600 tmpfile under /run/kwizera/mt5-hfm/",
    neverArgvEnvShell: true,
    zeroizeAfterUse: "overwrite Buffer/string copies before drop; shred tmpfile with unlink",
    logging: "never log password, Authorization, or raw frames",
    demoOnly: "agent accepts environment=demo only while live-gate is locked",
  },
  secretRedaction: {
    logs: "structured JSON with redaction of password/token/hmac fields",
    errors: "generic codes to client; details only in local agent journal without secrets",
    crashDumps: "disable core dumps for agent process (LimitCORE=0)",
  },
  privilegeBoundary: {
    user: "mt5",
    noNewPrivileges: true,
    privateTmp: true,
    protectSystem: "strict",
    protectHome: "read-only except /home/mt5/.wine-hfm",
    readWritePaths: ["/home/mt5/.wine-hfm", "/run/kwizera", "/home/mt5/.mt5-xauth"],
    noShellExec: "no /bin/sh, no wine cmd.exe /c with interpolated secrets; allowlist Wine binary path only",
    wineBinary: "/opt/wine-staging/bin/wine",
    winePrefix: "/home/mt5/.wine-hfm",
    display: ":97 with XAUTHORITY=/home/mt5/.mt5-xauth/Xauthority",
  },
  capabilityAllowlist: {
    methods: [
      "health",
      "demo.login",
      "demo.account_snapshot",
      "demo.quotes_snapshot",
      "demo.logout",
    ],
    forbidden: [
      "live.*",
      "order.*",
      "ea.*",
      "shell.exec",
      "file.write_arbitrary",
      "wine.prefix_recreate",
    ],
  },
  demoTerminalOnly: {
    requirePortableTerminal:
      "/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/terminal64.exe",
    rejectAlternatePrefixes: true,
    rejectLiveServerNames: true,
    enforceLiveGate: "agent must refuse environment=live while LIVE_ACTIVATION_LOCKED",
  },
} as const;

export interface Mt5HfmBridgeSecurityAuditSummary {
  status: typeof MT5_HFM_BRIDGE_SECURITY_STATUS;
  socketPath: typeof MT5_HFM_AGENT_SOCKET_PATH;
  publicTcpForbidden: true;
  implementationAllowed: false;
  note: string;
}

/** Public summary for status APIs / Admin UI — no secrets. */
export function mt5HfmBridgeSecurityAuditSummary(): Mt5HfmBridgeSecurityAuditSummary {
  return {
    status: MT5_HFM_BRIDGE_SECURITY_STATUS,
    socketPath: MT5_HFM_AGENT_SOCKET_PATH,
    publicTcpForbidden: true,
    implementationAllowed: false,
    note:
      "Unix-socket Demo agent is implemented in-repo. Do not enable systemd units or deploy the agent until owner approval. Public TCP remains forbidden.",
  };
}
