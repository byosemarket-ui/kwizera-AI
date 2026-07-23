import { CreativeVideoTemplateType, CreativeVideoType } from "./types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
const BASE_TEMPLATES = [
    {
        templateId: "cvt-product-ad",
        type: CreativeVideoTemplateType.ProductAdvertisement,
        name: "Product Advertisement",
        description: "Hero product focus with problem-solution-CTA arc",
        storyboardHints: ["Hook with pain point", "Product reveal at 30%", "Demo montage", "CTA close"],
        marketingFocus: "conversion",
    },
    {
        templateId: "cvt-brand-ad",
        type: CreativeVideoTemplateType.BrandAdvertisement,
        name: "Brand Advertisement",
        description: "Brand story with emotional resonance",
        storyboardHints: ["Brand establishing shot", "Lifestyle montage", "Logo reveal", "Tagline"],
        marketingFocus: "awareness",
    },
    {
        templateId: "cvt-launch",
        type: CreativeVideoTemplateType.LaunchCampaign,
        name: "Launch Campaign",
        description: "High-energy product launch narrative",
        storyboardHints: ["Teaser hook", "Feature reveals", "Social proof", "Launch CTA"],
        marketingFocus: "launch",
    },
    {
        templateId: "cvt-restaurant",
        type: CreativeVideoTemplateType.Restaurant,
        name: "Restaurant",
        description: "Food-forward sensory storytelling",
        storyboardHints: ["Sizzle hook", "Chef prep", "Plating hero", "Ambiance outro"],
        marketingFocus: "engagement",
    },
    {
        templateId: "cvt-fashion",
        type: CreativeVideoTemplateType.Fashion,
        name: "Fashion",
        description: "Style-driven editorial pacing",
        storyboardHints: ["Runway hook", "Detail inserts", "Full look reveal", "Brand stamp"],
        marketingFocus: "aspiration",
    },
    {
        templateId: "cvt-beauty",
        type: CreativeVideoTemplateType.Beauty,
        name: "Beauty",
        description: "Close-up transformation narrative",
        storyboardHints: ["Before state", "Application demo", "After reveal", "Product hero"],
        marketingFocus: "transformation",
    },
    {
        templateId: "cvt-electronics",
        type: CreativeVideoTemplateType.Electronics,
        name: "Electronics",
        description: "Feature-led tech showcase",
        storyboardHints: ["Problem hook", "Feature callouts", "Use case demo", "Spec CTA"],
        marketingFocus: "features",
    },
    {
        templateId: "cvt-education",
        type: CreativeVideoTemplateType.Education,
        name: "Education",
        description: "Structured learning journey",
        storyboardHints: ["Learning objective", "Step-by-step", "Recap", "Next lesson CTA"],
        marketingFocus: "education",
    },
    {
        templateId: "cvt-healthcare",
        type: CreativeVideoTemplateType.Healthcare,
        name: "Healthcare",
        description: "Trust-building empathetic narrative",
        storyboardHints: ["Patient story", "Care demonstration", "Expert endorsement", "Contact CTA"],
        marketingFocus: "trust",
    },
    {
        templateId: "cvt-real-estate",
        type: CreativeVideoTemplateType.RealEstate,
        name: "Real Estate",
        description: "Property tour with lifestyle context",
        storyboardHints: ["Exterior establishing", "Room tour", "Amenity highlights", "Agent CTA"],
        marketingFocus: "showcase",
    },
];
export class CreativeVideoTemplateLibrary {
    getAllTemplates() {
        return BASE_TEMPLATES;
    }
    matchTemplates(videoType, creativeType, industry) {
        return BASE_TEMPLATES.map((tpl) => ({
            ...tpl,
            matchScore: this.scoreTemplate(tpl, videoType, creativeType, industry),
        }))
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 4);
    }
    scoreTemplate(tpl, videoType, creativeType, industry) {
        let score = 50;
        if (videoType === VideoAnalysisType.Commercial && tpl.type === CreativeVideoTemplateType.ProductAdvertisement) {
            score += 25;
        }
        if (videoType === VideoAnalysisType.SocialMedia && tpl.type === CreativeVideoTemplateType.BrandAdvertisement) {
            score += 15;
        }
        if (videoType === VideoAnalysisType.Tutorial && tpl.type === CreativeVideoTemplateType.Education) {
            score += 25;
        }
        if (creativeType === CreativeVideoType.ProductDemo && tpl.type === CreativeVideoTemplateType.ProductAdvertisement) {
            score += 15;
        }
        if (creativeType === CreativeVideoType.BrandStory && tpl.type === CreativeVideoTemplateType.BrandAdvertisement) {
            score += 20;
        }
        const ind = industry?.toLowerCase() ?? "";
        if (ind.includes("tech") && tpl.type === CreativeVideoTemplateType.Electronics)
            score += 15;
        if (ind.includes("fashion") && tpl.type === CreativeVideoTemplateType.Fashion)
            score += 20;
        if (ind.includes("health") && tpl.type === CreativeVideoTemplateType.Healthcare)
            score += 20;
        if (ind.includes("education") && tpl.type === CreativeVideoTemplateType.Education)
            score += 15;
        return Math.min(100, score);
    }
}
//# sourceMappingURL=creative-video-template-library.js.map