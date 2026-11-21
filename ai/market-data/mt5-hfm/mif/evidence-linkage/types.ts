import type { MifSafetyFlags } from "../canonical/types.js";
import type {
  MIF_EVIDENCE_LINKAGE_CONTRACT_ID,
  MIF_EVIDENCE_LINKAGE_CONTRACT_VERSION,
} from "./contracts.js";

export type MifEvidenceLinkageStatus =
  | "LINKED"
  | "LINKAGE_UNAVAILABLE"
  | "CONFLICT";

export interface MifEvidenceLinkageRecord extends MifSafetyFlags {
  contractId: typeof MIF_EVIDENCE_LINKAGE_CONTRACT_ID;
  contractVersion: typeof MIF_EVIDENCE_LINKAGE_CONTRACT_VERSION;
  linkageId: string;
  linkageHash: string;
  status: MifEvidenceLinkageStatus;
  statusReason: string | null;
  searchId: string | null;
  analogueId: string | null;
  predictionId: string | null;
  assessmentId: string | null;
  freezeId: string | null;
  providerId: "HFM_MT5";
  createdAt: string;
  sourceVersions: {
    searchHash?: string | null;
    snapshotHash?: string | null;
    freezeHash?: string | null;
  };
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  neverInferredFromProximity: true;
}
