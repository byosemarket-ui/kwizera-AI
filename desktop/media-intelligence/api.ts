/** Client for Step 2 media intelligence API. */
export interface MediaPreparationSummary {
  total: number;
  ready: number;
  needsReview: number;
  lowQuality: number;
  failed: number;
  processing: number;
  usableCount: number;
  productAnalysisReady: boolean;
  isolationReady: boolean;
  statusLabel: string;
}

export interface MediaIntelligenceReportDto {
  projectId: string;
  summary: MediaPreparationSummary & {
    total: number;
    ready: number;
    needsReview: number;
    lowQuality: number;
    failed: number;
    processing: number;
    usableCount: number;
    productAnalysisReady: boolean;
    isolationReady: boolean;
  };
  failures: string[];
}

export function formatMediaStatusLabel(summary: MediaIntelligenceReportDto["summary"]): string {
  if (summary.processing > 0) return `Preparing images (${summary.ready}/${summary.total} ready)…`;
  if (summary.total === 0) return "No product images yet";
  if (summary.usableCount === 0) return "Images need attention before video production";
  if (summary.needsReview > 0 || summary.lowQuality > 0) {
    return `${summary.ready}/${summary.total} images ready · ${summary.needsReview + summary.lowQuality} need review`;
  }
  return `${summary.ready}/${summary.total} images ready · Product analysis ready`;
}

export async function fetchMediaIntelligence(projectId: string): Promise<MediaIntelligenceReportDto | null> {
  const res = await fetch(`/api/media-intelligence/projects/${projectId}`);
  if (!res.ok) return null;
  const body = await res.json() as { report?: MediaIntelligenceReportDto };
  return body.report ?? null;
}

export async function prepareMediaIntelligence(projectId: string): Promise<MediaIntelligenceReportDto | null> {
  const res = await fetch(`/api/media-intelligence/projects/${projectId}/prepare`, { method: "POST" });
  if (!res.ok) return null;
  const body = await res.json() as { report?: MediaIntelligenceReportDto };
  return body.report ?? null;
}
