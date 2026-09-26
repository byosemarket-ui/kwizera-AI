/**
 * Phase 17 — controlled retrieval for knowledge sources.
 *
 * One URL per job, explicitly registered by an operator or the owner of a
 * project. No link following, no crawling. Every hop (including redirects)
 * is re-validated, DNS answers are checked against private ranges and the
 * connection is pinned to the checked address, robots.txt is honoured, and
 * responses are size/time bounded.
 */
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { promises as dns } from "node:dns";
import type { KnowledgeFetcher, KnowledgeFetchResult } from "../../ai/knowledge-acquisition-engine/knowledge-pipeline.js";
import { TRUSTED_SOURCE_LIBRARY } from "../../ai/knowledge-source-manager/trusted-knowledge-source-library.js";

export const KNOWLEDGE_USER_AGENT = "KWIZERA-AI-STUDIO-Knowledge/1.0 (single-document reference retrieval)";
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MIN_HOST_INTERVAL_MS = 5_000;
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;
const ACCEPTED_TYPES = /^(text\/html|text\/plain|text\/markdown|application\/xhtml\+xml|application\/json)/i;

export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  if (family === 6) {
    const v = address.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]);
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return true;
}

export function isOfficialKnowledgeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return TRUSTED_SOURCE_LIBRARY.some((entry) => {
    try {
      const u = new URL(entry.definition.location.value);
      return u.hostname === h || h.endsWith(`.${u.hostname}`);
    } catch {
      return false;
    }
  });
}

export function validateKnowledgeUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Local hosts are not allowed");
  }
  if (net.isIP(host) && isBlockedAddress(host)) throw new Error("Private network addresses are not allowed");
  return url;
}

async function resolvePublic(hostname: string): Promise<{ address: string; family: number }> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new Error("Private network addresses are not allowed");
    return { address: host, family: net.isIP(host) };
  }
  const answers = await dns.lookup(host, { all: true, verbatim: true });
  if (!answers.length) throw new Error("Host did not resolve");
  if (answers.some((a) => isBlockedAddress(a.address))) throw new Error("Host resolves to a private network address");
  return answers[0];
}

interface RawResponse { status: number; contentType: string; location: string | null; body: string; tooLarge: boolean }

async function requestOnce(url: URL, timeoutMs: number): Promise<RawResponse> {
  const pinned = await resolvePublic(url.hostname);
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(url, {
      timeout: timeoutMs,
      headers: { "User-Agent": KNOWLEDGE_USER_AGENT, Accept: "text/html,text/plain,text/markdown;q=0.9,*/*;q=0.1" },
      lookup: (_host, _opts, cb) => (cb as (err: Error | null, address: string, family: number) => void)(null, pinned.address, pinned.family),
    }, (res) => {
      const status = res.statusCode ?? 0;
      const contentType = String(res.headers["content-type"] ?? "");
      const location = typeof res.headers.location === "string" ? res.headers.location : null;
      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, contentType, location, body: "", tooLarge: false });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      res.on("data", (chunk: Buffer) => {
        if (done) return;
        size += chunk.length;
        if (size > MAX_BYTES) {
          done = true;
          req.destroy();
          resolve({ status, contentType, location, body: "", tooLarge: true });
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        if (done) return;
        done = true;
        resolve({ status, contentType, location, body: Buffer.concat(chunks).toString("utf8"), tooLarge: false });
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function followRedirects(start: URL, timeoutMs: number): Promise<{ res: RawResponse; finalUrl: URL }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await requestOnce(current, timeoutMs);
    if (res.status >= 300 && res.status < 400 && res.location) {
      current = validateKnowledgeUrl(new URL(res.location, current).toString());
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new Error("Too many redirects");
}

/** Minimal robots.txt evaluation for our user agent (longest-match Allow/Disallow). */
export function robotsAllows(robotsTxt: string, pathWithQuery: string, agent = "kwizera-ai-studio-knowledge"): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === "allow" || field === "disallow") && current) {
      lastWasAgent = false;
      if (field === "disallow" && !value) continue;
      current.rules.push({ allow: field === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; len: number } | null = null;
  for (const rule of applicable.flatMap((g) => g.rules)) {
    const pattern = rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const anchored = pattern.endsWith("\\$") ? `${pattern.slice(0, -2)}$` : pattern;
    if (new RegExp(`^${anchored}`).test(pathWithQuery)) {
      const len = rule.path.length;
      if (!best || len > best.len || (len === best.len && rule.allow)) best = { allow: rule.allow, len };
    }
  }
  return best ? best.allow : true;
}

export function createKnowledgeFetcher(options: { timeoutMs?: number; minHostIntervalMs?: number } = {}): KnowledgeFetcher {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const minInterval = options.minHostIntervalMs ?? MIN_HOST_INTERVAL_MS;
  const lastHit = new Map<string, number>();
  const robotsCache = new Map<string, { at: number; text: string | null }>();

  const throttle = async (host: string) => {
    const wait = (lastHit.get(host) ?? 0) + minInterval - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(host, Date.now());
  };

  const robotsFor = async (url: URL): Promise<string | null> => {
    const key = url.origin;
    const cached = robotsCache.get(key);
    if (cached && Date.now() - cached.at < ROBOTS_TTL_MS) return cached.text;
    let text: string | null = null;
    try {
      const { res } = await followRedirects(new URL("/robots.txt", url.origin), timeoutMs);
      if (res.status >= 200 && res.status < 300 && !res.tooLarge) text = res.body;
      else if (res.status >= 500) text = "User-agent: *\nDisallow: /";
    } catch {
      text = null;
    }
    robotsCache.set(key, { at: Date.now(), text });
    return text;
  };

  return async (rawUrl: string): Promise<KnowledgeFetchResult> => {
    const failure = (errorCode: string, message: string, status = 0): KnowledgeFetchResult => ({
      ok: false, status, contentType: "", body: "", finalUrl: rawUrl, errorCode, message,
    });
    let url: URL;
    try {
      url = validateKnowledgeUrl(rawUrl);
    } catch (err) {
      return failure("URL_NOT_ALLOWED", err instanceof Error ? err.message : "URL not allowed");
    }
    try {
      await throttle(url.hostname);
      const robots = await robotsFor(url);
      if (robots && !robotsAllows(robots, `${url.pathname}${url.search}`)) {
        return failure("ROBOTS_DISALLOWED", "The site's robots.txt does not allow retrieving this page.");
      }
      const { res, finalUrl } = await followRedirects(url, timeoutMs);
      if (res.tooLarge) return failure("TOO_LARGE", "The document exceeds the retrieval size limit.", res.status);
      if (res.status === 401 || res.status === 403) {
        return failure("ACCESS_RESTRICTED", "The page requires authorization; restricted content is not retrieved.", res.status);
      }
      if (res.status < 200 || res.status >= 300) return failure("HTTP_ERROR", `The server responded with status ${res.status}.`, res.status);
      if (res.contentType && !ACCEPTED_TYPES.test(res.contentType)) {
        return failure("UNSUPPORTED_FORMAT", "Only HTML and plain-text documents can be retrieved.", res.status);
      }
      return { ok: true, status: res.status, contentType: res.contentType || "text/html", body: res.body, finalUrl: finalUrl.toString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retrieval failed";
      return failure(/private|local/i.test(message) ? "URL_NOT_ALLOWED" : "RETRIEVAL_FAILED", message);
    }
  };
}
