/**
 * KWIZERA AI STUDIO — Knowledge Storage Engine types (Step 4B)
 */

import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";

export enum KnowledgeStorageType {
  Product = "product-knowledge",
  Image = "image-knowledge",
  Video = "video-knowledge",
  Marketing = "marketing-knowledge",
  Brand = "brand-knowledge",
  Language = "language-knowledge",
  Creative = "creative-knowledge",
  Technical = "technical-knowledge",
  Business = "business-knowledge",
  Workflow = "workflow-knowledge",
  Decision = "decision-knowledge",
  Reasoning = "reasoning-knowledge",
  Industry = "industry-knowledge",
}

export enum KnowledgeRecordStatus {
  Active = "active",
  Pending = "pending",
  Verified = "verified",
  Archived = "archived",
  Rejected = "rejected",
  Deleted = "deleted",
}

export enum KnowledgeIntegrityStatus {
  Verified = "verified",
  Unverified = "unverified",
  Corrupted = "corrupted",
  PendingVerification = "pending-verification",
}

export enum KnowledgeStorageValidationCode {
  MissingRequiredField = "missing-required-field",
  InvalidData = "invalid-data",
  CorruptedRecord = "corrupted-record",
  DuplicateRecord = "duplicate-record",
  StorageUnavailable = "storage-unavailable",
  AccessDenied = "access-denied",
  LowQuality = "low-quality",
  UnverifiedKnowledge = "unverified-knowledge",
}

export interface KnowledgeClassification {
  category: string;
  topic: string;
  importance: "low" | "medium" | "high" | "critical";
  reliability: "low" | "medium" | "high";
  businessDomain: string;
  creativeDomain: string;
  learningValue: number;
  futureUsage: string;
}

export interface KnowledgeRecord {
  knowledgeId: string;
  knowledgeType: KnowledgeStorageType;
  category: string;
  title: string;
  description: string;
  summary: string;
  tags: string[];
  keywords: string[];
  source: string;
  sourceReliability: number;
  confidenceScore: number;
  qualityScore: number;
  verificationStatus: KnowledgeVerificationStatus;
  relatedMemory: string[];
  relatedKnowledge: string[];
  version: number;
  creationDate: string;
  lastUpdated: string;
  status: KnowledgeRecordStatus;
  storageLocation: string;
  integrityStatus: KnowledgeIntegrityStatus;
  contentHash: string;
  searchableText: string;
  classification: KnowledgeClassification;
  payload?: Record<string, unknown>;
}

export interface KnowledgeRecordInput {
  knowledgeId?: string;
  knowledgeType: KnowledgeStorageType;
  category: string;
  title: string;
  description: string;
  summary?: string;
  tags?: string[];
  keywords?: string[];
  source: string;
  sourceReliability?: number;
  confidenceScore?: number;
  qualityScore?: number;
  verificationStatus?: KnowledgeVerificationStatus;
  relatedMemory?: string[];
  relatedKnowledge?: string[];
  status?: KnowledgeRecordStatus;
  payload?: Record<string, unknown>;
}

export interface KnowledgeRecordUpdate {
  category?: string;
  title?: string;
  description?: string;
  summary?: string;
  tags?: string[];
  keywords?: string[];
  sourceReliability?: number;
  confidenceScore?: number;
  qualityScore?: number;
  verificationStatus?: KnowledgeVerificationStatus;
  relatedMemory?: string[];
  relatedKnowledge?: string[];
  status?: KnowledgeRecordStatus;
  payload?: Record<string, unknown>;
}

export interface KnowledgeStorageValidationResult {
  valid: boolean;
  code?: KnowledgeStorageValidationCode;
  message: string;
  diagnostics: string[];
}

export interface KnowledgeStorageWriteResult {
  success: boolean;
  record?: KnowledgeRecord;
  validation?: KnowledgeStorageValidationResult;
  durationMs: number;
  version?: number;
}

export interface KnowledgeStorageReadResult {
  success: boolean;
  record?: KnowledgeRecord;
  durationMs: number;
  message?: string;
}

export interface KnowledgeStorageVersionEntry {
  version: number;
  timestamp: string;
  storagePath: string;
  contentHash: string;
  changeSummary: string;
}

export interface KnowledgeStorageIndexEntry {
  knowledgeId: string;
  knowledgeType: KnowledgeStorageType;
  title: string;
  category: string;
  source: string;
  contentHash: string;
  fingerprint: string;
  version: number;
  storageLocation: string;
  lastUpdated: string;
  searchableText: string;
  topic: string;
  importance: string;
  verificationStatus: KnowledgeVerificationStatus;
}

export interface KnowledgeStorageIndex {
  version: string;
  lastUpdated: string;
  recordCount: number;
  entries: KnowledgeStorageIndexEntry[];
}

export interface KnowledgeValidationHistoryEntry {
  timestamp: string;
  knowledgeId: string;
  operation: "create" | "update" | "rollback";
  valid: boolean;
  qualityScore: number;
  confidenceScore: number;
  verificationStatus: KnowledgeVerificationStatus;
  diagnostics: string[];
  durationMs: number;
}

export interface KnowledgeIntegrityCheckResult {
  verified: boolean;
  recordsChecked: number;
  issues: string[];
  relationshipsValid: boolean;
  metadataAccurate: boolean;
  versionIntegrity: boolean;
  filesAvailable: boolean;
  timestamp: string;
}

export interface KnowledgeStorageStatusReport {
  engineStatus: string;
  storageStatus: string;
  validationStatus: string;
  integrityStatus: string;
  classificationStatus: string;
  recordCount: number;
  supportedTypes: number;
  performance: {
    averageWriteMs: number;
    averageReadMs: number;
    lastWriteMs: number;
    lastReadMs: number;
    indexSize: number;
  };
  versionManagement: {
    enabled: boolean;
    totalVersions: number;
  };
  validationHistoryCount: number;
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class KnowledgeStorageEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "KnowledgeStorageEngineError";
  }
}
