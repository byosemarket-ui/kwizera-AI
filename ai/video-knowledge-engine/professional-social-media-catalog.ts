/**
 * Curated Professional Social Media catalog (Expansion Step 8).
 * Distinct from Step 7 social-media-marketing overview and vmkt-* video marketing topics.
 * Does not publish content automatically.
 */

import {
  FACEBOOK_DOMAIN_ID,
  INSTAGRAM_DOMAIN_ID,
  PROFESSIONAL_SOCIAL_MEDIA_VERSION,
  SOCIAL_MEDIA_DOMAIN_ID,
  TIKTOK_DOMAIN_ID,
  YOUTUBE_DOMAIN_ID,
  type FacebookTopicId,
  type InstagramTopicId,
  type ProfessionalSmTopic,
  type SmDomainBridge,
  type SmRelatedDomainId,
  type SmTopicId,
  type SocialFundamentalsTopicId,
  type TikTokTopicId,
  type YouTubeTopicId,
} from "./professional-social-media-types.js";

type PartialTopic = Omit<ProfessionalSmTopic, "knowledgeId" | "title" | "metadata" | "workflow" | "professionalExamples"> & {
  knowledgeId?: string;
  title?: string;
  workflow?: string[];
  professionalExamples?: string[];
};

function metaFor(
  domainId: ProfessionalSmTopic["metadata"]["domainId"],
  category: ProfessionalSmTopic["metadata"]["category"],
  confidenceScore: number
): ProfessionalSmTopic["metadata"] {
  return {
    domainId,
    category,
    difficulty: confidenceScore >= 90 ? "advanced" : confidenceScore >= 84 ? "intermediate" : "foundation",
    expansionStep: 8,
    version: PROFESSIONAL_SOCIAL_MEDIA_VERSION,
    learningOnly: true,
    publishesContent: false,
  };
}

function finish(
  p: PartialTopic,
  prefix: string,
  domainId: ProfessionalSmTopic["metadata"]["domainId"],
  category: ProfessionalSmTopic["metadata"]["category"]
): ProfessionalSmTopic {
  return {
    ...p,
    knowledgeId: p.knowledgeId ?? `${prefix}-${p.topicId}`,
    title: p.title ?? p.name,
    workflow: p.workflow ?? ["Diagnose goal", "Apply platform norms", "Draft creative brief", "Review against best practices", "Plan measurement"],
    professionalExamples: p.professionalExamples ?? [`Professional application of ${p.name} for platform-native content`],
    metadata: metaFor(domainId, category, p.confidenceScore),
  };
}

function sm(p: PartialTopic): ProfessionalSmTopic {
  return finish(p, "sm", SOCIAL_MEDIA_DOMAIN_ID, "professional-social-fundamentals");
}
function tt(p: PartialTopic): ProfessionalSmTopic {
  return finish(p, "tt", TIKTOK_DOMAIN_ID, "professional-tiktok");
}
function ig(p: PartialTopic): ProfessionalSmTopic {
  return finish(p, "ig", INSTAGRAM_DOMAIN_ID, "professional-instagram");
}
function fb(p: PartialTopic): ProfessionalSmTopic {
  return finish(p, "fb", FACEBOOK_DOMAIN_ID, "professional-facebook");
}
function yt(p: PartialTopic): ProfessionalSmTopic {
  return finish(p, "yt", YOUTUBE_DOMAIN_ID, "professional-youtube");
}

const REL_CORE: SmRelatedDomainId[] = [
  "social-media-knowledge",
  "marketing-knowledge",
  "branding-knowledge",
  "storytelling-knowledge",
  "customer-psychology",
];
const REL_VIDEO: SmRelatedDomainId[] = [
  "social-media-knowledge",
  "video-production-knowledge",
  "video-editing-knowledge",
  "marketing-knowledge",
  "storytelling-knowledge",
];
const REL_COMMERCE: SmRelatedDomainId[] = [
  "social-media-knowledge",
  "marketing-knowledge",
  "sales-psychology",
  "product-knowledge",
  "branding-knowledge",
];

export const PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS: ProfessionalSmTopic[] = [
  sm({
    topicId: "social-media-fundamentals",
    name: "Social Media Fundamentals",
    description: "Core principles of social platforms: attention, formats, community, and measurement.",
    professionalDefinition:
      "Social media fundamentals are the platform-agnostic practices for earning attention, building community, and measuring outcomes without confusing vanity metrics with business results.",
    purpose: "Give AI Me a shared base before recommending any platform-specific strategy.",
    bestPractices: ["Define one primary outcome per channel", "Match format to platform behavior", "Measure engagement quality, not only reach"],
    commonMistakes: ["Posting the same asset everywhere unchanged", "Chasing trends with no brand fit"],
    relatedTopics: ["social-content-strategy", "platform-selection", "social-engagement-strategy", "social-audience-analysis"],
    relatedDomains: REL_CORE,
    keywords: ["social media fundamentals", "platforms", "attention", "community", "measurement"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  sm({
    topicId: "social-content-strategy",
    name: "Content Strategy",
    description: "Planning what to publish, why, for whom, and how it compounds over time.",
    professionalDefinition:
      "Social content strategy aligns brand pillars, audience needs, and platform formats into a repeatable publishing system with clear roles for awareness, engagement, and conversion content.",
    purpose: "Recommend coherent content mixes instead of one-off posts.",
    bestPractices: ["Map pillars to funnel stages", "Balance evergreen and timely content", "Brief creative with platform constraints up front"],
    commonMistakes: ["Random posting without pillars", "Only promotional posts"],
    relatedTopics: ["content-calendar", "platform-selection", "social-media-fundamentals", "social-trend-analysis"],
    relatedDomains: REL_CORE,
    keywords: ["content strategy", "pillars", "editorial", "social plan", "mix"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  sm({
    topicId: "social-audience-analysis",
    name: "Audience Analysis",
    description: "Understanding who follows, why they engage, and what language they use.",
    professionalDefinition:
      "Audience analysis gathers demographic, behavioral, and psychographic signals to tailor formats, hooks, and offers to the people who actually consume the content.",
    purpose: "Ground platform and format recommendations in real audience behavior.",
    bestPractices: ["Separate primary and secondary audiences", "Study comments and saves, not only likes", "Validate assumptions with content tests"],
    commonMistakes: ["Assuming brand persona equals audience", "Ignoring platform-specific audience skew"],
    relatedTopics: ["platform-selection", "social-engagement-strategy", "community-building", "social-content-strategy"],
    relatedDomains: ["social-media-knowledge", "customer-psychology", "marketing-knowledge", "branding-knowledge", "sales-psychology"],
    keywords: ["audience analysis", "persona", "behavior", "comments", "demographics"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  sm({
    topicId: "platform-selection",
    name: "Platform Selection",
    description: "Choosing where to invest creative effort based on audience, format fit, and goals.",
    professionalDefinition:
      "Platform selection is the decision process that matches business goals and audience presence to platforms whose native formats can carry the message efficiently.",
    purpose: "Enable AI Me to recommend the best platform for a goal or asset type.",
    bestPractices: ["Prioritize where the audience already spends time", "Match message length to platform norms", "Do not expand platforms before one is consistent"],
    commonMistakes: ["Being everywhere thinly", "Choosing platforms for brand ego"],
    relatedTopics: ["social-media-fundamentals", "social-content-strategy", "tiktok-short-form-strategy", "youtube-long-form-strategy"],
    relatedDomains: REL_CORE,
    keywords: ["platform selection", "where to post", "channel fit", "priority platforms"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  sm({
    topicId: "community-building",
    name: "Community Building",
    description: "Turning followers into participants who return, reply, and advocate.",
    professionalDefinition:
      "Community building cultivates belonging and repeated interaction through responsive moderation, shared rituals, and content that invites contribution—not only consumption.",
    purpose: "Recommend strategies that grow durable audiences beyond reach spikes.",
    bestPractices: ["Reply with substance in peak windows", "Create recurring series the community expects", "Spotlight user voices ethically"],
    commonMistakes: ["Broadcast-only accounts", "Ignoring comments after posting"],
    relatedTopics: ["social-engagement-strategy", "facebook-community-management", "social-audience-analysis"],
    relatedDomains: ["social-media-knowledge", "branding-knowledge", "customer-psychology", "marketing-knowledge", "storytelling-knowledge"],
    keywords: ["community building", "loyalty", "replies", "advocacy", "belonging"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  sm({
    topicId: "social-engagement-strategy",
    name: "Social Engagement Strategy",
    description: "Designing posts and replies that earn meaningful interaction.",
    professionalDefinition:
      "Social engagement strategy plans prompts, formats, and response loops that increase quality interactions (saves, shares, thoughtful comments) aligned with brand goals.",
    purpose: "Recommend audience engagement approaches across platforms.",
    bestPractices: ["Ask specific questions", "Design for saves and shares", "Close the loop when users respond"],
    commonMistakes: ["Engagement bait without value", "Buying fake interaction"],
    relatedTopics: ["community-building", "instagram-engagement-optimization", "facebook-engagement-strategy", "social-audience-analysis"],
    relatedDomains: ["social-media-knowledge", "customer-psychology", "sales-psychology", "marketing-knowledge", "branding-knowledge"],
    keywords: ["engagement strategy", "comments", "saves", "shares", "interaction"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  sm({
    topicId: "content-calendar",
    name: "Content Calendar",
    description: "Scheduling themes, formats, and cadence without over-promising volume.",
    professionalDefinition:
      "A content calendar is an operational plan that sequences themes, formats, owners, and publish windows so quality stays consistent under real production constraints.",
    purpose: "Recommend posting rhythms and planning systems.",
    bestPractices: ["Plan themes weeks ahead; leave slots for trends", "Batch production by format", "Review calendar weekly against performance"],
    commonMistakes: ["Unrealistic daily volume", "No buffer for creative delays"],
    relatedTopics: ["social-content-strategy", "facebook-content-scheduling", "tiktok-posting-best-practices"],
    relatedDomains: REL_CORE,
    keywords: ["content calendar", "cadence", "scheduling", "editorial calendar", "batching"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  sm({
    topicId: "social-trend-analysis",
    name: "Trend Analysis",
    description: "Detecting, evaluating, and adapting trends without losing brand identity.",
    professionalDefinition:
      "Trend analysis evaluates rising formats, sounds, and topics for brand fit, production feasibility, and risk before adapting them into on-brand creative.",
    purpose: "Help AI Me advise when to ride or skip a trend.",
    bestPractices: ["Score trends on fit, speed, and risk", "Adapt, do not copy blindly", "Retire trends that stop converting"],
    commonMistakes: ["Late trend chasing", "Forcing brand into mismatched memes"],
    relatedTopics: ["tiktok-trending-content", "social-content-strategy", "platform-selection"],
    relatedDomains: ["social-media-knowledge", "marketing-knowledge", "branding-knowledge", "storytelling-knowledge", "customer-psychology"],
    keywords: ["trend analysis", "viral", "sounds", "formats", "cultural moment"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
];

export const PROFESSIONAL_TIKTOK_TOPICS: ProfessionalSmTopic[] = [
  tt({
    topicId: "tiktok-best-practices",
    name: "TikTok Best Practices",
    description: "Native TikTok norms for authenticity, pacing, and discoverability.",
    professionalDefinition:
      "TikTok best practices are platform-native guidelines for vertical short-form that prioritizes early hooks, native editing language, and authentic delivery over polished ad-feel.",
    purpose: "Baseline recommendations for any TikTok content decision.",
    bestPractices: ["Lead with the hook in the first second", "Use native captions and on-screen text", "Sound and text must work with muted autoplay assumptions"],
    commonMistakes: ["Cross-posting horizontal ads unchanged", "Overly salesy first frames"],
    relatedTopics: ["tiktok-hook-creation", "tiktok-short-form-strategy", "tiktok-posting-best-practices"],
    relatedDomains: REL_VIDEO,
    keywords: ["tiktok best practices", "native", "vertical", "authenticity", "discoverability"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  tt({
    topicId: "tiktok-short-form-strategy",
    name: "Short-form Video Strategy",
    description: "Planning series, loops, and value density for TikTok-length videos.",
    professionalDefinition:
      "TikTok short-form strategy designs concise narratives and loops that deliver a complete idea quickly while encouraging rewatches and follows.",
    purpose: "Recommend how to structure TikTok content systems, not just single clips.",
    bestPractices: ["One idea per video", "Design for rewatch loops", "Series with recognizable openers"],
    commonMistakes: ["Cramming long-form scripts into 20s", "No series continuity"],
    relatedTopics: ["tiktok-video-length-optimization", "tiktok-audience-retention", "tiktok-best-practices"],
    relatedDomains: REL_VIDEO,
    keywords: ["short-form strategy", "tiktok series", "loops", "value density"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  tt({
    topicId: "tiktok-hook-creation",
    name: "TikTok Hook Creation",
    description: "Opening frames and lines that stop the TikTok scroll (platform-specific).",
    professionalDefinition:
      "TikTok hook creation crafts the first 1–3 seconds of visual and verbal intrigue tailored to For You Page scrolling behavior—distinct from generic video-marketing hooks.",
    purpose: "Recommend TikTok-native hooks without duplicating Step 7 vmkt-hook-creation.",
    bestPractices: ["Pattern interrupt visually", "Promise a specific payoff", "Show the product or problem immediately when relevant"],
    commonMistakes: ["Slow branded intros", "Vague curiosity without payoff"],
    relatedTopics: ["tiktok-audience-retention", "tiktok-best-practices", "tiktok-trending-content"],
    relatedDomains: ["social-media-knowledge", "storytelling-knowledge", "customer-psychology", "video-editing-knowledge", "marketing-knowledge"],
    keywords: ["tiktok hook", "first second", "scroll stop", "pattern interrupt"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  tt({
    topicId: "tiktok-audience-retention",
    name: "TikTok Audience Retention",
    description: "Keeping TikTok viewers watching through cuts, reveals, and open loops.",
    professionalDefinition:
      "TikTok audience retention uses pacing, open loops, and visual change to minimize drop-off across the short watch window of the For You Page.",
    purpose: "Explain and recommend retention tactics specific to TikTok.",
    bestPractices: ["Cut dead air", "Preview the ending early", "Change visual every 1–2 seconds when needed"],
    commonMistakes: ["Long static talking heads", "Burying the payoff"],
    relatedTopics: ["tiktok-hook-creation", "tiktok-video-length-optimization", "tiktok-short-form-strategy"],
    relatedDomains: REL_VIDEO,
    keywords: ["tiktok retention", "watch through", "drop-off", "pacing"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  tt({
    topicId: "tiktok-trending-content",
    name: "Trending Content",
    description: "Adapting TikTok trends, sounds, and formats with brand safety.",
    professionalDefinition:
      "TikTok trending content practice selects rising sounds and formats early enough to matter, then remakes them with brand-relevant stakes and clear offers.",
    purpose: "Guide trend participation without losing brand.",
    bestPractices: ["Jump early when fit is high", "Rewrite captions for brand voice", "Track which trend variants convert"],
    commonMistakes: ["Trend for trend's sake", "Ignoring sound licensing and brand safety"],
    relatedTopics: ["social-trend-analysis", "tiktok-hashtag-strategy", "tiktok-hook-creation"],
    relatedDomains: ["social-media-knowledge", "branding-knowledge", "marketing-knowledge", "storytelling-knowledge", "customer-psychology"],
    keywords: ["tiktok trends", "sounds", "challenges", "format remakes"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  tt({
    topicId: "tiktok-hashtag-strategy",
    name: "Hashtag Strategy",
    description: "Selecting TikTok hashtags for discoverability without spam patterns.",
    professionalDefinition:
      "TikTok hashtag strategy balances niche, campaign, and broad discovery tags to aid categorization without relying on hashtags as the primary growth lever.",
    purpose: "Recommend TikTok tagging practices.",
    bestPractices: ["Few relevant tags beat long spam lists", "Include branded campaign tags when tracking", "Prioritize content quality over tag volume"],
    commonMistakes: ["Copying unrelated viral tags", "Hashtag-only discovery strategy"],
    relatedTopics: ["tiktok-best-practices", "tiktok-posting-best-practices", "tiktok-trending-content"],
    relatedDomains: ["social-media-knowledge", "marketing-knowledge", "branding-knowledge", "product-knowledge", "sales-psychology"],
    keywords: ["tiktok hashtags", "discovery", "campaign tags", "categorization"],
    confidenceScore: 88,
    qualityScore: 87,
  }),
  tt({
    topicId: "tiktok-video-length-optimization",
    name: "Video Length Optimization",
    description: "Choosing TikTok durations that match idea complexity and retention.",
    professionalDefinition:
      "TikTok video length optimization selects the shortest duration that still delivers a complete payoff, then extends only when retention data supports it.",
    purpose: "Recommend length decisions for TikTok creatives.",
    bestPractices: ["Default short; extend when retention holds", "Cut middle bloat first", "Test 15s vs 30s+ for the same hook"],
    commonMistakes: ["Padding to hit arbitrary length", "Ending before the promised payoff"],
    relatedTopics: ["tiktok-audience-retention", "tiktok-short-form-strategy", "tiktok-best-practices"],
    relatedDomains: REL_VIDEO,
    keywords: ["tiktok length", "duration", "15 seconds", "optimization"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  tt({
    topicId: "tiktok-posting-best-practices",
    name: "Posting Best Practices",
    description: "When and how to publish TikTok content for consistent learning loops.",
    professionalDefinition:
      "TikTok posting best practices cover cadence, caption hygiene, cover frames, and review loops so each publish improves the next creative decision.",
    purpose: "Recommend posting strategies for TikTok.",
    bestPractices: ["Consistent cadence over burst spam", "Write captions that clarify the hook", "Review analytics within 24–48 hours"],
    commonMistakes: ["Dumping 10 videos then going silent", "Ignoring cover/thumbnail frame"],
    relatedTopics: ["content-calendar", "tiktok-best-practices", "tiktok-hashtag-strategy"],
    relatedDomains: ["social-media-knowledge", "marketing-knowledge", "video-production-knowledge", "branding-knowledge", "customer-psychology"],
    keywords: ["tiktok posting", "cadence", "captions", "publish time", "analytics"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
];

export const PROFESSIONAL_INSTAGRAM_TOPICS: ProfessionalSmTopic[] = [
  ig({
    topicId: "instagram-reels-strategy",
    name: "Reels Strategy",
    description: "Using Instagram Reels for discovery while protecting brand look.",
    professionalDefinition:
      "Reels strategy plans short vertical Instagram videos for discovery and profile visits, balancing trend participation with visual brand consistency.",
    purpose: "Recommend Instagram Reels as a content format and growth surface.",
    bestPractices: ["Hook fast; brand within first frames", "Design covers that fit the grid", "Reuse winning hooks as feed stills when useful"],
    commonMistakes: ["Ignoring cover aesthetics", "Treating Reels as only TikTok dumps"],
    relatedTopics: ["instagram-visual-consistency", "instagram-feed-strategy", "tiktok-short-form-strategy"],
    relatedDomains: REL_VIDEO,
    keywords: ["instagram reels", "discovery", "vertical video", "covers"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  ig({
    topicId: "instagram-feed-strategy",
    name: "Feed Strategy",
    description: "Planning the Instagram grid for brand memory and profile conversion.",
    professionalDefinition:
      "Feed strategy designs the profile grid and permanent posts as a brand storefront—consistent visuals, clear value, and intentional sequencing.",
    purpose: "Recommend feed content decisions for Instagram.",
    bestPractices: ["Plan grid in batches of 9", "Alternate education, proof, and product", "Optimize profile bio and pinned posts"],
    commonMistakes: ["Chaotic grid with no visual system", "Only promotional tiles"],
    relatedTopics: ["instagram-visual-consistency", "instagram-carousel-strategy", "instagram-caption-strategy"],
    relatedDomains: ["social-media-knowledge", "branding-knowledge", "product-knowledge", "marketing-knowledge", "storytelling-knowledge"],
    keywords: ["instagram feed", "grid", "profile", "pinned posts"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  ig({
    topicId: "instagram-stories-strategy",
    name: "Stories Strategy",
    description: "Using ephemeral Stories for intimacy, polls, and behind-the-scenes.",
    professionalDefinition:
      "Stories strategy uses 24-hour Instagram Stories for frequent, low-friction updates, interactive stickers, and sequential narratives that deepen relationship.",
    purpose: "Recommend Stories formats and engagement tactics.",
    bestPractices: ["Use polls and questions purposefully", "Sequence stories like mini chapters", "Drive to Highlights for evergreen"],
    commonMistakes: ["Story spam with no narrative", "Never saving useful stories to Highlights"],
    relatedTopics: ["instagram-engagement-optimization", "community-building", "instagram-feed-strategy"],
    relatedDomains: ["social-media-knowledge", "customer-psychology", "branding-knowledge", "marketing-knowledge", "storytelling-knowledge"],
    keywords: ["instagram stories", "ephemeral", "stickers", "highlights", "polls"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  ig({
    topicId: "instagram-carousel-strategy",
    name: "Carousel Strategy",
    description: "Multi-slide Instagram posts for education, storytelling, and saves.",
    professionalDefinition:
      "Carousel strategy structures swipeable slides to teach, compare, or narrate with a strong first cover and a clear final CTA slide.",
    purpose: "Recommend carousel as a high-save Instagram format.",
    bestPractices: ["Cover slide must earn the swipe", "One idea per slide", "End with save/share CTA"],
    commonMistakes: ["Walls of text", "Weak first slide"],
    relatedTopics: ["instagram-feed-strategy", "instagram-caption-strategy", "instagram-engagement-optimization"],
    relatedDomains: ["social-media-knowledge", "storytelling-knowledge", "branding-knowledge", "marketing-knowledge", "product-knowledge"],
    keywords: ["instagram carousel", "swipe", "slides", "saves", "education"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  ig({
    topicId: "instagram-visual-consistency",
    name: "Visual Consistency",
    description: "Maintaining recognizable Instagram aesthetics across formats.",
    professionalDefinition:
      "Visual consistency applies brand colors, typography, crop language, and lighting mood so Reels, feed, and Stories feel like one brand system.",
    purpose: "Recommend branding decisions on Instagram without duplicating Step 7 brand-identity deep packs.",
    bestPractices: ["Define 3–5 visual rules", "Templates for carousels and covers", "Audit grid monthly"],
    commonMistakes: ["Every post a different aesthetic", "Filters that fight product truth"],
    relatedTopics: ["instagram-feed-strategy", "instagram-reels-strategy", "instagram-stories-strategy"],
    relatedDomains: ["social-media-knowledge", "branding-knowledge", "product-knowledge", "video-production-knowledge", "marketing-knowledge"],
    keywords: ["visual consistency", "instagram brand", "grid aesthetic", "templates"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  ig({
    topicId: "instagram-engagement-optimization",
    name: "Engagement Optimization",
    description: "Improving Instagram interaction quality via creative and response design.",
    professionalDefinition:
      "Instagram engagement optimization improves meaningful interactions through format choice, caption prompts, reply hygiene, and timing—not vanity spikes alone.",
    purpose: "Recommend Instagram-specific engagement tactics.",
    bestPractices: ["Reply to early comments", "Use carousels and Reels for save/share goals", "Ask one clear question"],
    commonMistakes: ["Buying comments", "Ignoring DMs that start from posts"],
    relatedTopics: ["social-engagement-strategy", "instagram-caption-strategy", "instagram-stories-strategy"],
    relatedDomains: ["social-media-knowledge", "customer-psychology", "sales-psychology", "marketing-knowledge", "branding-knowledge"],
    keywords: ["instagram engagement", "comments", "saves", "DMs", "optimization"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  ig({
    topicId: "instagram-caption-strategy",
    name: "Caption Strategy",
    description: "Writing Instagram captions that clarify value and invite action.",
    professionalDefinition:
      "Caption strategy crafts scannable Instagram copy: hook line, value body, and a single CTA aligned with the visual.",
    purpose: "Recommend caption structure for Instagram posts and Reels.",
    bestPractices: ["Front-load the benefit", "Break lines for mobile scan", "One CTA per caption"],
    commonMistakes: ["Keyword stuffing", "Multiple competing CTAs"],
    relatedTopics: ["instagram-carousel-strategy", "instagram-feed-strategy", "instagram-engagement-optimization"],
    relatedDomains: ["social-media-knowledge", "branding-knowledge", "sales-psychology", "storytelling-knowledge", "marketing-knowledge"],
    keywords: ["instagram captions", "copy", "CTA", "hashtags in caption"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
];

export const PROFESSIONAL_FACEBOOK_TOPICS: ProfessionalSmTopic[] = [
  fb({
    topicId: "facebook-page-strategy",
    name: "Facebook Page Strategy",
    description: "Positioning a Facebook Page as a trusted brand hub.",
    professionalDefinition:
      "Facebook Page strategy defines the page as a branded home for updates, proof, community, and conversion paths—with clear about info and consistent posting identity.",
    purpose: "Recommend how to run a professional Facebook Page presence.",
    bestPractices: ["Complete page identity and CTAs", "Pin proof or offer posts", "Align page voice with brand guidelines"],
    commonMistakes: ["Neglected about section", "Inconsistent page vs ads creative"],
    relatedTopics: ["facebook-community-management", "facebook-content-scheduling", "facebook-organic-reach"],
    relatedDomains: REL_COMMERCE,
    keywords: ["facebook page", "brand hub", "about", "page CTA"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  fb({
    topicId: "facebook-video-strategy",
    name: "Video Strategy",
    description: "Facebook-native video for feed, Reels-adjacent, and community contexts.",
    professionalDefinition:
      "Facebook video strategy selects lengths, captions, and hooks suited to Facebook feed and group contexts, including square/vertical crops and sound-off viewing.",
    purpose: "Recommend Facebook video formats and creative decisions.",
    bestPractices: ["Caption for sound-off", "Hook in first 3 seconds", "Match aspect ratio to placement"],
    commonMistakes: ["Uploading uncaptioned horizontal only", "Ignoring Groups context"],
    relatedTopics: ["facebook-engagement-strategy", "facebook-organic-reach", "youtube-long-form-strategy"],
    relatedDomains: REL_VIDEO,
    keywords: ["facebook video", "feed video", "captions", "aspect ratio"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  fb({
    topicId: "facebook-community-management",
    name: "Community Management",
    description: "Moderating and nurturing Facebook Page and Group conversations.",
    professionalDefinition:
      "Facebook community management sets moderation rules, response SLAs, and escalation paths so comments and Groups stay safe, useful, and on-brand.",
    purpose: "Recommend community operations on Facebook.",
    bestPractices: ["Publish community guidelines", "Respond to questions publicly when useful", "Escalate crises with a playbook"],
    commonMistakes: ["Deleting all criticism", "No moderation coverage windows"],
    relatedTopics: ["community-building", "facebook-engagement-strategy", "facebook-page-strategy"],
    relatedDomains: ["social-media-knowledge", "branding-knowledge", "customer-psychology", "marketing-knowledge", "sales-psychology"],
    keywords: ["facebook community", "moderation", "groups", "response SLA"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  fb({
    topicId: "facebook-engagement-strategy",
    name: "Facebook Engagement Strategy",
    description: "Earning meaningful Facebook interactions from posts and replies.",
    professionalDefinition:
      "Facebook engagement strategy designs posts and reply behavior that spark discussion and shares within Page and Group audiences while staying compliant with platform norms.",
    purpose: "Recommend Facebook-specific engagement approaches.",
    bestPractices: ["Invite stories and experiences", "Use native formats people comment on", "Seed discussion without fake bait"],
    commonMistakes: ["Engagement bait that violates norms", "Ignoring comment threads"],
    relatedTopics: ["social-engagement-strategy", "facebook-community-management", "facebook-video-strategy"],
    relatedDomains: ["social-media-knowledge", "customer-psychology", "marketing-knowledge", "branding-knowledge", "sales-psychology"],
    keywords: ["facebook engagement", "comments", "shares", "discussion"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  fb({
    topicId: "facebook-organic-reach",
    name: "Organic Reach",
    description: "Improving unpaid Facebook distribution through relevance and relationships.",
    professionalDefinition:
      "Organic reach practice improves unpaid distribution by increasing meaningful interactions, posting consistently, and prioritizing content the audience completes and shares.",
    purpose: "Explain organic reach constraints and levers on Facebook.",
    bestPractices: ["Prioritize saves/shares over empty reactions", "Post when your audience is active", "Encourage authentic shares"],
    commonMistakes: ["Blaming algorithm only", "Buying fake engagement"],
    relatedTopics: ["facebook-content-scheduling", "facebook-engagement-strategy", "facebook-page-strategy"],
    relatedDomains: ["social-media-knowledge", "marketing-knowledge", "customer-psychology", "branding-knowledge", "storytelling-knowledge"],
    keywords: ["facebook organic reach", "distribution", "algorithm", "unpaid"],
    confidenceScore: 89,
    qualityScore: 88,
  }),
  fb({
    topicId: "facebook-content-scheduling",
    name: "Content Scheduling",
    description: "Planning Facebook publish times and queues without over-automation.",
    professionalDefinition:
      "Facebook content scheduling coordinates publish windows, queues, and live moments so the Page stays active while preserving room for timely community posts.",
    purpose: "Recommend Facebook posting and scheduling strategies.",
    bestPractices: ["Schedule evergreen; leave gaps for timely posts", "Review queue weekly", "Align schedule with community managers' reply hours"],
    commonMistakes: ["Fully automated silence after publish", "Overstuffed queues"],
    relatedTopics: ["content-calendar", "facebook-organic-reach", "facebook-page-strategy"],
    relatedDomains: ["social-media-knowledge", "marketing-knowledge", "branding-knowledge", "video-production-knowledge", "customer-psychology"],
    keywords: ["facebook scheduling", "publish queue", "timing", "cadence"],
    confidenceScore: 88,
    qualityScore: 87,
  }),
];

export const PROFESSIONAL_YOUTUBE_TOPICS: ProfessionalSmTopic[] = [
  yt({
    topicId: "youtube-long-form-strategy",
    name: "Long-form Video Strategy",
    description: "Planning YouTube long-form videos for search, suggested, and loyalty.",
    professionalDefinition:
      "YouTube long-form strategy designs chaptered, searchable videos that deliver depth, retain viewers, and support channel authority over time.",
    purpose: "Recommend long-form YouTube content systems.",
    bestPractices: ["Promise and deliver a clear outcome", "Use chapters and pattern", "Design intros under ~20s then value"],
    commonMistakes: ["No search intent mapping", "Meandering openings"],
    relatedTopics: ["youtube-audience-retention", "youtube-watch-time-optimization", "youtube-title-optimization"],
    relatedDomains: REL_VIDEO,
    keywords: ["youtube long-form", "search", "chapters", "authority"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  yt({
    topicId: "youtube-shorts-strategy",
    name: "Shorts Strategy",
    description: "Using YouTube Shorts for discovery that feeds the long-form channel.",
    professionalDefinition:
      "YouTube Shorts strategy produces vertical discovery clips that stand alone while routing interested viewers into long-form playlists and subscriptions.",
    purpose: "Recommend Shorts as a format bridging discovery and channel growth.",
    bestPractices: ["Complete idea in Shorts length", "Tease related long-form without bait-only", "Consistent series branding"],
    commonMistakes: ["Shorts with no channel path", "Only recycling long-form middles poorly"],
    relatedTopics: ["tiktok-short-form-strategy", "youtube-long-form-strategy", "youtube-audience-retention"],
    relatedDomains: REL_VIDEO,
    keywords: ["youtube shorts", "discovery", "vertical", "funnel to long-form"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  yt({
    topicId: "youtube-thumbnail-best-practices",
    name: "Thumbnail Best Practices",
    description: "Click-worthy YouTube thumbnails that stay honest and brand-safe.",
    professionalDefinition:
      "Thumbnail best practices design high-contrast, readable YouTube packaging that accurately previews the video's value without clickbait that destroys retention trust.",
    purpose: "Recommend thumbnail decisions for YouTube packaging.",
    bestPractices: ["One focal subject + short text", "High contrast faces/objects", "A/B test variants"],
    commonMistakes: ["Misleading shock thumbnails", "Unreadable tiny text"],
    relatedTopics: ["youtube-title-optimization", "youtube-long-form-strategy", "youtube-watch-time-optimization"],
    relatedDomains: ["social-media-knowledge", "branding-knowledge", "storytelling-knowledge", "marketing-knowledge", "product-knowledge"],
    keywords: ["youtube thumbnail", "CTR", "packaging", "click"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  yt({
    topicId: "youtube-title-optimization",
    name: "Title Optimization",
    description: "Writing YouTube titles for clarity, search, and click intent.",
    professionalDefinition:
      "Title optimization crafts YouTube titles that match viewer search language and curiosity while remaining truthful to the video content.",
    purpose: "Recommend title patterns for YouTube.",
    bestPractices: ["Front-load the benefit or topic", "Include searchable phrasing naturally", "Avoid keyword stuffing"],
    commonMistakes: ["Vague clever titles", "All-caps clickbait"],
    relatedTopics: ["youtube-thumbnail-best-practices", "youtube-description-optimization", "youtube-long-form-strategy"],
    relatedDomains: ["social-media-knowledge", "marketing-knowledge", "storytelling-knowledge", "customer-psychology", "branding-knowledge"],
    keywords: ["youtube title", "SEO", "click intent", "search language"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  yt({
    topicId: "youtube-description-optimization",
    name: "Description Optimization",
    description: "Using YouTube descriptions for context, links, and discovery signals.",
    professionalDefinition:
      "Description optimization structures the YouTube description with a strong first linesummary, chapters, links, and keywords that support search without spam.",
    purpose: "Recommend description and metadata practices.",
    bestPractices: ["Summarize value in the first lines", "Add chapters and resources", "Place CTAs without burying the summary"],
    commonMistakes: ["Empty descriptions", "Keyword dumping"],
    relatedTopics: ["youtube-title-optimization", "youtube-long-form-strategy", "youtube-watch-time-optimization"],
    relatedDomains: ["social-media-knowledge", "marketing-knowledge", "sales-psychology", "product-knowledge", "branding-knowledge"],
    keywords: ["youtube description", "chapters", "links", "metadata"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  yt({
    topicId: "youtube-audience-retention",
    name: "YouTube Audience Retention",
    description: "Keeping YouTube viewers watching through structure and editing.",
    professionalDefinition:
      "YouTube audience retention designs intros, pattern, and mid-video payoffs that reduce early drop-off and sustain attention across long-form and Shorts.",
    purpose: "Explain retention decisions specific to YouTube (distinct from TikTok/vmkt retention).",
    bestPractices: ["Show the payoff roadmap early", "Remove fluff mid-video", "Use visual change and open loops"],
    commonMistakes: ["Long channel branding before value", "No mid-video rehooks"],
    relatedTopics: ["youtube-watch-time-optimization", "youtube-long-form-strategy", "youtube-shorts-strategy"],
    relatedDomains: REL_VIDEO,
    keywords: ["youtube retention", "graph", "drop-off", "intro", "rewatch"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  yt({
    topicId: "youtube-watch-time-optimization",
    name: "Watch Time Optimization",
    description: "Increasing total watch time via packaging, series, and session design.",
    professionalDefinition:
      "Watch time optimization improves total minutes viewed through better retention, compelling next-up videos, playlists, and end-screen strategy—honestly matching viewer intent.",
    purpose: "Recommend strategies that grow YouTube watch time sustainably.",
    bestPractices: ["Build playlist sessions", "End screens to related videos", "Improve retention before chasing length alone"],
    commonMistakes: ["Artificial length padding", "Mismatched suggested videos"],
    relatedTopics: ["youtube-audience-retention", "youtube-long-form-strategy", "youtube-thumbnail-best-practices"],
    relatedDomains: ["social-media-knowledge", "video-editing-knowledge", "marketing-knowledge", "storytelling-knowledge", "sales-psychology"],
    keywords: ["watch time", "session", "playlists", "end screens", "YouTube"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
];

export const SM_DOMAIN_BRIDGES: SmDomainBridge[] = [
  {
    domainId: "social-media-knowledge",
    knowledgeId: "sm-bridge-social-media-knowledge",
    title: "Social Media Knowledge Domain",
    description: "Hub for Professional Social Media Expansion Step 8.",
    relationshipEvidence: "Primary domain for cross-platform social strategy topics.",
  },
  {
    domainId: "marketing-knowledge",
    knowledgeId: "sm-bridge-marketing-knowledge",
    title: "Marketing Knowledge (related)",
    description: "Social executes marketing goals on platforms.",
    relationshipEvidence: "Platform tactics serve marketing funnel and campaign goals.",
  },
  {
    domainId: "branding-knowledge",
    knowledgeId: "sm-bridge-branding-knowledge",
    title: "Branding Knowledge (related)",
    description: "Visual and voice consistency across social surfaces.",
    relationshipEvidence: "Feeds, Reels covers, and captions must stay on brand.",
  },
  {
    domainId: "storytelling-knowledge",
    knowledgeId: "sm-bridge-storytelling-knowledge",
    title: "Storytelling Knowledge (related)",
    description: "Hooks and narratives inherit storytelling craft.",
    relationshipEvidence: "Platform hooks still need story structure.",
  },
  {
    domainId: "video-production-knowledge",
    knowledgeId: "sm-bridge-video-production-knowledge",
    title: "Video Production Knowledge (related)",
    description: "Social video is produced with professional production craft.",
    relationshipEvidence: "Production delivers platform-ready assets.",
  },
  {
    domainId: "video-editing-knowledge",
    knowledgeId: "sm-bridge-video-editing-knowledge",
    title: "Video Editing Knowledge (related)",
    description: "Retention and platform pacing depend on edit craft.",
    relationshipEvidence: "Editors realize hooks, captions, and end cards.",
  },
  {
    domainId: "customer-psychology",
    knowledgeId: "sm-bridge-customer-psychology",
    title: "Customer Psychology (related)",
    description: "Attention and engagement follow psychology principles.",
    relationshipEvidence: "Scroll-stopping and community behavior are psychological.",
  },
  {
    domainId: "sales-psychology",
    knowledgeId: "sm-bridge-sales-psychology",
    title: "Sales Psychology (related)",
    description: "CTAs and offers on social use persuasion ethics.",
    relationshipEvidence: "Captions and end screens use persuasion carefully.",
  },
  {
    domainId: "product-knowledge",
    knowledgeId: "sm-bridge-product-knowledge",
    title: "Product Photography / Product Knowledge (related)",
    description: "Product truth enables honest social product presentation.",
    relationshipEvidence: "Product posts require accurate product knowledge.",
  },
];

export const REQUIRED_SOCIAL_FUNDAMENTALS_TOPIC_IDS: SocialFundamentalsTopicId[] =
  PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS.map((t) => t.topicId as SocialFundamentalsTopicId);
export const REQUIRED_TIKTOK_TOPIC_IDS: TikTokTopicId[] = PROFESSIONAL_TIKTOK_TOPICS.map((t) => t.topicId as TikTokTopicId);
export const REQUIRED_INSTAGRAM_TOPIC_IDS: InstagramTopicId[] = PROFESSIONAL_INSTAGRAM_TOPICS.map(
  (t) => t.topicId as InstagramTopicId
);
export const REQUIRED_FACEBOOK_TOPIC_IDS: FacebookTopicId[] = PROFESSIONAL_FACEBOOK_TOPICS.map(
  (t) => t.topicId as FacebookTopicId
);
export const REQUIRED_YOUTUBE_TOPIC_IDS: YouTubeTopicId[] = PROFESSIONAL_YOUTUBE_TOPICS.map((t) => t.topicId as YouTubeTopicId);

export function getAllSmTopics(): ProfessionalSmTopic[] {
  return [
    ...PROFESSIONAL_SOCIAL_FUNDAMENTALS_TOPICS,
    ...PROFESSIONAL_TIKTOK_TOPICS,
    ...PROFESSIONAL_INSTAGRAM_TOPICS,
    ...PROFESSIONAL_FACEBOOK_TOPICS,
    ...PROFESSIONAL_YOUTUBE_TOPICS,
  ];
}

export function getSmTopic(topicId: string): ProfessionalSmTopic | undefined {
  return getAllSmTopics().find((t) => t.topicId === topicId || t.knowledgeId === topicId);
}

export function findSmTopics(query: string, pool: ProfessionalSmTopic[] = getAllSmTopics()): ProfessionalSmTopic[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 1);
  if (!tokens.length) return [];
  return pool
    .map((topic) => {
      const hay = `${topic.name} ${topic.description} ${topic.keywords.join(" ")} ${topic.topicId}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += 2;
        if (topic.topicId.includes(token)) score += 3;
        if (topic.name.toLowerCase().includes(token)) score += 2;
      }
      return { topic, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.topic.confidenceScore - a.topic.confidenceScore)
    .map((r) => r.topic);
}

/** Catalog self-check for broken relatedTopics / domain bridges. */
export function checkSmCatalogRelationships(): { topicCount: number; broken: string[] } {
  const all = getAllSmTopics();
  const ids = new Set(all.map((t) => t.topicId));
  const bridgeDomains = new Set(SM_DOMAIN_BRIDGES.map((b) => b.domainId));
  const broken: string[] = [];
  for (const topic of all) {
    for (const related of topic.relatedTopics) {
      if (!ids.has(related)) broken.push(`${topic.topicId}→${related}`);
    }
    for (const domainId of topic.relatedDomains) {
      if (!bridgeDomains.has(domainId)) broken.push(`${topic.topicId}→bridge:${domainId}`);
    }
  }
  return { topicCount: all.length, broken };
}
