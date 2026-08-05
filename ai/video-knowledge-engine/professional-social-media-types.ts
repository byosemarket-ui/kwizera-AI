/**
 * Professional Social Media Knowledge — Expansion Step 8 types.
 * Learning/organization only — does not publish content automatically.
 */

export const PROFESSIONAL_SOCIAL_MEDIA_VERSION = "1.0.0";
export const SOCIAL_MEDIA_DOMAIN_ID = "social-media-knowledge";
export const TIKTOK_DOMAIN_ID = "tiktok-knowledge";
export const INSTAGRAM_DOMAIN_ID = "instagram-knowledge";
export const FACEBOOK_DOMAIN_ID = "facebook-knowledge";
export const YOUTUBE_DOMAIN_ID = "youtube-knowledge";
export const SOCIAL_MEDIA_KNOWLEDGE_SOURCE = "professional-social-media-knowledge";

export type SocialFundamentalsTopicId =
  | "social-media-fundamentals"
  | "social-content-strategy"
  | "social-audience-analysis"
  | "platform-selection"
  | "community-building"
  | "social-engagement-strategy"
  | "content-calendar"
  | "social-trend-analysis";

export type TikTokTopicId =
  | "tiktok-best-practices"
  | "tiktok-short-form-strategy"
  | "tiktok-hook-creation"
  | "tiktok-audience-retention"
  | "tiktok-trending-content"
  | "tiktok-hashtag-strategy"
  | "tiktok-video-length-optimization"
  | "tiktok-posting-best-practices";

export type InstagramTopicId =
  | "instagram-reels-strategy"
  | "instagram-feed-strategy"
  | "instagram-stories-strategy"
  | "instagram-carousel-strategy"
  | "instagram-visual-consistency"
  | "instagram-engagement-optimization"
  | "instagram-caption-strategy";

export type FacebookTopicId =
  | "facebook-page-strategy"
  | "facebook-video-strategy"
  | "facebook-community-management"
  | "facebook-engagement-strategy"
  | "facebook-organic-reach"
  | "facebook-content-scheduling";

export type YouTubeTopicId =
  | "youtube-long-form-strategy"
  | "youtube-shorts-strategy"
  | "youtube-thumbnail-best-practices"
  | "youtube-title-optimization"
  | "youtube-description-optimization"
  | "youtube-audience-retention"
  | "youtube-watch-time-optimization";

export type SmTopicId =
  | SocialFundamentalsTopicId
  | TikTokTopicId
  | InstagramTopicId
  | FacebookTopicId
  | YouTubeTopicId;

export type SmRelatedDomainId =
  | "social-media-knowledge"
  | "marketing-knowledge"
  | "branding-knowledge"
  | "storytelling-knowledge"
  | "video-production-knowledge"
  | "video-editing-knowledge"
  | "customer-psychology"
  | "sales-psychology"
  | "product-knowledge";

export interface ProfessionalSmTopic {
  topicId: SmTopicId;
  knowledgeId: string;
  name: string;
  title: string;
  description: string;
  professionalDefinition: string;
  purpose: string;
  bestPractices: string[];
  commonMistakes: string[];
  workflow: string[];
  professionalExamples: string[];
  relatedTopics: SmTopicId[];
  relatedDomains: SmRelatedDomainId[];
  keywords: string[];
  confidenceScore: number;
  qualityScore: number;
  metadata: {
    domainId:
      | typeof SOCIAL_MEDIA_DOMAIN_ID
      | typeof TIKTOK_DOMAIN_ID
      | typeof INSTAGRAM_DOMAIN_ID
      | typeof FACEBOOK_DOMAIN_ID
      | typeof YOUTUBE_DOMAIN_ID;
    category:
      | "professional-social-fundamentals"
      | "professional-tiktok"
      | "professional-instagram"
      | "professional-facebook"
      | "professional-youtube";
    difficulty: "foundation" | "intermediate" | "advanced";
    expansionStep: 8;
    version: typeof PROFESSIONAL_SOCIAL_MEDIA_VERSION;
    learningOnly: true;
    publishesContent: false;
  };
}

export interface SmDomainBridge {
  domainId: SmRelatedDomainId;
  knowledgeId: string;
  title: string;
  description: string;
  relationshipEvidence: string;
}

export interface AiMeSocialMediaAwareness {
  canRecommendPlatform: boolean;
  canRecommendContentFormat: boolean;
  canExplainPlatformDecisions: boolean;
  canRecommendPostingStrategies: boolean;
  canRecommendEngagementStrategies: boolean;
  canAnswerQuestions: boolean;
  fundamentalsTopicCount: number;
  tiktokTopicCount: number;
  instagramTopicCount: number;
  facebookTopicCount: number;
  youtubeTopicCount: number;
  relationshipCount: number;
  averageConfidence: number;
  averageQuality: number;
  socialMediaDomainReady: boolean;
  tiktokDomainReady: boolean;
  instagramDomainReady: boolean;
  facebookDomainReady: boolean;
  youtubeDomainReady: boolean;
  summary: string;
}

export interface SmHealthReport {
  healthy: boolean;
  completenessScore: number;
  missingConcepts: string[];
  missingFundamentalsConcepts: string[];
  missingTikTokConcepts: string[];
  missingInstagramConcepts: string[];
  missingFacebookConcepts: string[];
  missingYouTubeConcepts: string[];
  duplicateKnowledge: string[];
  brokenRelationships: string[];
  issues: string[];
}

export interface SmRepairResult {
  repaired: boolean;
  actions: string[];
  remainingIssues: string[];
}

export interface SmInstallResult {
  installed: boolean;
  fundamentalsInstalled: number;
  fundamentalsUpdated: number;
  tiktokInstalled: number;
  tiktokUpdated: number;
  instagramInstalled: number;
  instagramUpdated: number;
  facebookInstalled: number;
  facebookUpdated: number;
  youtubeInstalled: number;
  youtubeUpdated: number;
  bridgesInstalled: number;
  relationshipsCreated: number;
  socialMediaPackSynced: boolean;
  domainsMarkedReady: boolean;
  issues: string[];
}

export interface SmRecommendation {
  available: boolean;
  topicId: string | null;
  name: string;
  reason: string;
  bestPractices: string[];
  workflow: string[];
  confidenceScore: number;
  alternatives: Array<{ name: string; reason: string }>;
  kind:
    | "platform"
    | "format"
    | "posting"
    | "engagement"
    | "tiktok"
    | "instagram"
    | "facebook"
    | "youtube"
    | "fundamentals"
    | "none";
}

export interface SmExplainResult {
  available: boolean;
  knowledgeId: string | null;
  title: string;
  explanation: string;
  bestPractices: string[];
  confidenceScore: number;
  qualityScore: number;
  kind: "fundamentals" | "tiktok" | "instagram" | "facebook" | "youtube" | "none";
}

export class ProfessionalSocialMediaError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ProfessionalSocialMediaError";
  }
}
