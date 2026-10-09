# FXCM ForexConnect investigation (read-only market data)

**Date:** 2026-10-09  
**Scope:** Determine whether official ForexConnect can supply instruments / live quotes / historical candles to KWIZERA without the Socket REST access token.  
**Decision:** **Do not integrate ForexConnect into the existing Node.js production gateway.** Prefer enabling the existing Socket REST adapter.

## Official sources

- https://github.com/fxcm/ForexConnectAPI
- https://www.fxcm.com/markets/algorithmic-trading/api-trading/
- https://www.fxcm.com/uk/forms/eula/
- https://pypi.org/project/forexconnect/ (native Python wrapper)
- Socket REST (current KWIZERA path): https://fxcm-rest.readthedocs.io/en/latest/socketrestapispecs.html

## Does ForexConnect avoid the Socket REST token?

**Yes, for authentication mechanism.** ForexConnect logs in with:

| Parameter | Value |
|-----------|--------|
| URL | `www.fxcorporate.com/Hosts.jsp` |
| Username | FXCM Trading Station username |
| Password | FXCM Trading Station password |
| Connection | `demo` or `live` |
| SessionID / PIN | Optional / ignorable |

It does **not** use the Trading Station Web Socket REST access token.

## Official account / EULA / auth requirements

1. Sign the **FXCM Software EULA**: https://www.fxcm.com/uk/forms/eula/
2. Hold an **FXCM TSII / Trading Station** account (demo or live)
3. Download / install the **ForexConnect SDK** (native) from FXCM/Gehtsoft channels
4. Contact `api@fxcm.com` for API support questions
5. Personal-use / EULA compliance required

The Python package (`forexconnect`) is **Other/Proprietary License**, ships native binaries, and historically targets older Python (3.5–3.7) on Windows / Mac / CentOS 7 / Ubuntu 18.04 — not a pure HTTP client.

## SDK / runtime / VPS compatibility with KWIZERA

| Constraint | Evidence |
|------------|----------|
| Production gateway | Node.js systemd service (`kwizera-ai`), port 5173 |
| CI / deploy | GitHub Actions `ubuntu-latest` + Node 20; VPS deploy via SSH |
| Existing FXCM adapter | Official **Socket REST** (`api-demo.fxcm.com` / `api.fxcm.com`) + Socket.IO |
| ForexConnect languages | C++, C#, Java, VB/VBA, Python (native), mobile — **no official Node.js SDK** |
| Safe drop-in? | **No** — would require native libraries and/or a separate Java/Python sidecar process, IPC, and ops surface outside the current architecture |

Forcing ForexConnect into the Node gateway (node-gyp, child_process sidecar, or unofficial bindings) is an architectural rewrite and is **out of scope / unsafe** for this investigation.

## Comparison: ForexConnect vs current Socket REST

| | ForexConnect | Socket REST (current) |
|--|--------------|------------------------|
| Auth | Username / password | Trading Station Web **access token** |
| Protocol | Proprietary native SDK | HTTPS + Socket.IO |
| Node-friendly | No | Yes (already implemented) |
| Instruments | Yes | Yes (`/trading/get_instruments`) |
| Live prices | Yes | Yes (`/subscribe`) |
| Historical candles | Yes | Yes (`/candles/{offer_id}/{period_id}`) |
| Trading | Available in SDK | Explicitly disabled in KWIZERA |
| Live account REST | N/A (different API) | Official docs: Live REST access often requires emailing `api@fxcm.com` with username |

## Implementation status

**Not implemented.** No ForexConnect adapter was added. Trading execution remains disabled.

## Least-disruptive supported alternative

Keep the existing unified FXCM Socket REST provider and complete account access:

1. Sign EULA if not already signed.
2. **Demo path (fastest):** Trading Station Web → Token Management → set `KWIZERA_FXCM_ENABLED=1` and `KWIZERA_FXCM_ACCESS_TOKEN` on the VPS → restart → Admin → Test FXCM Authentication.
3. **Live path:** Email `api@fxcm.com` with the live username to request Socket REST enablement (per FXCM REST docs), then configure the same env vars with `KWIZERA_FXCM_ENVIRONMENT=real`.
4. Only after Socket REST works: Markets / Charts / Market State / AI consume FXCM through the existing unified MarketDataService (no Binance fallback).

Optional future (separate approved phase): a **read-only ForexConnect sidecar** (Python/Java) speaking HTTP to the Node gateway — not started here.

## Live connection test

**Not run.** No ForexConnect SDK was installed on the VPS, and Socket REST remains `FXCM_DISABLED` / unconfigured on production at investigation time.
