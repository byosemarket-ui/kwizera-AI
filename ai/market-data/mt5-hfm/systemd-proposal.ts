/**
 * Corrected Xvfb + HFM MT5 systemd proposal (NOT installed / NOT enabled).
 *
 * Do not kill a working Xvfb :97 during migration without an explicit plan.
 * Do not ExecStartPre a foreground Xvfb (blocks the main process).
 */

export const MT5_HFM_SYSTEMD_PROPOSAL_STATUS = "proposal_only" as const;

export const MT5_HFM_XVFB_UNIT_PROPOSAL = `
# /etc/systemd/system/kwizera-mt5-xvfb.service  — PROPOSAL ONLY
[Unit]
Description=KWIZERA HFM MT5 Xvfb display :97
After=network-online.target

[Service]
Type=simple
User=mt5
Group=mt5
UMask=0077
Environment=HOME=/home/mt5
ExecStartPre=/usr/bin/mkdir -p /home/mt5/.mt5-xauth
ExecStartPre=/usr/bin/bash -c 'test -f /home/mt5/.mt5-xauth/Xauthority || touch /home/mt5/.mt5-xauth/Xauthority'
# Start Xvfb as the main process (not ExecStartPre).
# Only bind :97 if free — wrapper should exit non-zero if display busy (do not pkill).
ExecStart=/usr/bin/Xvfb :97 -screen 0 1600x900x24 -nolisten tcp -auth /home/mt5/.mt5-xauth/Xauthority
Restart=on-failure
RestartSec=5
MemoryMax=256M
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`.trim();

export const MT5_HFM_TERMINAL_UNIT_PROPOSAL = `
# /etc/systemd/system/kwizera-mt5-hfm-demo.service  — PROPOSAL ONLY
[Unit]
Description=HFM MT5 Demo terminal (Wine, user mt5)
After=network-online.target kwizera-mt5-xvfb.service
Requires=kwizera-mt5-xvfb.service
# Keep independent of kwizera-ai / kwizera-forexconnect

[Service]
Type=simple
User=mt5
Group=mt5
UMask=0077
WorkingDirectory=/home/mt5
Environment=HOME=/home/mt5
Environment=USER=mt5
Environment=LOGNAME=mt5
Environment=WINEPREFIX=/home/mt5/.wine-hfm
Environment=WINEARCH=win64
Environment=WINEDEBUG=-all
Environment=DISPLAY=:97
Environment=XAUTHORITY=/home/mt5/.mt5-xauth/Xauthority
Environment=PATH=/opt/wine-staging/bin:/usr/bin:/bin
ExecStart=/opt/wine-staging/bin/wine "/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/terminal64.exe" /portable
ExecStop=/opt/wine-staging/bin/wineserver -k
Restart=on-failure
RestartSec=15
TimeoutStopSec=30
MemoryMax=1G
CPUQuota=80%
Nice=5
NoNewPrivileges=true
PrivateTmp=true
# Do not pkill Xvfb from this unit.

[Install]
WantedBy=multi-user.target
`.trim();

export const MT5_HFM_AGENT_UNIT_PROPOSAL_PATH =
  "services/mt5-hfm-agent/kwizera-mt5-hfm-agent.service.proposal" as const;

export function mt5HfmSystemdProposalSummary(): {
  status: typeof MT5_HFM_SYSTEMD_PROPOSAL_STATUS;
  installed: false;
  enabled: false;
  units: string[];
  note: string;
} {
  return {
    status: MT5_HFM_SYSTEMD_PROPOSAL_STATUS,
    installed: false,
    enabled: false,
    units: [
      "kwizera-mt5-xvfb.service",
      "kwizera-mt5-hfm-demo.service",
      "kwizera-mt5-hfm-agent.service",
    ],
    note:
      "Separate Xvfb, MT5 terminal, and Demo agent units proposed. Do not install/enable; do not kill working Xvfb :97 without a migration plan.",
  };
}
