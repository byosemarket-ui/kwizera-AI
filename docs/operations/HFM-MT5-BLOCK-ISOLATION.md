# HFM MT5 Block Isolation Register

**Purpose:** Temporary operational pause of independently verified non-HFM workloads so HFM MT5 remains the exclusive active development block on the VPS.

**This is not:** code deletion, database wipe, configuration destruction, or permanent deactivation.

**Active development block:** HFM MT5 (Charts / Analysis / MIF evidence / prediction phases 01–09).

**Document rule:** No secrets, tokens, passwords, or `.env` values.

---

## Snapshot (initial isolation)

| Field | Value |
|---|---|
| Isolation planned | 2026-11-23 (UTC) |
| Baseline Phase 03 SHA | `43c974846cf324d0cbd66caf062ea1c669c9eaa6` |
| VPS host | Ubuntu VPS via `ssh kwizera-vps` |
| Pre-isolation MT5 PID | `17878` (record live PID at pause time) |

---

## Classification summary

| Classification | Examples |
|---|---|
| HFM_MT5_CORE | `kwizera-mt5-xvfb`, `kwizera-mt5-hfm-demo`, `kwizera-mt5-hfm-agent`, HFM APIs, Charts UI |
| HFM_MT5_DEPENDENCY | `kwizera-ai.service` (hosts HFM routes), analysis/reasoning, OpenAI vault paths |
| SHARED_PLATFORM_DEPENDENCY | Production gateway, AI Core child process, admin auth, storage root, Dropbear deploy SSH |
| OTHER_INDEPENDENT_BLOCK | `kwizera-forexconnect.service`, Binance/FXCM providers (in-process), Forex monitor sessions, creative studio workloads (in-process) |
| UNKNOWN_DEPENDENCY | Full creative/AI manager boot inside Core (cannot isolate without code change) |

---

## Components kept running (and why)

| Component | Why kept |
|---|---|
| `kwizera-ai.service` | Shared Core hosts HFM HTTP APIs + UI; stopping it stops HFM |
| `kwizera-mt5-xvfb.service` | Required for Wine MT5 display |
| `kwizera-mt5-hfm-demo.service` | HFM terminal |
| `kwizera-mt5-hfm-agent.service` | Market-data AF_UNIX agent |
| `kwizera-mt5-hfm-watchdog.timer` | Terminal health / re-login |
| `kwizera-dropbear.service` | Deploy SSH on :2222 (ops) |
| sshd / systemd-resolved / chrony | Host infrastructure |

In-process OTHER blocks (Binance routes, forex-monitor, creative managers) share the Core child. They are **not** separately stoppable without an architectural split. They remain idle unless invoked; OD worker and Auto Analysis stay disabled by default/policy.

---

## Paused blocks register

### 1) ForexConnect sidecar

| Field | Value |
|---|---|
| Block | ForexConnect (FXCM SDK bridge) |
| Classification | OTHER_INDEPENDENT_BLOCK |
| Service | `kwizera-forexconnect.service` |
| Listen | `127.0.0.1:5179` |
| Required by HFM MT5? | **No** (HFM uses MT5 agent, not ForexConnect) |
| Reason paused | Independent RAM/CPU consumer during HFM-focused development |
| Data/config intact? | Yes — unit file, venv, code, env untouched |
| Stop procedure | `systemctl stop kwizera-forexconnect.service` then `systemctl disable kwizera-forexconnect.service` |
| Restore procedure | `systemctl enable --now kwizera-forexconnect.service` then verify `ss -lntp \| grep 5179` and ForexConnect admin health |
| Verification after pause | `systemctl is-active kwizera-ai.service` = active; MT5 `terminal64` still running; `curl` HFM quote OK |
| Notes | Do **not** `docker compose down` (no Docker). Do **not** kill Node broadly. |

---

## Workers already inactive (confirm; do not enable)

| Worker | Control | Expected state |
|---|---|---|
| MIF Opportunity Detector | Admin API enable/disable; default off | Disabled |
| HFM Auto Analysis | Persisted scheduler + disable API | OFF |
| Economic calendar live | Policy gates / unset env | Disabled by policy |
| Charts probability | Orchestration `skipProbability: true` | NOT_AVAILABLE |

---

## HFM MT5 dependency map (required path)

```
HFM MT5 terminal (Wine)
  → MT5 agent (AF_UNIX)
  → kwizera-ai Core (mt5-hfm APIs)
  → Market snapshot / candles
  → MIF orchestration (ranking/evidence; skipProbability)
  → Unified AI input
  → OpenAI reasoning (when Analyze Now)
  → Prediction bridge (P8.A)
  → Charts UI
```

Optional (not required for isolation): outcome evaluate APIs, calibration census, Admin performance analytics.

---

## Restoration checklist (any paused unit)

1. Confirm HFM still healthy before restore.
2. Run the exact restore command for that unit.
3. Confirm listen ports / health.
4. Confirm MT5 PID unchanged (or document intentional restart).
5. Confirm OD / Auto Analysis still disabled unless intentionally enabled.
6. Update this register with restore timestamp.

---

## Safety

- No broker order submission.
- No Execution Master / emergency-lock changes.
- No HFM account configuration changes.
- No Binance-as-Forex-fallback introduction.
- No deletion of unrelated block source, volumes, or databases.
