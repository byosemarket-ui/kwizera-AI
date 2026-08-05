/**
 * KWIZERA AI STUDIO — Core Knowledge Domain Catalog (Knowledge Seeding Step 1)
 *
 * Architecture definitions only. No knowledge content is seeded here.
 * Future domains may be registered at runtime without editing this file.
 */

import { KnowledgeCategory } from "../knowledge-foundation/types.js";
import {
  KnowledgeDomainDefinition,
  KnowledgeDomainOrigin,
  KnowledgeDomainPriority,
  KnowledgeDomainStatus,
} from "./types.js";

export const KNOWLEDGE_DOMAIN_ARCHITECTURE_VERSION = "1.0.0";

const ARCHITECTURE_TIMESTAMP = "2026-08-04T00:00:00.000Z";

function meta(partial: {
  foundationCategoryId?: string;
  relatedEngineIds?: string[];
  relatedDomainIds?: string[];
  learningOrder: number;
  notes?: string;
}): KnowledgeDomainDefinition["metadata"] {
  return {
    foundationCategoryId: partial.foundationCategoryId,
    relatedEngineIds: partial.relatedEngineIds ?? [],
    relatedDomainIds: partial.relatedDomainIds ?? [],
    learningOrder: partial.learningOrder,
    contentReady: false,
    architectureOnly: true,
    createdAt: ARCHITECTURE_TIMESTAMP,
    updatedAt: ARCHITECTURE_TIMESTAMP,
    notes: partial.notes,
  };
}

function expansion(
  subdirectory: string,
  category: KnowledgeCategory | "custom-knowledge",
  notes: string[]
): KnowledgeDomainDefinition["futureExpansion"] {
  return {
    acceptsChildDomains: true,
    runtimeRegistrable: true,
    storageSubdirectory: subdirectory,
    suggestedFoundationCategory: category,
    expansionNotes: notes,
  };
}

/**
 * Complete professional Knowledge Domain architecture for KWIZERA AI STUDIO.
 * Child IDs are declared on parents; the registry validates bidirectionality.
 */
export const CORE_KNOWLEDGE_DOMAINS: KnowledgeDomainDefinition[] = [
  {
    domainId: "product-knowledge",
    name: "Product Knowledge",
    description:
      "Professional understanding of products, features, benefits, positioning, and how products should be represented across creative and marketing outputs.",
    parentDomainId: null,
    childDomainIds: ["product-category-knowledge"],
    tags: ["product", "catalog", "features", "positioning"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Upgraded,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.Upgraded,
    metadata: meta({
      foundationCategoryId: KnowledgeCategory.Product,
      relatedEngineIds: ["product-knowledge-engine", "product-intelligence-foundation"],
      relatedDomainIds: ["marketing-knowledge", "branding-knowledge", "ecommerce-knowledge"],
      learningOrder: 10,
      notes: "Upgraded from flat product-knowledge foundation category into a hierarchical domain.",
    }),
    futureExpansion: expansion("products", KnowledgeCategory.Product, [
      "Add subcategory domains per industry without changing core architecture.",
    ]),
  },
  {
    domainId: "product-category-knowledge",
    name: "Product Category Knowledge",
    description:
      "Taxonomy and conventions for product categories, vertical norms, and category-specific creative and marketing patterns.",
    parentDomainId: "product-knowledge",
    childDomainIds: [],
    tags: ["product", "category", "taxonomy", "vertical"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["product-knowledge-engine", "product-analysis-engine"],
      relatedDomainIds: ["product-knowledge", "ecommerce-knowledge"],
      learningOrder: 20,
    }),
    futureExpansion: expansion("product-categories", KnowledgeCategory.Product, [
      "Future category leaves (fashion, beauty, tech, food, etc.) attach as children.",
    ]),
  },
  {
    domainId: "marketing-knowledge",
    name: "Marketing Knowledge",
    description:
      "Campaign strategy, messaging frameworks, funnel stages, channel mix, and conversion-oriented creative direction.",
    parentDomainId: null,
    childDomainIds: [
      "customer-psychology",
      "sales-psychology",
      "cta-knowledge",
      "social-media-knowledge",
      "ecommerce-knowledge",
    ],
    tags: ["marketing", "campaigns", "funnel", "conversion"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Upgraded,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.Upgraded,
    metadata: meta({
      foundationCategoryId: KnowledgeCategory.Marketing,
      relatedEngineIds: [
        "marketing-knowledge-engine",
        "marketing-intelligence",
        "professional-marketing-branding-psychology-knowledge",
      ],
      relatedDomainIds: ["product-knowledge", "branding-knowledge", "business-knowledge"],
      learningOrder: 30,
      notes:
        "Upgraded with psychology, CTA, social, and e-commerce child domains. Expansion Step 7 fills professional marketing/video marketing topic knowledge (not social platform deep packs).",
    }),
    futureExpansion: expansion("marketing", KnowledgeCategory.Marketing, [
      "Future channel or funnel domains attach under this parent.",
    ]),
  },
  {
    domainId: "branding-knowledge",
    name: "Branding Knowledge",
    description:
      "Brand identity, voice, visual systems, consistency rules, and how brand meaning should shape creative decisions.",
    parentDomainId: null,
    childDomainIds: ["color-theory", "typography"],
    tags: ["brand", "identity", "voice", "visual-system"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Upgraded,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.Upgraded,
    metadata: meta({
      foundationCategoryId: KnowledgeCategory.Brand,
      relatedEngineIds: [
        "brand-knowledge-engine",
        "brand-visual-intelligence-engine",
        "professional-marketing-branding-psychology-knowledge",
      ],
      relatedDomainIds: ["marketing-knowledge", "ui-ux-knowledge", "product-knowledge"],
      learningOrder: 40,
      notes:
        "Upgraded from brand-knowledge foundation category; renamed for studio clarity. Expansion Step 7 fills professional branding topics.",
    }),
    futureExpansion: expansion("brand", KnowledgeCategory.Brand, [
      "Future brand-system or packaging domains attach as children.",
    ]),
  },
  {
    domainId: "video-production-knowledge",
    name: "Video Production Knowledge",
    description:
      "End-to-end professional video production: planning, capture language, post, delivery, and platform-ready packaging.",
    parentDomainId: null,
    childDomainIds: [
      "camera-knowledge",
      "lighting-knowledge",
      "composition-knowledge",
      "storytelling-knowledge",
      "scene-knowledge",
      "animation-knowledge",
      "motion-graphics-knowledge",
      "rendering-knowledge",
      "video-editing-knowledge",
      "audio-knowledge",
    ],
    tags: ["video", "production", "cinema", "post-production"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Upgraded,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.Upgraded,
    metadata: meta({
      foundationCategoryId: KnowledgeCategory.Video,
      relatedEngineIds: [
        "video-knowledge-engine",
        "video-production-knowledge-builder",
        "video-intelligence-foundation",
      ],
      relatedDomainIds: ["marketing-knowledge", "branding-knowledge"],
      learningOrder: 50,
      notes:
        "Upgraded from video-knowledge into a full production hierarchy. Expansion Step 1 fills professional video production topic knowledge (not camera specialty).",
    }),
    futureExpansion: expansion("videos", KnowledgeCategory.Video, [
      "Future specialty production domains (documentary, ads, shorts) attach as children.",
    ]),
  },
  {
    domainId: "camera-knowledge",
    name: "Camera Knowledge",
    description:
      "Lens choice, framing language, exposure relationships, depth of field, and camera setup for commercial storytelling.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: ["camera-movement-knowledge"],
    tags: ["camera", "lens", "framing", "exposure"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["camera-director-engine", "video-knowledge-engine", "professional-camera-knowledge"],
      relatedDomainIds: ["composition-knowledge", "lighting-knowledge", "video-production-knowledge"],
      learningOrder: 60,
      notes: "Expansion Step 2 fills professional camera settings knowledge (not lighting/composition specialty).",
    }),
    futureExpansion: expansion("camera", KnowledgeCategory.Video, [
      "Lens and sensor specialty domains can attach later.",
    ]),
  },
  {
    domainId: "camera-movement-knowledge",
    name: "Camera Movement Knowledge",
    description:
      "Professional camera moves, motivation for motion, pacing, and how movement supports emotion and product reveal.",
    parentDomainId: "camera-knowledge",
    childDomainIds: [],
    tags: ["camera-movement", "dolly", "pan", "tilt", "tracking"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "camera-movement-intelligence-engine",
        "motion-intelligence-engine",
        "professional-camera-knowledge",
      ],
      relatedDomainIds: ["camera-knowledge", "storytelling-knowledge", "composition-knowledge"],
      learningOrder: 70,
      notes: "Expansion Step 2 fills professional camera movement vocabulary for AI Me recommendations.",
    }),
    futureExpansion: expansion("camera-movement", KnowledgeCategory.Video, [
      "Platform-specific movement libraries can attach as children.",
    ]),
  },
  {
    domainId: "lighting-knowledge",
    name: "Lighting Knowledge",
    description:
      "Lighting setups, mood control, product lighting, contrast ratios, and practical lighting for commercial video and stills.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["lighting", "key-light", "mood", "product-lighting"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "lighting-color-intelligence-engine",
        "video-knowledge-engine",
        "professional-lighting-composition-knowledge",
      ],
      relatedDomainIds: ["color-theory", "composition-knowledge", "camera-knowledge"],
      learningOrder: 80,
      notes: "Expansion Step 3 fills professional lighting technique knowledge (not storytelling/scene design).",
    }),
    futureExpansion: expansion("lighting", KnowledgeCategory.Video, [
      "Studio, natural, and product-lighting subdomains can expand here.",
    ]),
  },
  {
    domainId: "composition-knowledge",
    name: "Composition Knowledge",
    description:
      "Visual composition rules, hierarchy, balance, framing, and how layout directs attention to the product or message.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["composition", "framing", "hierarchy", "balance"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "composition-intelligence-engine",
        "image-knowledge-engine",
        "creative-knowledge-engine",
        "professional-lighting-composition-knowledge",
      ],
      relatedDomainIds: ["color-theory", "typography", "ui-ux-knowledge", "lighting-knowledge"],
      learningOrder: 90,
      notes: "Expansion Step 3 fills professional composition technique knowledge (not storytelling/scene design).",
    }),
    futureExpansion: expansion("composition", KnowledgeCategory.Creative, [
      "Still and motion composition specialties can attach as children.",
    ]),
  },
  {
    domainId: "storytelling-knowledge",
    name: "Storytelling Knowledge",
    description:
      "Narrative structure, emotional arcs, hooks, reveals, and story frameworks for ads, explainers, and brand films.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["storytelling", "narrative", "hook", "arc"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "creative-knowledge-engine",
        "story-generation-engine",
        "storyboard-intelligence-engine",
        "professional-storytelling-scene-knowledge",
      ],
      relatedDomainIds: ["scene-knowledge", "customer-psychology", "cta-knowledge", "marketing-knowledge", "branding-knowledge"],
      learningOrder: 100,
      notes: "Expansion Step 4 fills professional storytelling knowledge (not animation/motion/rendering).",
    }),
    futureExpansion: expansion("storytelling", KnowledgeCategory.Creative, [
      "Genre-specific narrative frameworks can attach later.",
    ]),
  },
  {
    domainId: "scene-knowledge",
    name: "Scene Knowledge",
    description:
      "Scene design, continuity, blocking, transitions, and how scenes assemble into coherent commercial narratives.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["scene", "blocking", "continuity", "transitions"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "scene-generation-engine",
        "scene-detection-intelligence-engine",
        "video-knowledge-engine",
        "professional-storytelling-scene-knowledge",
      ],
      relatedDomainIds: [
        "storytelling-knowledge",
        "camera-knowledge",
        "lighting-knowledge",
        "composition-knowledge",
        "marketing-knowledge",
      ],
      learningOrder: 110,
      notes: "Expansion Step 4 fills professional scene design knowledge (not animation/motion/rendering).",
    }),
    futureExpansion: expansion("scenes", KnowledgeCategory.Video, [
      "Scene-type libraries (intro, demo, testimonial) expand as children.",
    ]),
  },
  {
    domainId: "animation-knowledge",
    name: "Animation Knowledge",
    description:
      "Animation principles, timing, spacing, character and object motion, and product animation for marketing content.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["animation", "timing", "motion-principles"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "animation-generation-engine",
        "creative-knowledge-engine",
        "motion-generation-engine",
        "professional-animation-motion-rendering-knowledge",
      ],
      relatedDomainIds: ["motion-graphics-knowledge", "storytelling-knowledge", "rendering-knowledge"],
      learningOrder: 120,
      notes: "Expansion Step 5 fills professional animation knowledge (not video editing).",
    }),
    futureExpansion: expansion("animation", KnowledgeCategory.Creative, [
      "2D, 3D, and product-animation specialties can attach later.",
    ]),
  },
  {
    domainId: "motion-graphics-knowledge",
    name: "Motion Graphics Knowledge",
    description:
      "Title design, kinetic typography, logo motion, lower-thirds, and branded motion systems for social and ads.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["motion-graphics", "titles", "logo-animation", "kinetic-type"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "creative-knowledge-engine",
        "motion-generation-engine",
        "professional-animation-motion-rendering-knowledge",
      ],
      relatedDomainIds: ["typography", "branding-knowledge", "animation-knowledge", "video-editing-knowledge"],
      learningOrder: 130,
      notes: "Expansion Step 5 fills motion graphics and transition knowledge (not video editing).",
    }),
    futureExpansion: expansion("motion-graphics", KnowledgeCategory.Creative, [
      "Template and platform motion packs attach as children.",
    ]),
  },
  {
    domainId: "rendering-knowledge",
    name: "Rendering Knowledge",
    description:
      "Render pipelines, codecs, resolution/delivery targets, quality tradeoffs, and export settings for studio workflows.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["rendering", "codecs", "export", "delivery"],
    priority: KnowledgeDomainPriority.Medium,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "rendering-preparation-engine",
        "image-rendering-preparation-engine",
        "audio-rendering-preparation-engine",
        "professional-animation-motion-rendering-knowledge",
      ],
      relatedDomainIds: ["video-editing-knowledge", "camera-knowledge", "marketing-knowledge"],
      learningOrder: 140,
      notes: "Expansion Step 5 fills professional rendering/export knowledge (not video editing).",
    }),
    futureExpansion: expansion("rendering", KnowledgeCategory.Technical, [
      "Platform delivery profiles can attach as children.",
    ]),
  },
  {
    domainId: "video-editing-knowledge",
    name: "Video Editing Knowledge",
    description:
      "Cut rhythm, pacing, transitions, assembly editing, and commercial editing techniques for product storytelling.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: [],
    tags: ["editing", "pacing", "cuts", "post"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "video-knowledge-engine",
        "timeline-intelligence-engine",
        "creative-knowledge-engine",
      ],
      relatedDomainIds: ["audio-knowledge", "storytelling-knowledge", "rendering-knowledge"],
      learningOrder: 150,
    }),
    futureExpansion: expansion("video-editing", KnowledgeCategory.Video, [
      "Platform-cut and format-specific editing domains can expand here.",
    ]),
  },
  {
    domainId: "audio-knowledge",
    name: "Audio Knowledge",
    description:
      "Sound design foundations, mix balance, dialogue clarity, ambience, and audio roles in marketing video.",
    parentDomainId: "video-production-knowledge",
    childDomainIds: ["music-knowledge", "voice-knowledge"],
    tags: ["audio", "sound-design", "mix", "dialogue"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["audio-planning-engine", "audio-production-engine", "audio-generation-foundation"],
      relatedDomainIds: ["video-editing-knowledge", "marketing-knowledge"],
      learningOrder: 160,
    }),
    futureExpansion: expansion("audio", KnowledgeCategory.Creative, [
      "SFX and ambience specialty domains can attach under audio.",
    ]),
  },
  {
    domainId: "music-knowledge",
    name: "Music Knowledge",
    description:
      "Music selection, tempo/mood matching, brand sonic identity, and licensing-aware music usage for campaigns.",
    parentDomainId: "audio-knowledge",
    childDomainIds: [],
    tags: ["music", "tempo", "mood", "sonic-brand"],
    priority: KnowledgeDomainPriority.Medium,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["music-generation-engine", "audio-planning-engine"],
      relatedDomainIds: ["branding-knowledge", "customer-psychology"],
      learningOrder: 170,
    }),
    futureExpansion: expansion("music", KnowledgeCategory.Creative, [
      "Genre and market music packs expand as children.",
    ]),
  },
  {
    domainId: "voice-knowledge",
    name: "Voice Knowledge",
    description:
      "Voiceover craft, tone, pacing, multilingual delivery, and voice branding for ads and explainers.",
    parentDomainId: "audio-knowledge",
    childDomainIds: [],
    tags: ["voice", "voiceover", "tone", "narration"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "voice-cloning-generation-engine",
        "text-to-speech-generation-engine",
        "language-knowledge-engine",
      ],
      relatedDomainIds: ["storytelling-knowledge", "branding-knowledge"],
      learningOrder: 180,
    }),
    futureExpansion: expansion("voice", KnowledgeCategory.Language, [
      "Language-specific voice craft domains can attach later.",
    ]),
  },
  {
    domainId: "color-theory",
    name: "Color Theory",
    description:
      "Color harmony, psychology of color, brand palettes, grading intent, and accessibility-aware color decisions.",
    parentDomainId: "branding-knowledge",
    childDomainIds: [],
    tags: ["color", "palette", "grading", "harmony"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "lighting-color-intelligence-engine",
        "image-knowledge-engine",
        "brand-knowledge-engine",
      ],
      relatedDomainIds: ["lighting-knowledge", "typography", "ui-ux-knowledge"],
      learningOrder: 190,
    }),
    futureExpansion: expansion("color-theory", KnowledgeCategory.Creative, [
      "Industry palette libraries can attach as children.",
    ]),
  },
  {
    domainId: "typography",
    name: "Typography",
    description:
      "Type hierarchy, readability, brand type systems, kinetic type constraints, and on-screen text for ads and UI.",
    parentDomainId: "branding-knowledge",
    childDomainIds: [],
    tags: ["typography", "type", "hierarchy", "readability"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["creative-knowledge-engine", "brand-knowledge-engine", "image-knowledge-engine"],
      relatedDomainIds: ["motion-graphics-knowledge", "ui-ux-knowledge", "color-theory"],
      learningOrder: 200,
    }),
    futureExpansion: expansion("typography", KnowledgeCategory.Creative, [
      "Script and language typography packs can expand here.",
    ]),
  },
  {
    domainId: "customer-psychology",
    name: "Customer Psychology",
    description:
      "Audience motivations, attention, trust, desire, and psychological triggers that shape persuasive creative.",
    parentDomainId: "marketing-knowledge",
    childDomainIds: [],
    tags: ["psychology", "audience", "motivation", "trust"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "audience-intelligence-engine",
        "marketing-knowledge-engine",
        "professional-marketing-branding-psychology-knowledge",
      ],
      relatedDomainIds: ["sales-psychology", "storytelling-knowledge", "cta-knowledge"],
      learningOrder: 210,
      notes: "Expansion Step 7 fills professional customer psychology topics (not social platform deep packs).",
    }),
    futureExpansion: expansion("customer-psychology", KnowledgeCategory.Marketing, [
      "Segment-specific psychology domains can attach later.",
    ]),
  },
  {
    domainId: "sales-psychology",
    name: "Sales Psychology",
    description:
      "Persuasion frameworks, objection handling in creative form, urgency, social proof, and buying-decision support.",
    parentDomainId: "marketing-knowledge",
    childDomainIds: [],
    tags: ["sales", "persuasion", "objections", "social-proof"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "marketing-knowledge-engine",
        "marketing-strategy-intelligence-engine",
        "professional-marketing-branding-psychology-knowledge",
      ],
      relatedDomainIds: ["customer-psychology", "cta-knowledge", "ecommerce-knowledge"],
      learningOrder: 220,
      notes: "Expansion Step 7 fills professional sales psychology topics (not social platform deep packs).",
    }),
    futureExpansion: expansion("sales-psychology", KnowledgeCategory.Marketing, [
      "B2B and B2C sales psychology packs can expand as children.",
    ]),
  },
  {
    domainId: "cta-knowledge",
    name: "CTA Knowledge",
    description:
      "Call-to-action design, placement, wording, urgency balance, and conversion-oriented CTA patterns per platform.",
    parentDomainId: "marketing-knowledge",
    childDomainIds: [],
    tags: ["cta", "conversion", "action", "copy"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["marketing-knowledge-engine", "creative-knowledge-engine"],
      relatedDomainIds: ["sales-psychology", "social-media-knowledge", "ui-ux-knowledge"],
      learningOrder: 230,
    }),
    futureExpansion: expansion("cta", KnowledgeCategory.Marketing, [
      "Platform CTA pattern libraries attach as children.",
    ]),
  },
  {
    domainId: "social-media-knowledge",
    name: "Social Media Knowledge",
    description:
      "Cross-platform social strategy, format norms, posting rhythms, and creative adaptation across networks.",
    parentDomainId: "marketing-knowledge",
    childDomainIds: [
      "tiktok-knowledge",
      "instagram-knowledge",
      "facebook-knowledge",
      "youtube-knowledge",
    ],
    tags: ["social", "platforms", "formats", "distribution"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "marketing-knowledge-engine",
        "creative-knowledge-engine",
        "publishing-distribution",
        "video-knowledge-engine",
      ],
      relatedDomainIds: ["video-production-knowledge", "cta-knowledge", "marketing-knowledge", "branding-knowledge"],
      learningOrder: 240,
      notes:
        "Expansion Step 8 fills professional social media fundamentals and platform deep packs. Does not publish content automatically.",
    }),
    futureExpansion: expansion("social-media", KnowledgeCategory.Marketing, [
      "Future platforms (WhatsApp, LinkedIn, etc.) register as children without core changes.",
    ]),
  },
  {
    domainId: "tiktok-knowledge",
    name: "TikTok Knowledge",
    description:
      "TikTok-native storytelling, hooks, length, trends-aware structure, and conversion patterns for short-form video.",
    parentDomainId: "social-media-knowledge",
    childDomainIds: [],
    tags: ["tiktok", "short-form", "hooks", "trends"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "creative-knowledge-engine",
        "marketing-knowledge-engine",
        "video-knowledge-engine",
      ],
      relatedDomainIds: ["instagram-knowledge", "storytelling-knowledge"],
      learningOrder: 250,
      notes: "Expansion Step 8 fills professional TikTok platform knowledge (distinct from Step 7 video-marketing hooks).",
    }),
    futureExpansion: expansion("tiktok", KnowledgeCategory.Marketing, [
      "Vertical and trend-pack domains can expand under TikTok.",
    ]),
  },
  {
    domainId: "instagram-knowledge",
    name: "Instagram Knowledge",
    description:
      "Reels, Stories, feed, and carousel conventions; visual brand consistency and discovery-oriented creative for Instagram.",
    parentDomainId: "social-media-knowledge",
    childDomainIds: [],
    tags: ["instagram", "reels", "stories", "carousel"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "creative-knowledge-engine",
        "marketing-knowledge-engine",
        "image-knowledge-engine",
      ],
      relatedDomainIds: ["tiktok-knowledge", "branding-knowledge"],
      learningOrder: 260,
      notes: "Expansion Step 8 fills professional Instagram Reels/feed/Stories/carousel knowledge.",
    }),
    futureExpansion: expansion("instagram", KnowledgeCategory.Marketing, [
      "Format-specific Instagram packs attach as children.",
    ]),
  },
  {
    domainId: "facebook-knowledge",
    name: "Facebook Knowledge",
    description:
      "Facebook ad and organic creative patterns, community context, and conversion-oriented placements.",
    parentDomainId: "social-media-knowledge",
    childDomainIds: [],
    tags: ["facebook", "ads", "community", "placements"],
    priority: KnowledgeDomainPriority.Medium,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["marketing-knowledge-engine", "creative-knowledge-engine"],
      relatedDomainIds: ["cta-knowledge", "ecommerce-knowledge"],
      learningOrder: 270,
      notes: "Expansion Step 8 fills professional Facebook Page, community, and organic reach knowledge.",
    }),
    futureExpansion: expansion("facebook", KnowledgeCategory.Marketing, [
      "Placement and objective packs can expand under Facebook.",
    ]),
  },
  {
    domainId: "youtube-knowledge",
    name: "YouTube Knowledge",
    description:
      "YouTube long-form and Shorts strategy, retention editing, thumbnails, and mid-roll / end-screen CTA craft.",
    parentDomainId: "social-media-knowledge",
    childDomainIds: [],
    tags: ["youtube", "long-form", "shorts", "retention"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: [
        "video-knowledge-engine",
        "marketing-knowledge-engine",
        "creative-knowledge-engine",
      ],
      relatedDomainIds: ["storytelling-knowledge", "video-editing-knowledge"],
      learningOrder: 280,
      notes: "Expansion Step 8 fills professional YouTube long-form, Shorts, thumbnail, and retention knowledge.",
    }),
    futureExpansion: expansion("youtube", KnowledgeCategory.Marketing, [
      "Series and niche YouTube domains can attach later.",
    ]),
  },
  {
    domainId: "ecommerce-knowledge",
    name: "E-commerce Knowledge",
    description:
      "Product page persuasion, merchandising creative, checkout friction awareness, and commerce-oriented content systems.",
    parentDomainId: "marketing-knowledge",
    childDomainIds: [],
    tags: ["ecommerce", "merchandising", "product-page", "checkout"],
    priority: KnowledgeDomainPriority.High,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["product-knowledge-engine", "marketing-knowledge-engine"],
      relatedDomainIds: ["product-category-knowledge", "sales-psychology", "ui-ux-knowledge"],
      learningOrder: 290,
    }),
    futureExpansion: expansion("ecommerce", KnowledgeCategory.Business, [
      "Marketplace and D2C specialty domains can expand here.",
    ]),
  },
  {
    domainId: "ui-ux-knowledge",
    name: "UI/UX Knowledge",
    description:
      "Interface clarity, interaction patterns, conversion UX, and how product/UI presentation supports studio outputs.",
    parentDomainId: null,
    childDomainIds: [],
    tags: ["ui", "ux", "interface", "usability"],
    priority: KnowledgeDomainPriority.Medium,
    status: KnowledgeDomainStatus.Planned,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.New,
    metadata: meta({
      relatedEngineIds: ["creative-knowledge-engine", "image-knowledge-engine"],
      relatedDomainIds: ["typography", "color-theory", "cta-knowledge", "ecommerce-knowledge"],
      learningOrder: 300,
    }),
    futureExpansion: expansion("ui-ux", KnowledgeCategory.Creative, [
      "Mobile, web, and app UX packs attach without core changes.",
    ]),
  },
  {
    domainId: "business-knowledge",
    name: "Business Knowledge",
    description:
      "Business models, value propositions, market context, and commercial goals that ground creative and marketing decisions.",
    parentDomainId: null,
    childDomainIds: [],
    tags: ["business", "strategy", "value", "market"],
    priority: KnowledgeDomainPriority.Critical,
    status: KnowledgeDomainStatus.Upgraded,
    version: "1.0.0",
    origin: KnowledgeDomainOrigin.Upgraded,
    metadata: meta({
      foundationCategoryId: KnowledgeCategory.Business,
      relatedEngineIds: ["knowledge-foundation"],
      relatedDomainIds: ["product-knowledge", "marketing-knowledge", "ecommerce-knowledge"],
      learningOrder: 310,
      notes: "Upgraded from business-knowledge foundation category with cross-domain relationships.",
    }),
    futureExpansion: expansion("business", KnowledgeCategory.Business, [
      "Industry and model-specific business domains attach as children.",
    ]),
  },
];

/** Required domain IDs for Step 1 completeness checks */
export const REQUIRED_KNOWLEDGE_DOMAIN_IDS: readonly string[] = CORE_KNOWLEDGE_DOMAINS.map(
  (d) => d.domainId
);
