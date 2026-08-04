import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";

export type KnowledgeAcquisitionSourceType =
  | "local-documentation"
  | "local-project-file"
  | "user-document"
  | "pdf"
  | "word"
  | "markdown"
  | "json"
  | "html"
  | "official-documentation"
  | "official-api-documentation"
  | "technical-manual"
  | "technical-standard"
  | "white-paper"
  | "user-manual"
  | "book"
  | "research-paper"
  | "approved-website"
  | "knowledge-foundation";

export interface KnowledgeAcquisitionSource {
  type: KnowledgeAcquisitionSourceType;
  name: string;
  content: string;
  reference?: string;
  reliability?: number;
  approved?: boolean;
}

export interface KnowledgeAcquisitionRequest {
  topic: string;
  sources?: KnowledgeAcquisitionSource[];
  knowledgeType?: KnowledgeStorageType;
  requesterId?: string;
}

export interface KnowledgeAcquisitionPreview {
  requestId: string;
  topic: string;
  knowledgeType: KnowledgeStorageType;
  status: "pending-approval" | "rejected";
  sources: Array<{ name: string; type: KnowledgeAcquisitionSourceType; reference?: string; reliability: number }>;
  rules: string[];
  techniques: string[];
  bestPractices: string[];
  commonMistakes: string[];
  workflows: string[];
  examples: string[];
  conflicts: string[];
  duplicateKnowledgeIds: string[];
  confidenceScore: number;
  qualityScore: number;
  rejectionReasons: string[];
  createdAt: string;
}

export interface KnowledgeAcquisitionImportResult {
  imported: boolean;
  requestId: string;
  knowledgeId?: string;
  reason?: string;
}