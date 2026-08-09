import type {
  FeedbackClass,
  FeedbackInput,
  FeedbackRootCause,
  FeedbackTopic,
} from "./types.js";

const TOPIC_KEYWORDS: Array<{ topic: FeedbackTopic; keywords: string[] }> = [
  { topic: "camera", keywords: ["camera", "lens", "exposure", "aperture", "focus"] },
  { topic: "lighting", keywords: ["lighting", "light", "softbox", "shadow", "key light"] },
  { topic: "storytelling", keywords: ["story", "storytelling", "narrative", "hook", "script"] },
  { topic: "product-presentation", keywords: ["product presentation", "product reveal", "feature", "showcase"] },
  { topic: "background", keywords: ["background", "backdrop", "set"] },
  { topic: "animation", keywords: ["animation", "animate", "motion graphics", "keyframes"] },
  { topic: "video-speed", keywords: ["too fast", "too slow", "pacing", "speed", "tempo"] },
  { topic: "camera-movement", keywords: ["camera movement", "dolly", "pan", "tilt", "tracking"] },
  { topic: "music", keywords: ["music", "soundtrack", "beat", "score"] },
  { topic: "voice", keywords: ["voice", "voiceover", "voice over", "speaker"] },
  { topic: "narration", keywords: ["narration", "narrate", "script reading"] },
  { topic: "audio", keywords: ["audio", "sound", "mix", "volume", "sfx"] },
  { topic: "cta", keywords: ["cta", "call to action", "shop now", "buy now button"] },
  { topic: "price-display", keywords: ["price", "pricing", "cost display"] },
  { topic: "logo-placement", keywords: ["logo", "brand mark", "watermark"] },
  { topic: "rendering", keywords: ["render", "rendering", "export", "codec", "artifacts"] },
  { topic: "overall-video-quality", keywords: ["quality", "overall", "video looks", "production quality"] },
];

const MODULE_BY_TOPIC: Record<FeedbackTopic, { module: string; workflow: string; knowledge: string }> = {
  camera: { module: "product-video-generation", workflow: "scene-camera-plan", knowledge: "camera-knowledge" },
  lighting: { module: "product-image-generation", workflow: "scene-lighting", knowledge: "lighting-knowledge" },
  storytelling: { module: "product-storyboard", workflow: "marketing-script", knowledge: "storytelling-knowledge" },
  "product-presentation": { module: "product-intelligence", workflow: "product-reveal", knowledge: "product-marketing" },
  background: { module: "product-image-generation", workflow: "background-compose", knowledge: "composition-knowledge" },
  animation: { module: "product-video-generation", workflow: "motion-plan", knowledge: "animation-knowledge" },
  "video-speed": { module: "product-rendering-export", workflow: "timeline-edit", knowledge: "video-editing-knowledge" },
  "camera-movement": { module: "product-video-generation", workflow: "camera-move", knowledge: "camera-movement-knowledge" },
  music: { module: "product-audio-generation", workflow: "music-mix", knowledge: "audio-knowledge" },
  voice: { module: "product-audio-generation", workflow: "voice-over", knowledge: "voice-knowledge" },
  narration: { module: "product-audio-generation", workflow: "narration-sync", knowledge: "storytelling-knowledge" },
  audio: { module: "product-audio-generation", workflow: "audio-mix", knowledge: "audio-knowledge" },
  cta: { module: "product-storyboard", workflow: "cta-placement", knowledge: "marketing-knowledge" },
  "price-display": { module: "product-rendering-export", workflow: "price-overlay", knowledge: "product-marketing" },
  "logo-placement": { module: "product-rendering-export", workflow: "brand-overlay", knowledge: "branding-knowledge" },
  rendering: { module: "product-rendering-export", workflow: "final-render", knowledge: "rendering-knowledge" },
  "overall-video-quality": { module: "creative-review", workflow: "delivery-review", knowledge: "industry-standards" },
};

export function detectFeedbackTopics(text: string): FeedbackTopic[] {
  const lower = text.toLowerCase();
  const hits = TOPIC_KEYWORDS
    .map((entry) => ({
      topic: entry.topic,
      score: entry.keywords.filter((keyword) => lower.includes(keyword)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.topic);
  return hits.length ? [...new Set(hits)] : ["overall-video-quality"];
}

export function classifyFeedback(input: FeedbackInput, topics: FeedbackTopic[]): {
  classification: FeedbackClass;
  sentimentScore: number;
  qualityScore: number;
} {
  const lower = input.text.toLowerCase();
  const rating = input.rating;
  let classification: FeedbackClass = "improvement-request";
  let sentimentScore = 50;

  if (rating != null) {
    sentimentScore = Math.round((rating / 5) * 100);
  }

  if (/bug|broken|crash|error|fail/.test(lower)) classification = "bug-report";
  else if (/feature request|add support|please add|wish you/.test(lower)) classification = "feature-request";
  else if (/slow|lag|performance|takes too long/.test(lower)) classification = "performance-issue";
  else if (/prefer|style|looks better|aesthetic|vibe/.test(lower)) classification = "style-preference";
  else if (/blurry|low quality|artifact|noisy|bad quality/.test(lower)) classification = "quality-issue";
  else if (/improve|fix|better|should|needs? more/.test(lower)) classification = "improvement-request";
  else if (/great|love|excellent|perfect|amazing|good job|liked/.test(lower) || (rating != null && rating >= 4)) {
    classification = "positive";
    sentimentScore = Math.max(sentimentScore, 80);
  } else if (/hate|terrible|awful|worst|bad|dislike/.test(lower) || (rating != null && rating <= 2)) {
    classification = "negative";
    sentimentScore = Math.min(sentimentScore, 30);
  }

  if (classification === "positive") sentimentScore = Math.max(sentimentScore, 75);
  if (classification === "negative" || classification === "bug-report" || classification === "quality-issue") {
    sentimentScore = Math.min(sentimentScore, 35);
  }

  const qualityScore = Math.min(
    100,
    40
      + Math.min(40, input.text.trim().length / 4)
      + (topics.length > 0 ? 10 : 0)
      + (input.source === "manual-correction" ? 10 : 0),
  );

  return { classification, sentimentScore, qualityScore };
}

export function analyzeRootCause(
  text: string,
  topics: FeedbackTopic[],
  classification: FeedbackClass,
): FeedbackRootCause {
  const primary = topics[0] ?? "overall-video-quality";
  const mapping = MODULE_BY_TOPIC[primary];
  const negative = ["negative", "bug-report", "quality-issue", "performance-issue", "improvement-request"].includes(classification);
  return {
    whatHappened: negative
      ? `User reported an issue related to ${primary.replace(/-/g, " ")}.`
      : `User provided ${classification.replace(/-/g, " ")} feedback about ${primary.replace(/-/g, " ")}.`,
    whyItHappened: negative
      ? `Likely mismatch between generated ${primary.replace(/-/g, " ")} output and user expectation/preferences.`
      : `Feedback reinforces or refines preferred ${primary.replace(/-/g, " ")} direction.`,
    moduleLikely: mapping.module,
    workflowLikely: mapping.workflow,
    knowledgeLikely: mapping.knowledge,
    recommendedCorrection: negative
      ? `Adjust ${mapping.workflow} using learned preference for ${primary}; keep Professional Knowledge unchanged.`
      : `Retain and strengthen ${primary} preference for future projects.`,
  };
}

export function buildLesson(
  classification: FeedbackClass,
  topics: FeedbackTopic[],
  rootCause: FeedbackRootCause,
): { lesson: string; recommendationRule: string; workflowPreference?: string; qualityPreference?: string; stylePreference?: string } {
  const topicLabel = topics.map((topic) => topic.replace(/-/g, " ")).join(", ");
  if (classification === "positive") {
    return {
      lesson: `Positive signal on ${topicLabel}: keep similar creative choices.`,
      recommendationRule: `Prefer prior successful settings for ${topicLabel}.`,
      stylePreference: `Retain ${topicLabel} style that received positive feedback.`,
    };
  }
  if (classification === "style-preference") {
    return {
      lesson: `User style preference detected for ${topicLabel}.`,
      recommendationRule: `Bias future recommendations toward stated ${topicLabel} style.`,
      stylePreference: rootCause.recommendedCorrection,
    };
  }
  return {
    lesson: `Learned correction for ${topicLabel}: ${rootCause.recommendedCorrection}`,
    recommendationRule: `When planning ${topicLabel}, apply correction: ${rootCause.recommendedCorrection}`,
    workflowPreference: rootCause.workflowLikely,
    qualityPreference: classification.includes("quality") || classification.includes("bug")
      ? `Raise quality checks for ${topicLabel}.`
      : undefined,
  };
}
