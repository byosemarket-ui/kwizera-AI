export type CampaignStatus = "active" | "draft" | "scheduled" | "completed" | "archived";
export type CampaignPriority = "high" | "normal" | "low";
export type MarketingTab = "dashboard" | "campaigns" | "calendar" | "assets" | "audiences" | "timeline";
export type CalendarView = "day" | "week" | "month";
export type MarketingAssetKind = "image" | "video" | "audio" | "banner" | "poster" | "product" | "brand" | "document";

export type Campaign = { id: string; name: string; description: string; category: string; objective: string; status: CampaignStatus; priority: CampaignPriority; assets: string[]; updatedAt: string; audience: string; notes: string };
export type MarketingAsset = { id: string; name: string; kind: MarketingAssetKind; category: string; version: string; favorite: boolean; detail: string; updatedAt: string };
export type Audience = { id: string; name: string; category: string; segment: string; region: string; language: string; notes: string };
export type MarketingWorkspaceState = { campaigns: Campaign[]; assets: MarketingAsset[]; audiences: Audience[]; activeCampaignId: string; favorites: string[]; recent: string[]; tab: MarketingTab; calendar: CalendarView; assetView: "grid" | "list"; timelineIndex: number };