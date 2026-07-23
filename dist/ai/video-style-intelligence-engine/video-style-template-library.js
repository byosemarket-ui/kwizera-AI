import { CinematicStyleClass, StyleTemplatePlatform, } from "./types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
const BASE_TEMPLATES = [
    {
        templateId: "tpl-product-ads",
        platform: StyleTemplatePlatform.ProductAds,
        name: "Product Ad Style",
        description: "Hero product focus, punchy cuts, premium color grade",
        recommendedVisual: {
            colorGradingStyle: "high-contrast premium",
            compositionStyle: "center-weighted hero framing",
            motionStyle: "controlled push-in",
        },
        recommendedEditing: {
            pacing: "fast-medium",
            cutStyle: "hard cuts on beat",
            transitionStyle: "clean cuts with occasional dissolve",
        },
    },
    {
        templateId: "tpl-social-media",
        platform: StyleTemplatePlatform.SocialMedia,
        name: "Social Media Style",
        description: "Vertical-friendly, dynamic pacing, bold typography",
        recommendedVisual: {
            colorGradingStyle: "vibrant social grade",
            typographyStyle: "bold sans-serif overlays",
            motionStyle: "dynamic handheld-gimbal hybrid",
        },
        recommendedEditing: {
            pacing: "fast",
            captionStyle: "bold lower-third captions",
            audioSyncStyle: "beat-synced cuts",
        },
    },
    {
        templateId: "tpl-shorts",
        platform: StyleTemplatePlatform.Shorts,
        name: "Shorts Style",
        description: "Hook-first, rapid pacing, vertical composition",
        recommendedVisual: { compositionStyle: "vertical center-safe", motionStyle: "fast dynamic" },
        recommendedEditing: { pacing: "very fast", cutStyle: "jump cuts" },
    },
    {
        templateId: "tpl-reels",
        platform: StyleTemplatePlatform.Reels,
        name: "Reels Style",
        description: "Trend-forward edits, music-driven rhythm",
        recommendedVisual: { colorGradingStyle: "trendy saturated", graphicStyle: "sticker overlays" },
        recommendedEditing: { pacing: "fast", audioSyncStyle: "music beat sync" },
    },
    {
        templateId: "tpl-tiktok",
        platform: StyleTemplatePlatform.TikTok,
        name: "TikTok Style",
        description: "Native vertical feel, captions, quick hooks",
        recommendedVisual: { typographyStyle: "native caption style", backgroundStyle: "authentic UGC" },
        recommendedEditing: { captionStyle: "burned-in captions", pacing: "rapid hook-driven" },
    },
    {
        templateId: "tpl-youtube",
        platform: StyleTemplatePlatform.YouTube,
        name: "YouTube Style",
        description: "Structured chapters, balanced pacing, clear CTAs",
        recommendedVisual: { compositionStyle: "16:9 cinematic", lightingStyle: "three-point balanced" },
        recommendedEditing: { pacing: "medium", transitionStyle: "chapter fades" },
    },
    {
        templateId: "tpl-website",
        platform: StyleTemplatePlatform.Website,
        name: "Website Hero Style",
        description: "Clean minimal, brand-forward, loop-friendly",
        recommendedVisual: { colorGradingStyle: "brand-aligned clean", graphicStyle: "minimal UI overlays" },
        recommendedEditing: { pacing: "slow-medium", effectStyle: "subtle motion graphics" },
    },
    {
        templateId: "tpl-corporate",
        platform: StyleTemplatePlatform.CorporateVideos,
        name: "Corporate Video Style",
        description: "Professional tone, consistent branding, clear messaging",
        recommendedVisual: {
            colorGradingStyle: "neutral corporate grade",
            lightingStyle: "even professional",
            visualIdentity: "brand guideline compliant",
        },
        recommendedEditing: {
            pacing: "moderate",
            cutStyle: "clean professional cuts",
            transitionStyle: "dissolve and fade",
        },
    },
];
export class VideoStyleTemplateLibrary {
    getAllTemplates() {
        return BASE_TEMPLATES;
    }
    matchTemplates(videoType, cinematicStyles, platformHint) {
        const scores = BASE_TEMPLATES.map((tpl) => ({
            ...tpl,
            matchScore: this.scoreTemplate(tpl, videoType, cinematicStyles, platformHint),
        }));
        return scores.sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
    }
    scoreTemplate(tpl, videoType, cinematicStyles, platformHint) {
        let score = 50;
        if (videoType === VideoAnalysisType.Commercial && tpl.platform === StyleTemplatePlatform.ProductAds) {
            score += 25;
        }
        if (videoType === VideoAnalysisType.SocialMedia) {
            if (tpl.platform === StyleTemplatePlatform.SocialMedia ||
                tpl.platform === StyleTemplatePlatform.Reels ||
                tpl.platform === StyleTemplatePlatform.TikTok ||
                tpl.platform === StyleTemplatePlatform.Shorts) {
                score += 20;
            }
        }
        if (videoType === VideoAnalysisType.Tutorial && tpl.platform === StyleTemplatePlatform.YouTube) {
            score += 20;
        }
        if (cinematicStyles.includes(CinematicStyleClass.Corporate) && tpl.platform === StyleTemplatePlatform.CorporateVideos) {
            score += 15;
        }
        if (cinematicStyles.includes(CinematicStyleClass.Education) && tpl.platform === StyleTemplatePlatform.YouTube) {
            score += 10;
        }
        if (platformHint) {
            const hint = platformHint.toLowerCase();
            if (hint.includes("reel") && tpl.platform === StyleTemplatePlatform.Reels)
                score += 15;
            if (hint.includes("tiktok") && tpl.platform === StyleTemplatePlatform.TikTok)
                score += 15;
            if (hint.includes("youtube") && tpl.platform === StyleTemplatePlatform.YouTube)
                score += 15;
        }
        return Math.min(100, score);
    }
}
export { BASE_TEMPLATES };
//# sourceMappingURL=video-style-template-library.js.map