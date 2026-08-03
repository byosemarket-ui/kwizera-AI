import type { Campaign, MarketingAsset, MarketingWorkspaceState } from "./types";

const KEY = "kwizera.marketing-workspace.v1";
const now = new Date().toISOString();
const campaigns: Campaign[] = [
  { id: "launch", name: "Studio launch narrative", description: "A local planning surface for the studio launch story.", category: "Brand launch", objective: "Prepare a coherent launch content plan", status: "active", priority: "high", assets: ["hero-banner", "launch-poster", "brand-kit"], updatedAt: now, audience: "Creative business teams", notes: "Prepared only. No publishing is scheduled." },
  { id: "product", name: "Product discovery series", description: "Reusable product education campaign structure.", category: "Product education", objective: "Organize product discovery concepts", status: "draft", priority: "normal", assets: ["product-media", "social-card"], updatedAt: now, audience: "Prospective product audiences", notes: "Awaiting project context." },
  { id: "seasonal", name: "Seasonal collection", description: "Future seasonal content collection.", category: "Seasonal", objective: "Plan campaign milestones", status: "scheduled", priority: "low", assets: ["seasonal-banner"], updatedAt: now, audience: "Returning customers", notes: "Scheduling interface only." },
];
const assets: MarketingAsset[] = [["hero-banner", "Studio hero banner", "banner", "Campaign creative", "v0.1", "Wide campaign identity surface"], ["launch-poster", "Launch poster", "poster", "Campaign creative", "v0.1", "Poster composition placeholder"], ["brand-kit", "Brand resource kit", "brand", "Brand assets", "v1.0", "Linked local brand resource placeholder"], ["product-media", "Product media collection", "product", "Product media", "v0.1", "Prepared product visual collection"], ["social-card", "Social content card", "image", "Social media", "v0.1", "Square social composition"], ["seasonal-banner", "Seasonal banner", "banner", "Campaign creative", "v0.1", "Seasonal campaign banner"], ["launch-brief", "Launch brief", "document", "Documentation", "v0.1", "Campaign planning brief"], ["voiceover-placeholder", "Voiceover placeholder", "audio", "Audio", "v0.1", "Future campaign audio resource"]].map(([id, name, kind, category, version, detail]) => ({ id, name, kind: kind as MarketingAsset["kind"], category, version, detail, favorite: false, updatedAt: now }));
const fallback: MarketingWorkspaceState = { campaigns, assets, audiences: [{ id: "creative-teams", name: "Creative business teams", category: "Professional", segment: "Creative operations", region: "Global", language: "English", notes: "Primary planning audience placeholder." }, { id: "product-audience", name: "Product discovery audience", category: "Prospective", segment: "Product-led teams", region: "Regional", language: "English", notes: "Product education planning audience." }], activeCampaignId: "launch", favorites: [], recent: [], tab: "dashboard", calendar: "week", assetView: "grid", timelineIndex: 2 };

export class MarketingCampaignManager {
  load(): MarketingWorkspaceState { try { const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<MarketingWorkspaceState>; return { ...fallback, ...stored, campaigns: stored.campaigns?.length ? stored.campaigns : fallback.campaigns, assets: stored.assets?.length ? stored.assets : fallback.assets, audiences: stored.audiences?.length ? stored.audiences : fallback.audiences }; } catch { return fallback; } }
  save(state: MarketingWorkspaceState): void { localStorage.setItem(KEY, JSON.stringify(state)); }
  toggleFavorite(state: MarketingWorkspaceState, id: string): MarketingWorkspaceState { const favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id]; return { ...state, favorites, assets: state.assets.map((asset) => asset.id === id ? { ...asset, favorite: favorites.includes(id) } : asset) }; }
  selectCampaign(state: MarketingWorkspaceState, id: string): MarketingWorkspaceState { return { ...state, activeCampaignId: id, recent: [id, ...state.recent.filter((item) => item !== id)].slice(0, 18) }; }
}

export class CampaignWorkspaceManager {}
export class CampaignDashboard {}
export class CampaignPlanner {}
export class ContentCalendarManager {}
export class PublishingScheduleManager {}
export class MarketingAssetManager {}
export class CreativeCollectionManager {}
export class CampaignTimelineManager {}
export class AudienceManager {}
export class CampaignMetadataManager {}
export class CampaignStatusManager {}
export class MarketingSearchManager {}
export class MarketingWorkspaceSynchronization {}