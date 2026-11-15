/**
 * PHASE 3.1 — Architecture & threat model for HFM MT5 Demo Agent Bridge.
 *
 * INTEGRATION MECHANISM (verified from MetaQuotes docs + Wine ops practice):
 * - Official: `terminal64.exe /portable /config:<ini>` with [Common] Login/Server/Password.
 * - Password must NOT be passed on argv as a bare secret beyond the config path.
 * - Linux native `MetaTrader5` Python wheel does NOT run on Linux hosts directly.
 * - Wine+Windows-Python MetaTrader5 is a future optional enhancer, not required for login.
 * - Account/market fields are sourced from terminal journal + process state after login;
 *   fields that cannot be proven are returned null with explicit not_verified flags.
 *
 * TRUST BOUNDARY:
 * - Browser → KWIZERA Node (admin token) → AF_UNIX agent (HMAC+peercred) → Wine MT5 (mt5 user)
 * - Live vault is never opened on this path.
 *
 * THREATS & CONTROLS:
 * - Socket exposure → AF_UNIX only, 0660 mt5:kwizera, no TCP
 * - Peer spoofing → SO_PEERCRED uid allowlist
 * - Stolen socket access → per-request HMAC with vault agent token + replay window
 * - Credential leakage → framed in-memory delivery; ephemeral 0600 tmpfs INI shredded; no logs
 * - Live misuse → server/env allowlists + live-gate; reject live.* methods
 * - Command injection → operation allowlist; no shell; fixed wine binary path
 * - DoS → max frame size, timeouts, rate-ish nonce cache bounds
 * - Agent crash → separate systemd unit; must not BindsTo kwizera-ai
 */

export const MT5_HFM_THREAT_MODEL_STATUS = "documented" as const;

export const MT5_HFM_INTEGRATION_MECHANISM = {
  primary: "mt5_config_portable_login",
  rejected: ["linux_native_metatrader5_python", "public_tcp_control", "browser_to_wine"],
  optionalFuture: ["wine_windows_python_metatrader5_package"],
  loginCommandShape:
    "/opt/wine-staging/bin/wine terminal64.exe /portable /config:Z:\\run\\kwizera\\mt5-hfm\\login-<id>.ini",
  note:
    "Password lives only inside the ephemeral INI on tmpfs (mode 0600), never in process argv as a discrete password flag.",
} as const;

export function mt5HfmThreatModelSummary() {
  return {
    status: MT5_HFM_THREAT_MODEL_STATUS,
    mechanism: MT5_HFM_INTEGRATION_MECHANISM.primary,
    liveForbidden: true,
    ordersForbidden: true,
    publicTcpForbidden: true,
  };
}
