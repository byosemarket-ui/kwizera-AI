import type { BrandAsset, BrandCenterState, BrandProfile } from "./types";

const KEY = "kwizera.brand-center.v1";
const now = new Date().toISOString();
const defaultProfile: BrandProfile = { id: "kwizera-studio", name: "KWIZERA AI STUDIO", description: "Primary studio identity prepared for future brand synchronization.", category: "Creative technology", status: "active", owner: "Studio workspace", updatedAt: now, colors: [{ name: "Studio Mint", value: "#B9F2CC", role: "Primary" }, { name: "Signal Blue", value: "#70C8FF", role: "Secondary" }, { name: "Graphite", value: "#101319", role: "Background" }, { name: "Cloud", value: "#E7E9ED", role: "Neutral" }], typography: { heading: "Manrope", body: "Manrope", scale: "12 / 16 / 24 / 32" }, voice: "Clear, capable, and considered." };
const campaignProfile: BrandProfile = { ...defaultProfile, id: "campaign-lab", name: "Campaign Lab", description: "A secondary campaign identity prepared as an independent local brand workspace.", category: "Marketing program", status: "draft", owner: "Studio workspace", colors: [{ name: "Campaign Blue", value: "#70C8FF", role: "Primary" }, { name: "Studio Mint", value: "#B9F2CC", role: "Accent" }, { name: "Ink", value: "#101319", role: "Background" }, { name: "Cloud", value: "#E7E9ED", role: "Neutral" }], typography: { heading: "Manrope", body: "Manrope", scale: "12 / 16 / 24 / 32" }, voice: "Focused, confident, and practical." };
const assets: BrandAsset[] = [
  ["logo-primary", "Primary logo", "logo", "Logo library", "v1.0", "Full-color horizontal wordmark"], ["logo-secondary", "Secondary logo", "logo", "Logo library", "v1.0", "Compact secondary lockup"], ["logo-mono", "Monochrome logo", "logo", "Logo library", "v1.0", "Single-color use case"], ["logo-transparent", "Transparent logo", "logo", "Logo library", "v1.0", "Transparent-background version"], ["icon-app", "App icon", "icon", "Icon library", "v1.0", "Product icon version"], ["favicon", "Favicon", "icon", "Icon library", "v1.0", "Browser-scale mark"], ["social-template", "Social launch template", "template", "Social media", "v0.1", "Vertical social composition"], ["banner-template", "Campaign banner", "template", "Marketing", "v0.1", "Wide campaign layout"], ["product-template", "Product presentation", "template", "Product", "v0.1", "Product detail layout"], ["brand-background", "Studio background", "background", "Creative library", "v0.1", "Approved background treatment"], ["visual-texture", "Visual texture", "texture", "Creative library", "v0.1", "Subtle surface texture"], ["guidelines", "Brand guidelines", "document", "Documentation", "v0.1", "Identity and usage reference"],
].map(([id, name, kind, category, version, detail]) => ({ id, brandId: defaultProfile.id, name, kind: kind as BrandAsset["kind"], category, version, detail, modifiedAt: now, tags: [kind, category.toLowerCase()], favorite: false }));
const campaignAssets = assets.filter((asset) => ["logo-primary", "icon-app", "social-template", "banner-template", "guidelines"].includes(asset.id)).map((asset) => ({ ...asset, id: `campaign-${asset.id}`, brandId: campaignProfile.id, name: asset.name.replace("Primary", "Campaign") }));
const fallback: BrandCenterState = { profiles: [defaultProfile, campaignProfile], assets: [...assets, ...campaignAssets], activeBrandId: defaultProfile.id, favorites: [], recent: [], tab: "overview", view: "grid" };

export class BrandCenterManager {
  load(): BrandCenterState { try { const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<BrandCenterState>; return { ...fallback, ...stored, profiles: stored.profiles?.length ? stored.profiles : fallback.profiles, assets: stored.assets?.length ? stored.assets : fallback.assets }; } catch { return fallback; } }
  save(state: BrandCenterState): void { localStorage.setItem(KEY, JSON.stringify(state)); }
  toggleFavorite(state: BrandCenterState, id: string): BrandCenterState { const favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id]; return { ...state, favorites, assets: state.assets.map((asset) => asset.id === id ? { ...asset, favorite: favorites.includes(id) } : asset) }; }
  selectAsset(state: BrandCenterState, id: string): BrandCenterState { return { ...state, recent: [id, ...state.recent.filter((item) => item !== id)].slice(0, 20) }; }
}

export class BrandProfileManager {}
export class BrandAssetManager {}
export class LogoLibrary {}
export class ColorPaletteManager {}
export class TypographyManager {}
export class IconLibrary {}
export class TemplateLibrary {}
export class CreativeAssetLibrary {}
export class BrandGuidelineManager {}
export class BrandVersionManager {}
export class BrandSearchEngine {}
export class BrandMetadataManager {}
export class BrandSynchronizationManager {}