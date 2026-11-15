# Phase 4 rollback

Use before or after installing MT5 lifecycle units. Does **not** touch Wine prefix,
MT5 install, account data, `kwizera-ai`, or `kwizera-forexconnect`.

## If units were copied but never enabled

```bash
sudo systemctl disable --now kwizera-mt5-hfm-agent.service 2>/dev/null || true
sudo systemctl disable --now kwizera-mt5-hfm-demo.service 2>/dev/null || true
sudo systemctl disable --now kwizera-mt5-xvfb.service 2>/dev/null || true
sudo systemctl disable kwizera-mt5-hfm.target 2>/dev/null || true
sudo rm -f /etc/systemd/system/kwizera-mt5-xvfb.service \
           /etc/systemd/system/kwizera-mt5-hfm-demo.service \
           /etc/systemd/system/kwizera-mt5-hfm-agent.service \
           /etc/systemd/system/kwizera-mt5-hfm.target
sudo systemctl daemon-reload
```

Restore any backup copies from `/root/kwizera-mt5-lifecycle-backup-<timestamp>/` if present.

## If units were started (controlled cutover)

1. Stop new units only (order: agent → demo → xvfb):

```bash
sudo systemctl stop kwizera-mt5-hfm-agent.service 2>/dev/null || true
sudo systemctl stop kwizera-mt5-hfm-demo.service 2>/dev/null || true
sudo systemctl stop kwizera-mt5-xvfb.service 2>/dev/null || true
```

2. Disable and remove unit files as above.

3. Optionally restore the previous manual session (owner-operated), without reboot:

```bash
# Example — owner must confirm; do not broad-pkill other Wine apps
sudo -u mt5 env HOME=/home/mt5 WINEPREFIX=/home/mt5/.wine-hfm \
  DISPLAY=:97 XAUTHORITY=/home/mt5/.mt5-xauth/Xauthority \
  /opt/wine-staging/bin/wine \
  "/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/terminal64.exe" /portable &
```

(Start Xvfb first if `:97` is down.)

## Preserve always

- `/home/mt5/.wine-hfm` (entire prefix)
- HFM `terminal64.exe` and Config/Bases/Profiles
- `/opt/wine-staging`
- `kwizera-ai.service` / `kwizera-forexconnect.service` (do not restart as part of rollback)

## Do not

- `pkill wine` / `pkill wineserver` without prefix scope
- Delete the Wine prefix
- Reboot the VPS as a rollback shortcut without a maintenance plan
