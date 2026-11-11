/**
 * Stage 1 — persisted LIVE spread observation evidence (read-only broker; no approvals).
 * Never invents samples. Never activates spread/slippage policies.
 */
import fs from "node:fs";
import path from "node:path";
import {
  STAGE3_TRACKED_INSTRUMENTS,
  type Stage3TrackedInstrument,
} from "./types.js";
import type { LiveSpreadObservationRecord } from "./spread-observation-collector.js";
import type { SlippageFillEvidenceRecord } from "./slippage-evidence.js";

export const STAGE1_EVIDENCE_STORE_SCHEMA = "kwizera.at-stage1-evidence-store.v1" as const;

export interface Stage1RejectedObservation {
  atUtc: string;
  instrument: string;
  code: string;
  message: string;
  bid: number | null;
  ask: number | null;
  observedAtUtc: string | null;
}

export interface Stage1EvidenceDocument {
  schemaVersion: typeof STAGE1_EVIDENCE_STORE_SCHEMA;
  updatedAtUtc: string;
  collectionStartedAtUtc: string | null;
  collectionLastTickAtUtc: string | null;
  acceptedByInstrument: Record<Stage3TrackedInstrument, LiveSpreadObservationRecord[]>;
  rejections: Stage1RejectedObservation[];
  /** Production BROKER_EXECUTION fills only — never synthetic. */
  slippageFillsByInstrument: Record<string, SlippageFillEvidenceRecord[]>;
  placesOrders: false;
  mutatesBroker: false;
  note: string;
}

function storageRoot(): string {
  const root = process.env.KWIZERA_STORAGE_ROOT?.trim();
  return root && root.length > 0 ? root : path.join(process.cwd(), ".kwizera-storage");
}

function defaultStorePath(): string {
  return path.join(storageRoot(), "forex-automated-trading", "stage1-spread-evidence.json");
}

function emptyDoc(nowUtc: string): Stage1EvidenceDocument {
  const acceptedByInstrument = {} as Record<Stage3TrackedInstrument, LiveSpreadObservationRecord[]>;
  for (const inst of STAGE3_TRACKED_INSTRUMENTS) acceptedByInstrument[inst] = [];
  return {
    schemaVersion: STAGE1_EVIDENCE_STORE_SCHEMA,
    updatedAtUtc: nowUtc,
    collectionStartedAtUtc: null,
    collectionLastTickAtUtc: null,
    acceptedByInstrument,
    rejections: [],
    slippageFillsByInstrument: {},
    placesOrders: false,
    mutatesBroker: false,
    note:
      "Stage 1 LIVE spread evidence store. Observations are not policies. "
      + "Owner propose→approve+confirm still required. Never places orders.",
  };
}

const MAX_ACCEPTED_PER_INSTRUMENT = 500;
const MAX_REJECTIONS = 2_000;

export class Stage1EvidenceStore {
  private doc: Stage1EvidenceDocument;
  private readonly filePath: string;

  constructor(filePath: string = defaultStorePath()) {
    this.filePath = filePath;
    this.doc = this.loadOrCreate();
  }

  private loadOrCreate(): Stage1EvidenceDocument {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Stage1EvidenceDocument;
        if (raw?.schemaVersion === STAGE1_EVIDENCE_STORE_SCHEMA && raw.acceptedByInstrument) {
          for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
            if (!Array.isArray(raw.acceptedByInstrument[inst])) raw.acceptedByInstrument[inst] = [];
          }
          if (!Array.isArray(raw.rejections)) raw.rejections = [];
          if (!raw.slippageFillsByInstrument || typeof raw.slippageFillsByInstrument !== "object") {
            raw.slippageFillsByInstrument = {};
          }
          return raw;
        }
      }
    } catch {
      /* recreate */
    }
    const doc = emptyDoc(new Date().toISOString());
    this.persist(doc);
    return doc;
  }

  private persist(doc: Stage1EvidenceDocument): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }

  get(): Stage1EvidenceDocument {
    return structuredClone(this.doc);
  }

  getAccepted(instrument: Stage3TrackedInstrument): LiveSpreadObservationRecord[] {
    return [...(this.doc.acceptedByInstrument[instrument] ?? [])];
  }

  getAllAccepted(): Partial<Record<Stage3TrackedInstrument, LiveSpreadObservationRecord[]>> {
    const out: Partial<Record<Stage3TrackedInstrument, LiveSpreadObservationRecord[]>> = {};
    for (const inst of STAGE3_TRACKED_INSTRUMENTS) {
      out[inst] = this.getAccepted(inst);
    }
    return out;
  }

  recordAccepted(record: LiveSpreadObservationRecord): void {
    const now = new Date().toISOString();
    if (!this.doc.collectionStartedAtUtc) this.doc.collectionStartedAtUtc = now;
    this.doc.collectionLastTickAtUtc = now;
    this.doc.updatedAtUtc = now;
    const list = this.doc.acceptedByInstrument[record.instrument] ?? [];
    list.push(record);
    while (list.length > MAX_ACCEPTED_PER_INSTRUMENT) list.shift();
    this.doc.acceptedByInstrument[record.instrument] = list;
    this.persist(this.doc);
  }

  recordRejection(input: Omit<Stage1RejectedObservation, "atUtc"> & { atUtc?: string }): void {
    const now = new Date().toISOString();
    if (!this.doc.collectionStartedAtUtc) this.doc.collectionStartedAtUtc = now;
    this.doc.collectionLastTickAtUtc = now;
    this.doc.updatedAtUtc = now;
    this.doc.rejections.push({
      atUtc: input.atUtc ?? now,
      instrument: input.instrument,
      code: input.code,
      message: input.message,
      bid: input.bid,
      ask: input.ask,
      observedAtUtc: input.observedAtUtc,
    });
    while (this.doc.rejections.length > MAX_REJECTIONS) this.doc.rejections.shift();
    this.persist(this.doc);
  }

  /** Replace production fill set for an instrument (validated BROKER_EXECUTION only). */
  setSlippageFills(instrument: string, fills: SlippageFillEvidenceRecord[]): void {
    const production = fills.filter((f) => f.provenance === "BROKER_EXECUTION");
    this.doc.slippageFillsByInstrument[instrument] = production;
    this.doc.updatedAtUtc = new Date().toISOString();
    this.persist(this.doc);
  }

  /**
   * Append one validated BROKER_EXECUTION fill. Dedupes by executionIdentifier.
   * Synthetic / non-production records are rejected (not persisted as evidence).
   */
  appendSlippageFill(record: SlippageFillEvidenceRecord): {
    accepted: boolean;
    duplicate: boolean;
    code: string;
    countForInstrument: number;
  } {
    if (record.provenance !== "BROKER_EXECUTION") {
      return {
        accepted: false,
        duplicate: false,
        code: "SYNTHETIC_NOT_PRODUCTION_EVIDENCE",
        countForInstrument: (this.doc.slippageFillsByInstrument[record.instrument] ?? []).length,
      };
    }
    const key = String(record.executionIdentifier || "").trim();
    if (!key) {
      return {
        accepted: false,
        duplicate: false,
        code: "MISSING_EXECUTION_ID",
        countForInstrument: (this.doc.slippageFillsByInstrument[record.instrument] ?? []).length,
      };
    }
    const list = this.doc.slippageFillsByInstrument[record.instrument] ?? [];
    if (list.some((f) => f.executionIdentifier === key)) {
      return {
        accepted: false,
        duplicate: true,
        code: "DUPLICATE_EXECUTION_ID",
        countForInstrument: list.length,
      };
    }
    list.push(record);
    while (list.length > MAX_ACCEPTED_PER_INSTRUMENT) list.shift();
    this.doc.slippageFillsByInstrument[record.instrument] = list;
    this.doc.updatedAtUtc = new Date().toISOString();
    this.persist(this.doc);
    return {
      accepted: true,
      duplicate: false,
      code: "SLIPPAGE_FILL_ACCEPTED",
      countForInstrument: list.length,
    };
  }

  getSlippageFills(instrument: string): SlippageFillEvidenceRecord[] {
    return [...(this.doc.slippageFillsByInstrument[instrument] ?? [])];
  }

  rejectionCountsByInstrument(): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const r of this.doc.rejections) {
      if (!out[r.instrument]) out[r.instrument] = {};
      out[r.instrument]![r.code] = (out[r.instrument]![r.code] ?? 0) + 1;
    }
    return out;
  }
}

let singleton: Stage1EvidenceStore | null = null;

export function getStage1EvidenceStore(filePath?: string): Stage1EvidenceStore {
  if (filePath) return new Stage1EvidenceStore(filePath);
  if (!singleton) singleton = new Stage1EvidenceStore();
  return singleton;
}

/** Test helper — reset singleton / optional path. */
export function resetStage1EvidenceStoreForTests(filePath?: string): Stage1EvidenceStore {
  singleton = filePath ? new Stage1EvidenceStore(filePath) : null;
  return getStage1EvidenceStore(filePath);
}
