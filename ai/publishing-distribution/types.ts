export type PublishingPlatform = "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "x" | "pinterest" | "whatsapp-business" | "telegram" | "custom";
export type PublishingJobStatus = "scheduled" | "ready-local" | "published" | "failed";
export type PublishingRecurrence = "daily" | "weekly" | "monthly";

export interface PublishingPlatformProfile {
  id: string;
  platform: PublishingPlatform;
  connectorId?: string;
  deliveryPath?: string;
  maxCaptionLength: number;
  supportedAspectRatios: string[];
  requiredPermissions: string[];
  enabled: boolean;
}

export interface PublishingPackage {
  id: string;
  projectId: string;
  exportFileName: string;
  packagePath: string;
  metadataPath: string;
  caption: string;
  hashtags: string[];
  createdAt: string;
}

export interface PublishingJob {
  id: string;
  packageId: string;
  profileId: string;
  status: PublishingJobStatus;
  scheduledFor: string;
  timeZone: string;
  attempts: number;
  recurrence?: PublishingRecurrence;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  error?: string;
}

export interface PublishingStatus {
  initialized: boolean;
  offlineFirst: true;
  packages: number;
  jobs: { scheduled: number; readyLocal: number; published: number; failed: number };
  profiles: { total: number; enabled: number; connected: number };
  analytics: { deliveryAttempts: number; successRatePercent: number; exportPackages: number };
}

export interface PublishingOptimizationRecommendation {
  captionLength: number;
  captionLimit: number;
  captionWillBeTruncated: boolean;
  supportedAspectRatios: string[];
  sourcePreserved: true;
  note: string;
}