/**
 * HFM MT5 Demo login bridge — ARCHITECTURE ONLY (not implemented).
 *
 * Goal: allow the KWIZERA Node backend (user `kwizera`) to request a Demo login
 * against the already-running Wine/MT5 process under Linux user `mt5`, then
 * return non-secret account fields (balance, equity, leverage, currency).
 *
 * Approved constraints:
 * - Demo connection only until separate Live owner authorization.
 * - Live credentials may exist in vault (`mt5-hfm:live:password`) but must never
 *   be used by this bridge while live-gate remains fail-closed.
 * - No order placement, EA attach, or AT submit.
 * - Never put passwords in argv, shell, environment dumps, or logs.
 * - Do not expose a new unauthenticated public port.
 * - Browser must never talk to the VPS Wine stack directly.
 *
 * Proposed architecture (implement only after security review):
 *
 * 1. Local agent `services/mt5-hfm-agent/` running as `mt5` via systemd user or
 *    a dedicated unit (`kwizera-mt5-hfm-agent.service`).
 * 2. Agent listens on a Unix domain socket owned by `mt5:kwizera` mode 0660,
 *    path e.g. `/run/kwizera/mt5-hfm-agent.sock` (tmpfs), NOT TCP 0.0.0.0.
 * 3. Backend connects over the socket with a short-lived HMAC / shared token
 *    from AiSecretsManager (id `mt5-hfm:agent:token`), never the trading password.
 * 4. For login: backend decrypts Demo password in-process via AiSecretsManager,
 *    writes it once into an O_EXCL 0600 file under `/run/kwizera/mt5-hfm/` that
 *    the agent reads and shreds immediately, OR sends it in a single length-
 *    prefixed socket frame (preferred: socket frame; never argv).
 * 5. Agent drives the existing terminal via Wine UI automation / MT5 config
 *    update (UTF-16-LE aware) under `/home/mt5/.wine-hfm`, then reads Journal /
 *    account panels / portable config for public account fields.
 * 6. Agent returns JSON: `{ ok, account: { currency, balance, equity, ... } }`
 *    with no password. Backend persists snapshot into demo-profile metadata.
 *
 * Out of scope until approved: SSH from Node, public reverse tunnels, password
 * reveal APIs, Live credentials, systemd enablement of the MT5 terminal itself.
 */

export const MT5_HFM_LOGIN_BRIDGE_STATUS = "not_implemented" as const;

export interface Mt5HfmLoginBridgeAccountSnapshot {
  loginHint: string | null;
  server: string | null;
  currency: string | null;
  balance: number | null;
  equity: number | null;
  freeMargin: number | null;
  marginLevel: number | null;
  leverage: string | null;
  company: string | null;
  syncedAt: string;
}

export interface Mt5HfmLoginBridgeResult {
  ok: boolean;
  status: typeof MT5_HFM_LOGIN_BRIDGE_STATUS;
  account: Mt5HfmLoginBridgeAccountSnapshot | null;
  note: string;
}

/** Placeholder — always returns not_implemented. */
export async function requestMt5HfmDemoLoginBridge(): Promise<Mt5HfmLoginBridgeResult> {
  return {
    ok: false,
    status: MT5_HFM_LOGIN_BRIDGE_STATUS,
    account: null,
    note:
      "MT5 terminal login bridge is designed but not enabled. Test Connection performs DNS/TCP probe only.",
  };
}
