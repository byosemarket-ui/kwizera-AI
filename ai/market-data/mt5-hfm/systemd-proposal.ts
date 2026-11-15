/**
 * Phase 4 HFM MT5 systemd lifecycle — unit files authored in-repo.
 *
 * Status: units IMPLEMENTED in services/mt5-hfm-lifecycle/
 *         NOT installed / NOT enabled on the VPS until owner approval.
 *
 * Do not kill a working Xvfb :97 during migration without the cutover plan in README.md.
 * Do not ExecStartPre a foreground Xvfb (blocks the main process).
 */

export const MT5_HFM_SYSTEMD_PROPOSAL_STATUS =
  "phase4_units_authored_not_enabled" as const;

/** @deprecated legacy string retained for older tests/docs — prefer MT5_HFM_SYSTEMD_PROPOSAL_STATUS */
export const MT5_HFM_SYSTEMD_LEGACY_PROPOSAL_MARKER = "proposal_only" as const;

export const MT5_HFM_LIFECYCLE_DIR = "services/mt5-hfm-lifecycle" as const;

export const MT5_HFM_LIFECYCLE_UNITS = [
  "kwizera-mt5-xvfb.service",
  "kwizera-mt5-hfm-demo.service",
  "kwizera-mt5-hfm-agent.service",
  "kwizera-mt5-hfm.target",
] as const;

export const MT5_HFM_XVFB_UNIT_PATH =
  `${MT5_HFM_LIFECYCLE_DIR}/kwizera-mt5-xvfb.service` as const;
export const MT5_HFM_TERMINAL_UNIT_PATH =
  `${MT5_HFM_LIFECYCLE_DIR}/kwizera-mt5-hfm-demo.service` as const;
export const MT5_HFM_AGENT_UNIT_PATH =
  `${MT5_HFM_LIFECYCLE_DIR}/kwizera-mt5-hfm-agent.service` as const;

export const MT5_HFM_AGENT_UNIT_PROPOSAL_PATH =
  "services/mt5-hfm-agent/kwizera-mt5-hfm-agent.service.proposal" as const;

export function mt5HfmSystemdProposalSummary(): {
  status: typeof MT5_HFM_SYSTEMD_PROPOSAL_STATUS;
  installed: false;
  enabled: false;
  autoStart: false;
  units: string[];
  lifecycleDir: typeof MT5_HFM_LIFECYCLE_DIR;
  note: string;
} {
  return {
    status: MT5_HFM_SYSTEMD_PROPOSAL_STATUS,
    installed: false,
    enabled: false,
    autoStart: false,
    units: [...MT5_HFM_LIFECYCLE_UNITS],
    lifecycleDir: MT5_HFM_LIFECYCLE_DIR,
    note:
      "Phase 4 unit files authored under services/mt5-hfm-lifecycle. Do not install/enable without approval. Do not kill working Xvfb :97 without the migration plan. Agent unit is real (Phase 3 on disk) but must stay disabled until token + readiness.",
  };
}
