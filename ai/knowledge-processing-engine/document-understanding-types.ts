/**
 * Document Understanding types (Knowledge Seeding Step 4).
 * Understands and indexes collected learning resources — does not build Knowledge Packs.
 */

export type SupportedDocumentFormat =
  | "pdf"
  | "docx"
  | "txt"
  | "markdown"
  | "html"
  | "json"
  | "xml"
  | "csv"
  | "technical-manual"
  | "api-documentation"
  | "research-paper"
  | "user-guide"
  | "company-documentation"
  | "unknown";

export type KnowledgeDifficultyLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "professional";

export type DomainConceptCategory =
  | "camera"
  | "lighting"
  | "marketing"
  | "rendering"
  | "animation"
  | "storytelling"
  | "editing"
  | "product-photography"
  | "general";

export interface DocumentHeading {
  level: number;
  text: string;
  line: number;
}

export interface DocumentSection {
  title: string;
  level: number;
  contentPreview: string;
  startLine: number;
  endLine: number;
}

export interface DocumentTableRef {
  id: string;
  caption?: string;
  rowEstimate: number;
  preview: string;
}

export interface DocumentMediaRef {
  id: string;
  kind: "image" | "diagram";
  alt?: string;
  src?: string;
}

export interface DocumentReference {
  id: string;
  text: string;
  url?: string;
}

export interface DocumentStructure {
  title: string;
  chapters: string[];
  sections: DocumentSection[];
  headings: DocumentHeading[];
  subHeadings: DocumentHeading[];
  tables: DocumentTableRef[];
  images: DocumentMediaRef[];
  diagrams: DocumentMediaRef[];
  references: DocumentReference[];
}

export interface DocumentContentAnalysis {
  difficultyLevel: KnowledgeDifficultyLevel;
  beginnerSignals: string[];
  intermediateSignals: string[];
  advancedSignals: string[];
  professionalSignals: string[];
  domainConcepts: Array<{ category: DomainConceptCategory; terms: string[] }>;
  technicalTerminology: string[];
  keywords: string[];
  importantConcepts: string[];
  learningTopics: string[];
}

export interface DocumentUnderstandingMetadata {
  resourceId: string;
  fileName: string;
  filePath: string;
  format: SupportedDocumentFormat;
  language: string;
  domainId?: string;
  sourceId?: string;
  sourceTitle?: string;
  fileSizeBytes: number;
  checksumSha256?: string | null;
  originalCollectionDate?: string;
  analyzedAt: string;
  encoding: string;
  pageOrChunkEstimate: number;
}

export interface DocumentUnderstandingResult {
  understandingId: string;
  resourceId: string;
  status: "understood" | "partial" | "failed" | "duplicate";
  metadata: DocumentUnderstandingMetadata;
  structure: DocumentStructure;
  analysis: DocumentContentAnalysis;
  summary: string;
  searchableText: string;
  issues: string[];
  originalPreserved: true;
}

export interface DocumentTopicIndexEntry {
  topic: string;
  resourceIds: string[];
  understandingIds: string[];
}

export interface DocumentKeywordIndexEntry {
  keyword: string;
  resourceIds: string[];
  frequencies: Record<string, number>;
}

export interface DocumentDomainIndexEntry {
  domainId: string;
  resourceIds: string[];
  understandingIds: string[];
}

export interface DocumentTechnicalIndexEntry {
  term: string;
  resourceIds: string[];
  categories: DomainConceptCategory[];
}

export interface DocumentRelationshipIndexEntry {
  fromResourceId: string;
  toResourceId: string;
  relation: "same-domain" | "shared-topic" | "shared-keyword" | "shared-concept";
  strength: number;
}

export interface DocumentUnderstandingIndexes {
  topicIndex: DocumentTopicIndexEntry[];
  keywordIndex: DocumentKeywordIndexEntry[];
  domainIndex: DocumentDomainIndexEntry[];
  technicalIndex: DocumentTechnicalIndexEntry[];
  relationshipIndex: DocumentRelationshipIndexEntry[];
  updatedAt: string;
}

export interface AiMeDocumentAwareness {
  totalUnderstood: number;
  partial: number;
  failed: number;
  formats: Record<string, number>;
  topTopics: string[];
  missingTopics: string[];
  recommendations: Array<{ resourceId: string; title: string; reason: string }>;
  summary: string;
}

export interface DocumentUnderstandingRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface DocumentUnderstandingReportData {
  generatedAt: string;
  existingDocumentReaders: string[];
  componentsUpgraded: string[];
  componentsCreated: string[];
  supportedDocumentFormats: SupportedDocumentFormat[];
  documentsAnalyzed: Array<{ resourceId: string; title: string; format: SupportedDocumentFormat; status: string }>;
  topicsIdentified: string[];
  metadataQuality: { complete: number; partial: number; score: number };
  indexQuality: { topics: number; keywords: number; domains: number; technicalTerms: number; relationships: number; score: number };
  aiMeIntegration: string;
  issuesFound: string[];
  issuesRepaired: string[];
  remainingWorkBeforeStep5: string[];
}

export class DocumentUnderstandingError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "DocumentUnderstandingError";
  }
}
