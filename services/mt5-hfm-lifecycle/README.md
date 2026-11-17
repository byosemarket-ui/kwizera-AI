# HFM MT5 Demo lifecycle (Phase 4)

Systemd units and helpers for **automatic start/recovery** of the existing HFM MT5 Demo
terminal on the Ubuntu VPS. Demo-only. No Live login. No trading activation.

## Status

| Item | State |
|------|--------|
| Unit files in repo | **IMPLEMENTED** (authored) |
| Installed under `/etc/systemd/system` | **Xvfb + demo + watchdog + agent** (incident restore) |
| Auto-start after boot | **Xvfb + demo + watchdog timer enabled**; agent remains disabled-on-boot unless already active |
| Watchdog | `kwizera-mt5-hfm-watchdog.timer` re-logins Demo via vault if `terminal64` missing **or** MQL snapshot stale (>180s) |
| Cutover | `bin/cutover-mt5-to-systemd.sh` — refuses unless `CONFIRM=YES-CUTOVER` (owner approval) |
| VPS reboot test | **NOT VERIFIED** (do not reboot without separate approval) |
| Phase 3 agent unit | Installed; token provisioned; keep soft `Wants=` on demo |

## Units

```
kwizera-mt5-xvfb.service       → Xvfb :97 + Xauthority cookie
kwizera-mt5-hfm-demo.service   → Wine Staging terminal64 /portable (Requires Xvfb)
kwizera-mt5-hfm-agent.service  → AF_UNIX Demo agent (Requires Demo terminal)
kwizera-mt5-hfm.target         → optional grouping (Wants xvfb + demo)
```

### Dependency graph

```
network-online.target
        │
        ▼
kwizera-mt5-xvfb.service
        │  Requires + After
        ▼
kwizera-mt5-hfm-demo.service
        │  Requires + After  (agent only)
        ▼
kwizera-mt5-hfm-agent.service
```

**Independent of** `kwizera-ai.service` and `kwizera-forexconnect.service`
(no `Requires=`, `BindsTo=`, or `PartOf=` either direction).

## Preserve existing install

| Asset | Path |
|-------|------|
| Wine Staging | `/opt/wine-staging/bin/wine` (11.22) |
| Prefix | `/home/mt5/.wine-hfm` |
| Terminal | `.../HFM Metatrader 5/terminal64.exe` |
| Display | `:97` |
| Xauth | `/home/mt5/.mt5-xauth/Xauthority` |

Do **not** reinstall MT5, recreate the prefix, or delete account data.

## Migration (controlled — not a reboot)

Manual Xvfb/MT5 are currently running outside systemd. Enabling these units while `:97`
is busy will **fail the Xvfb unit** (intentional — no `pkill`).

Approved cutover:

1. Copy unit files + scripts to `/opt/kwizera-ai` via normal deploy.
2. `sudo cp ... /etc/systemd/system/` and `daemon-reload` (units still disabled).
3. In a maintenance window: stop **only** the manual `terminal64` then manual `Xvfb :97`
   (SIGTERM those PIDs — no broad Wine pkill).
4. `systemctl start kwizera-mt5-xvfb.service`
5. `systemctl start kwizera-mt5-hfm-demo.service`
6. Verify process + SSH disconnect survival.
7. Only then consider `systemctl enable` (still no VPS reboot without separate plan).
8. Agent: provision token file → start agent unit separately.

## Rollback

See [ROLLBACK.md](./ROLLBACK.md).

## Security

- Run as Linux user `mt5`, never root for Wine/Xvfb/agent main processes.
- Xauthority `0600`, directory `0700`.
- Agent socket `0660` `mt5:kwizera`; token file `0640` — values never in unit `Environment=`.
- No public TCP for the agent. No passwords in argv or journals by design.
- Stop script uses `WINEPREFIX`-scoped `wineserver -k` only for `/home/mt5/.wine-hfm`.

## Resource limits (≈1 CPU / 3.3 GiB)

| Unit | MemoryMax | CPUQuota | RestartSec |
|------|-----------|----------|------------|
| xvfb | 256M | 20% | 10s |
| demo | 1G | 70% | 20s |
| agent | 128M | 20% | 10s |

`StartLimitBurst=3` / `StartLimitIntervalSec=300` on each service.
