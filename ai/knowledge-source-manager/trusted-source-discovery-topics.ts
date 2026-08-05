/**
 * Discovery topics for Trusted Source Discovery (Knowledge Seeding Step 2).
 * Linked to Knowledge Domain Planning IDs where they exist.
 */

export interface TrustedSourceDiscoveryTopic {
  topicId: string;
  label: string;
  domainIds: string[];
  keywords: string[];
}

export const TRUSTED_SOURCE_DISCOVERY_TOPICS: TrustedSourceDiscoveryTopic[] = [
  {
    topicId: "artificial-intelligence",
    label: "Artificial Intelligence",
    domainIds: ["technical-knowledge"],
    keywords: ["ai", "artificial intelligence", "intelligence"],
  },
  {
    topicId: "machine-learning",
    label: "Machine Learning",
    domainIds: ["technical-knowledge"],
    keywords: ["ml", "machine learning", "deep learning", "neural"],
  },
  {
    topicId: "product-photography",
    label: "Product Photography",
    domainIds: ["product-knowledge", "composition-knowledge", "lighting-knowledge"],
    keywords: ["product photography", "product photo", "still life"],
  },
  {
    topicId: "video-production",
    label: "Video Production",
    domainIds: ["video-production-knowledge"],
    keywords: ["video production", "filmmaking", "cinematography"],
  },
  {
    topicId: "camera",
    label: "Camera",
    domainIds: ["camera-knowledge"],
    keywords: ["camera", "lens", "exposure"],
  },
  {
    topicId: "lighting",
    label: "Lighting",
    domainIds: ["lighting-knowledge"],
    keywords: ["lighting", "illumination", "key light"],
  },
  {
    topicId: "composition",
    label: "Composition",
    domainIds: ["composition-knowledge"],
    keywords: ["composition", "framing", "rule of thirds"],
  },
  {
    topicId: "storytelling",
    label: "Storytelling",
    domainIds: ["storytelling-knowledge"],
    keywords: ["storytelling", "narrative", "story structure"],
  },
  {
    topicId: "animation",
    label: "Animation",
    domainIds: ["animation-knowledge"],
    keywords: ["animation", "animate", "keyframes"],
  },
  {
    topicId: "motion-graphics",
    label: "Motion Graphics",
    domainIds: ["motion-graphics-knowledge"],
    keywords: ["motion graphics", "motion design", "kinetic"],
  },
  {
    topicId: "rendering",
    label: "Rendering",
    domainIds: ["rendering-knowledge"],
    keywords: ["rendering", "render", "codec"],
  },
  {
    topicId: "video-editing",
    label: "Video Editing",
    domainIds: ["video-editing-knowledge"],
    keywords: ["video editing", "editing", "nle", "timeline"],
  },
  {
    topicId: "audio",
    label: "Audio",
    domainIds: ["audio-knowledge"],
    keywords: ["audio", "sound design", "mixing"],
  },
  {
    topicId: "music",
    label: "Music",
    domainIds: ["music-knowledge"],
    keywords: ["music", "soundtrack", "score"],
  },
  {
    topicId: "marketing",
    label: "Marketing",
    domainIds: ["marketing-knowledge"],
    keywords: ["marketing", "campaign", "seo"],
  },
  {
    topicId: "branding",
    label: "Branding",
    domainIds: ["branding-knowledge"],
    keywords: ["branding", "brand identity", "brand"],
  },
  {
    topicId: "customer-psychology",
    label: "Customer Psychology",
    domainIds: ["customer-psychology"],
    keywords: ["customer psychology", "consumer behavior", "persuasion"],
  },
  {
    topicId: "sales-psychology",
    label: "Sales Psychology",
    domainIds: ["sales-psychology"],
    keywords: ["sales psychology", "selling", "conversion psychology"],
  },
  {
    topicId: "social-media",
    label: "Social Media",
    domainIds: ["social-media-knowledge"],
    keywords: ["social media", "social platforms"],
  },
  {
    topicId: "tiktok",
    label: "TikTok",
    domainIds: ["tiktok-knowledge"],
    keywords: ["tiktok"],
  },
  {
    topicId: "instagram",
    label: "Instagram",
    domainIds: ["instagram-knowledge"],
    keywords: ["instagram"],
  },
  {
    topicId: "facebook",
    label: "Facebook",
    domainIds: ["facebook-knowledge"],
    keywords: ["facebook", "meta business"],
  },
  {
    topicId: "youtube",
    label: "YouTube",
    domainIds: ["youtube-knowledge"],
    keywords: ["youtube"],
  },
  {
    topicId: "ecommerce",
    label: "E-commerce",
    domainIds: ["ecommerce-knowledge"],
    keywords: ["ecommerce", "e-commerce", "online store"],
  },
  {
    topicId: "ui-ux",
    label: "UI/UX",
    domainIds: ["ui-ux-knowledge"],
    keywords: ["ui", "ux", "usability", "interface"],
  },
  {
    topicId: "software-engineering",
    label: "Software Engineering",
    domainIds: ["technical-knowledge"],
    keywords: ["software", "programming", "engineering", "typescript", "react", "node"],
  },
];

export const REQUIRED_DISCOVERY_TOPIC_IDS = TRUSTED_SOURCE_DISCOVERY_TOPICS.map((topic) => topic.topicId);
