# Phase 4 read-only VPS audit

Host: `vps3582854.trouble-free.net`  
Audit time: 2026-11-15 (UTC+2 session)  
Method: `ssh kwizera-vps` — **read-only** (no kills, no systemd changes, no reboot)

## Phase 3 Agent Bridge

| Check | Result |
|-------|--------|
| Code in git (`c5a33c1f`) | **IMPLEMENTED** |
| Files on VPS `/opt/kwizera-ai/services/mt5-hfm-agent/` | **DEPLOYED** (on disk) |
| `agent.py` present | yes |
| systemd unit installed/enabled | **NO** |
| `/run/kwizera` / AF_UNIX socket | **absent** |
| Agent process running | **NO** |
| Operational login path verified | **NOT VERIFIED** |

Conclusion: Phase 3 is **implemented and present on the VPS disk**, but **not enabled / not operationally verified**. Phase 4 therefore authors a real `kwizera-mt5-hfm-agent.service` (not a dummy) and leaves it **disabled** pending token bootstrap + approval.

## Process inventory (at audit)

| PID | User | RSS | Note |
|-----|------|-----|------|
| 1555195 | mt5 | ~21 MiB | `Xvfb :97` (~4h45m uptime) |
| 1555206 | mt5 | ~49 MiB | `terminal64.exe /portable` |
| 1555208 | mt5 | ~2.5 MiB | wineserver (prefix `.wine-hfm`) |
| 1566044 | kwizera | ~643 MiB | `kwizera-ai.service` active |
| 1565974 | kwizera | ~43 MiB | `kwizera-forexconnect.service` active |

Also: root-owned `sudo -u mt5` wrapper PIDs still present from the manual leave-running launch.

## Host resources (before Phase 4 enablement)

- 1 CPU, load ~0.3–0.9
- RAM 3.3 GiB — used ~823 MiB, available ~2.5 GiB
- Swap 1.0 GiB — used ~292 MiB
- Disk `/` ~33% of 77G

## Installation facts

| Item | Value |
|------|-------|
| User `mt5` | uid 1000 |
| User `kwizera` | uid 999 |
| Wine | `/opt/wine-staging/bin/wine` → **wine-11.22 (Staging)** |
| Prefix | `/home/mt5/.wine-hfm` owned by `mt5` |
| Terminal | present; launched with **`/portable`** (working) |
| `origin.txt` | not present (portable still in use successfully) |
| Xauthority | exists, **0 bytes**, mode **0644** (needs cookie + 0600 on cutover) |
| MT5 systemd units | **none installed** |

## Listeners

- `127.0.0.1:22346` — wineserver (MT5 MCP-style local port; localhost only)
- No MT5 agent Unix socket
- KWIZERA ports unchanged (`5173`/`5174`/`5179`)

## After Phase 4 code change (repo only)

Resource usage **after** systemd enablement: **NOT VERIFIED** (units not installed/started).
