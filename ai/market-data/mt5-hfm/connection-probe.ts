/**
 * Safe HFM Demo connectivity probe — DNS/TCP only.
 * Never accepts or transmits passwords. Does not talk to the Wine MT5 process.
 *
 * Full terminal login requires a future authenticated localhost agent under
 * Linux user `mt5` (see Phase 2 report VPS communication design). That agent
 * must receive secrets over a restricted local socket / file descriptor, never
 * via process argv or shell interpolation.
 */
import net from "node:net";
import dns from "node:dns/promises";

export interface HfmDemoEndpoint {
  host: string;
  port: number;
}

/** Official HFMarketsGlobal-Demo hosts (public HFM docs). */
export const HFM_GLOBAL_DEMO_ENDPOINTS: readonly HfmDemoEndpoint[] = [
  { host: "mt5-europe1.dcglobalfarm.com", port: 1950 },
  { host: "mt5-europe2.dcglobalfarm.com", port: 1950 },
  { host: "mt5-asia1.dcglobalfarm.com", port: 1950 },
  { host: "mt5-samerica.dcglobalfarm.com", port: 1950 },
  { host: "mt5-asia7.dcglobalfarm.com", port: 1950 },
  { host: "mt5-asia8.dcglobalfarm.com", port: 1950 },
];

export const HFM_GLOBAL_DEMO3_ENDPOINTS: readonly HfmDemoEndpoint[] = [
  { host: "mt5-global3.dcglobalfarm.com", port: 40305 },
  { host: "mt5-global3.dcglobalfarm.com", port: 40306 },
];

export function endpointsForDemoServer(server: string): readonly HfmDemoEndpoint[] {
  const s = server.trim().toLowerCase();
  if (s.includes("demo3")) return HFM_GLOBAL_DEMO3_ENDPOINTS;
  if (s.includes("demo4")) {
    // Demo4 hosts vary by region; probe Global-Demo fleet as reachability smoke.
    return HFM_GLOBAL_DEMO_ENDPOINTS;
  }
  // Default / Global-Demo / SC-Demo / generic Demo names → Global Demo ports.
  return HFM_GLOBAL_DEMO_ENDPOINTS;
}

function tcpConnect(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export interface DemoProbeResult {
  ok: boolean;
  status: "demo_network_reachable" | "demo_network_unreachable" | "demo_dns_failed";
  server: string;
  checked: Array<{ host: string; port: number; open: boolean; ip: string | null }>;
  openCount: number;
  summary: string;
  mt5TerminalLogin: "not_verified";
  accountSync: "not_verified";
  note: string;
}

export async function probeHfmDemoNetwork(
  server: string,
  options?: { timeoutMs?: number; maxEndpoints?: number },
): Promise<DemoProbeResult> {
  const timeoutMs = options?.timeoutMs ?? 2500;
  const maxEndpoints = options?.maxEndpoints ?? 4;
  const endpoints = endpointsForDemoServer(server).slice(0, maxEndpoints);
  const checked: DemoProbeResult["checked"] = [];

  for (const ep of endpoints) {
    let ip: string | null = null;
    try {
      const addrs = await dns.lookup(ep.host, { all: true });
      ip = addrs[0]?.address ?? null;
    } catch {
      checked.push({ host: ep.host, port: ep.port, open: false, ip: null });
      continue;
    }
    const open = await tcpConnect(ep.host, ep.port, timeoutMs);
    checked.push({ host: ep.host, port: ep.port, open, ip });
  }

  const openCount = checked.filter((c) => c.open).length;
  const dnsFailed = checked.length > 0 && checked.every((c) => c.ip === null);
  let status: DemoProbeResult["status"];
  if (dnsFailed) status = "demo_dns_failed";
  else if (openCount > 0) status = "demo_network_reachable";
  else status = "demo_network_unreachable";

  return {
    ok: openCount > 0,
    status,
    server,
    checked,
    openCount,
    summary: `${openCount}/${checked.length} Demo endpoints open for server ${server}`,
    mt5TerminalLogin: "not_verified",
    accountSync: "not_verified",
    note:
      "Network probe only. MT5 Demo account login and balance sync require the approved local mt5 agent (not implemented).",
  };
}
