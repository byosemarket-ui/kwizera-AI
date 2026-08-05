/**
 * Curated Professional Animation, Motion Graphics & Rendering catalog (Expansion Step 5).
 */

import {
  ANIMATION_DOMAIN_ID,
  MOTION_GRAPHICS_DOMAIN_ID,
  PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION,
  RENDERING_DOMAIN_ID,
  type AmrDomainBridge,
  type AmrTopicId,
  type AnimationTopicId,
  type MotionGraphicsTopicId,
  type ProfessionalAmrTopic,
  type RenderingTopicId,
  type TransitionTopicId,
} from "./professional-animation-motion-rendering-types.js";

type PartialTopic = Omit<ProfessionalAmrTopic, "knowledgeId" | "title" | "metadata"> & {
  knowledgeId?: string;
  title?: string;
};

function metaFor(
  domainId: typeof ANIMATION_DOMAIN_ID | typeof MOTION_GRAPHICS_DOMAIN_ID | typeof RENDERING_DOMAIN_ID,
  category: ProfessionalAmrTopic["metadata"]["category"],
  confidenceScore: number
): ProfessionalAmrTopic["metadata"] {
  return {
    domainId,
    category,
    difficulty: confidenceScore >= 90 ? "advanced" : confidenceScore >= 84 ? "intermediate" : "foundation",
    expansionStep: 5,
    version: PROFESSIONAL_ANIMATION_MOTION_RENDERING_VERSION,
    learningOnly: true,
    generatesVideo: false,
    generatesImages: false,
  };
}

function anim(partial: PartialTopic): ProfessionalAmrTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `anim-${partial.topicId}`,
    title: partial.title ?? partial.name,
    metadata: metaFor(ANIMATION_DOMAIN_ID, "professional-animation", partial.confidenceScore),
  };
}

function motion(partial: PartialTopic): ProfessionalAmrTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `motion-${partial.topicId}`,
    title: partial.title ?? partial.name,
    metadata: metaFor(MOTION_GRAPHICS_DOMAIN_ID, "professional-motion-graphics", partial.confidenceScore),
  };
}

function trans(partial: PartialTopic): ProfessionalAmrTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `trans-${partial.topicId}`,
    title: partial.title ?? partial.name,
    metadata: metaFor(MOTION_GRAPHICS_DOMAIN_ID, "professional-transitions", partial.confidenceScore),
  };
}

function render(partial: PartialTopic): ProfessionalAmrTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `render-${partial.topicId}`,
    title: partial.title ?? partial.name,
    metadata: metaFor(RENDERING_DOMAIN_ID, "professional-rendering", partial.confidenceScore),
  };
}

export const PROFESSIONAL_ANIMATION_TOPICS: ProfessionalAmrTopic[] = [
  anim({
    topicId: "animation-fundamentals",
    name: "Animation Fundamentals",
    description: "Core ideas of change over time—pose, motion, weight, and readability—for marketing and product animation.",
    professionalDefinition: "Animation fundamentals are the baseline skills of making motion feel intentional, readable, and purposeful across 2D, 3D, and simple object animation.",
    purpose: "Establish a shared language so every animated beat serves clarity and persuasion.",
    bestPractices: ["Define the story job of each move", "Prefer readable silhouettes", "Animate on purpose, not decoration"],
    commonMistakes: ["Motion without meaning", "Over-animating every element"],
    workflow: ["Clarify intent", "Block key poses", "Add timing/spacing", "Polish arcs"],
    professionalExamples: ["Product float with subtle settle instead of constant spin"],
    relatedTopics: ["principles-of-animation", "timing", "staging", "product-animation"],
    relatedDomains: ["animation-knowledge", "storytelling-knowledge", "marketing-knowledge", "video-production-knowledge"],
    keywords: ["animation fundamentals", "motion basics", "keyframes", "pose"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  anim({
    topicId: "principles-of-animation",
    name: "Principles of Animation",
    description: "Classic animation principles adapted for commercial and motion-design work.",
    professionalDefinition: "The principles of animation are proven motion laws—timing, anticipation, staging, follow-through, and more—used to make movement believable and appealing.",
    purpose: "Give animators a checklist to elevate lifeless keyframes into professional motion.",
    bestPractices: ["Apply principles selectively per shot", "Prioritize staging and timing first", "Document which principles drive the shot"],
    commonMistakes: ["Forcing all 12 principles into every clip", "Ignoring staging for fancy secondary motion"],
    workflow: ["Pick 2–3 principles for the beat", "Block", "Layer secondaries", "Review readability"],
    professionalExamples: ["Logo mark anticipates then snaps with soft overshoot"],
    relatedTopics: ["timing", "anticipation", "squash-and-stretch", "follow-through", "appeal"],
    relatedDomains: ["animation-knowledge", "motion-graphics-knowledge", "storytelling-knowledge"],
    keywords: ["principles of animation", "12 principles", "Disney principles", "motion craft"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  anim({
    topicId: "timing",
    name: "Timing",
    description: "How long actions take and how that duration communicates weight, urgency, and tone.",
    professionalDefinition: "Timing is the duration of an action across frames, controlling perceived mass, energy, and emotional temperature.",
    purpose: "Make motion feel right for brand tone and product mass.",
    bestPractices: ["Match timing to mass and mood", "Hold important poses", "Test at delivery frame rate"],
    commonMistakes: ["Everything same duration", "Too fast to read on mobile"],
    workflow: ["Block poses", "Set duration", "Adjust holds", "Sync to audio if needed"],
    professionalExamples: ["Heavy appliance: slower settle; UI toggle: snappy 120–200ms feel"],
    relatedTopics: ["spacing", "motion-timing", "principles-of-animation", "frame-rate"],
    relatedDomains: ["animation-knowledge", "motion-graphics-knowledge", "rendering-knowledge"],
    keywords: ["timing", "duration", "frames", "weight", "tempo"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  anim({
    topicId: "spacing",
    name: "Spacing",
    description: "Distance between poses that creates ease-in/out, acceleration, and deceleration.",
    professionalDefinition: "Spacing is the distribution of in-betweens that shapes velocity curves—slow-ins, slow-outs, and linear vs. organic motion.",
    purpose: "Control how motion feels soft, mechanical, or energetic.",
    bestPractices: ["Ease into and out of key poses", "Reserve linear for mechanical UI", "Graph-edit for polish"],
    commonMistakes: ["Linear everything", "Overshoot that never settles"],
    workflow: ["Set keys", "Shape easing", "Check arcs", "Trim excess bounce"],
    professionalExamples: ["Soft ease-out on product landing; linear scrub on progress bar"],
    relatedTopics: ["timing", "motion-rhythm", "follow-through", "ui-motion"],
    relatedDomains: ["animation-knowledge", "motion-graphics-knowledge"],
    keywords: ["spacing", "easing", "ease in out", "interpolation", "velocity"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  anim({
    topicId: "anticipation",
    name: "Anticipation",
    description: "A preparatory move that telegraphs the main action so viewers can follow it.",
    professionalDefinition: "Anticipation is a brief opposite or preparatory motion that prepares the eye for a primary action.",
    purpose: "Improve readability and make reveals feel intentional.",
    bestPractices: ["Scale anticipation to action size", "Keep it short on social", "Use for logo snaps and character jumps"],
    commonMistakes: ["No wind-up on big moves", "Anticipation longer than the action"],
    workflow: ["Define main action", "Add reverse/prepare beat", "Time tightly", "Review clarity"],
    professionalExamples: ["Button depresses slightly before card expands"],
    relatedTopics: ["principles-of-animation", "staging", "product-animation", "logo-animation"],
    relatedDomains: ["animation-knowledge", "motion-graphics-knowledge", "storytelling-knowledge"],
    keywords: ["anticipation", "wind-up", "prepare", "telegraph"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  anim({
    topicId: "squash-and-stretch",
    name: "Squash and Stretch",
    description: "Volume-preserving deformation that sells flexibility, impact, and life.",
    professionalDefinition: "Squash and stretch is temporary shape change that preserves volume to communicate elasticity and force.",
    purpose: "Add life to characters and playful product moments without breaking believability.",
    bestPractices: ["Preserve volume", "Dial down for premium/realistic brands", "Use on impacts and landings"],
    commonMistakes: ["Melting logos unprofessionally", "Breaking rigid product materials"],
    workflow: ["Identify impact", "Add squash", "Recover stretch", "Settle to rest"],
    professionalExamples: ["Ball bounce; soft icon pop on notification"],
    relatedTopics: ["follow-through", "character-animation", "appeal", "principles-of-animation"],
    relatedDomains: ["animation-knowledge", "marketing-knowledge"],
    keywords: ["squash and stretch", "deform", "elasticity", "impact"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  anim({
    topicId: "follow-through",
    name: "Follow Through",
    description: "Parts that continue moving after the main body stops, selling inertia.",
    professionalDefinition: "Follow-through is residual motion of appendages or secondary parts after the primary mass has stopped.",
    purpose: "Make stops feel physical rather than robotic.",
    bestPractices: ["Offset secondary timing", "Settle cleanly", "Match material stiffness"],
    commonMistakes: ["Everything stops on the same frame", "Endless wobble"],
    workflow: ["Animate core", "Offset tails/cloth/labels", "Damp to rest"],
    professionalExamples: ["Coat tails after character stop; hangtag swing after product settle"],
    relatedTopics: ["secondary-action", "spacing", "character-animation", "product-animation"],
    relatedDomains: ["animation-knowledge", "motion-graphics-knowledge"],
    keywords: ["follow through", "inertia", "overlap", "settle"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  anim({
    topicId: "secondary-action",
    name: "Secondary Action",
    description: "Supporting motion that enriches the main action without stealing focus.",
    professionalDefinition: "Secondary action is additional motion that supports the primary action’s story and emotion while remaining subordinate.",
    purpose: "Add richness and life while keeping hierarchy clear.",
    bestPractices: ["Keep primary readable", "Lower amplitude on secondaries", "Cut secondaries that compete"],
    commonMistakes: ["Secondary louder than primary", "Busy loops"],
    workflow: ["Lock primary", "Add one secondary", "Balance", "Mute extras"],
    professionalExamples: ["Character blinks while speaking; sparkles after logo settle"],
    relatedTopics: ["follow-through", "staging", "motion-hierarchy", "character-animation"],
    relatedDomains: ["animation-knowledge", "storytelling-knowledge", "motion-graphics-knowledge"],
    keywords: ["secondary action", "supporting motion", "enrichment"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  anim({
    topicId: "staging",
    name: "Staging",
    description: "Presenting an idea so the audience’s eye knows exactly what matters.",
    professionalDefinition: "Staging is the clear presentation of an action or idea through pose, composition, contrast, and timing so intent is unmistakable.",
    purpose: "Ensure commercial messages read instantly, especially on small screens.",
    bestPractices: ["One idea at a time", "Use contrast and stillness", "Silhouette-test poses"],
    commonMistakes: ["Competing focal points", "Action hidden in clutter"],
    workflow: ["State the idea", "Clear the frame", "Pose for silhouette", "Time the hold"],
    professionalExamples: ["Single product lit and still before feature callout animates in"],
    relatedTopics: ["appeal", "motion-hierarchy", "animation-fundamentals", "principles-of-animation"],
    relatedDomains: ["animation-knowledge", "storytelling-knowledge", "lighting-knowledge", "camera-knowledge"],
    keywords: ["staging", "readability", "focus", "presentation"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  anim({
    topicId: "appeal",
    name: "Appeal",
    description: "The magnetic quality that makes designs and motion enjoyable to watch.",
    professionalDefinition: "Appeal is the combination of design clarity, charming motion, and tasteful restraint that makes characters or graphics engaging.",
    purpose: "Increase watchability and brand likability without gimmicks.",
    bestPractices: ["Simplify shapes", "Polish arcs", "Match brand personality"],
    commonMistakes: ["Ugly overcomplexity", "Trying to be cute off-brand"],
    workflow: ["Refine design", "Animate with taste", "Peer review appeal"],
    professionalExamples: ["Friendly mascot walk; elegant type settle for luxury"],
    relatedTopics: ["character-animation", "motion-style", "staging", "principles-of-animation"],
    relatedDomains: ["animation-knowledge", "marketing-knowledge", "motion-graphics-knowledge"],
    keywords: ["appeal", "charm", "watchability", "design appeal"],
    confidenceScore: 89,
    qualityScore: 88,
  }),
  anim({
    topicId: "character-animation",
    name: "Character Animation",
    description: "Animating people, mascots, or personas with acting, weight, and emotion.",
    professionalDefinition: "Character animation is performance-driven motion of a character that communicates intent, emotion, and personality through pose and timing.",
    purpose: "Humanize brands and make stories emotionally clear.",
    bestPractices: ["Act the beat", "Strong keys before polish", "Keep face/eye focus readable"],
    commonMistakes: ["Floating feet", "Emotionless loops"],
    workflow: ["Reference acting", "Block keys", "Breakdowns", "Lipsync/polish"],
    professionalExamples: ["Mascot reacts to product reveal with anticipation and settle"],
    relatedTopics: ["appeal", "anticipation", "follow-through", "staging"],
    relatedDomains: ["animation-knowledge", "storytelling-knowledge", "marketing-knowledge"],
    keywords: ["character animation", "acting", "mascot", "performance"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  anim({
    topicId: "product-animation",
    name: "Product Animation",
    description: "Motion that proves form, features, and desirability of physical or digital products.",
    professionalDefinition: "Product animation is purposeful motion of a product—turntables, feature callouts, assembly, or micro-interactions—that clarifies value.",
    purpose: "Sell understanding and desire without live footage when needed.",
    bestPractices: ["Keep scale honest", "Highlight one feature per beat", "End on hero rest pose"],
    commonMistakes: ["Endless spin with no story", "Hiding the logo"],
    workflow: ["Hero still", "Orbit/feature beats", "Callouts", "Settle + CTA hold"],
    professionalExamples: ["Exploded view then reassemble; soft float with specular pass"],
    relatedTopics: ["staging", "timing", "logo-animation", "render-quality"],
    relatedDomains: ["animation-knowledge", "marketing-knowledge", "rendering-knowledge", "lighting-knowledge"],
    keywords: ["product animation", "turntable", "exploded view", "3D product"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
];

export const PROFESSIONAL_MOTION_GRAPHICS_TOPICS: ProfessionalAmrTopic[] = [
  motion({
    topicId: "motion-design",
    name: "Motion Design",
    description: "The discipline of designing animated visual communication for brands and interfaces.",
    professionalDefinition: "Motion design is the practice of solving communication problems with animated graphics, type, and systems aligned to brand and platform.",
    purpose: "Unify style, timing, and hierarchy into a coherent motion language.",
    bestPractices: ["Design stills that animate well", "Build a motion system", "Prototype on device"],
    commonMistakes: ["Decorating instead of communicating", "Inconsistent easing across a brand"],
    workflow: ["Brief", "Boards", "Style frames", "Animate", "Deliver specs"],
    professionalExamples: ["Brand open + lower-third system for a campaign"],
    relatedTopics: ["motion-graphics-fundamentals", "motion-style", "motion-hierarchy", "text-animation"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "animation-knowledge", "video-production-knowledge"],
    keywords: ["motion design", "motion system", "branded motion"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  motion({
    topicId: "motion-graphics-fundamentals",
    name: "Motion Graphics Fundamentals",
    description: "Building blocks of kinetic graphics: layout, type, shape, and timed reveals.",
    professionalDefinition: "Motion graphics fundamentals cover composition, typography in motion, shape language, and basic timing for informational and branded graphics.",
    purpose: "Teach readable animated graphics for ads, explainers, and social.",
    bestPractices: ["Type legibility first", "Limit simultaneous moves", "Safe margins for platforms"],
    commonMistakes: ["Tiny type in motion", "Edge-clipped graphics"],
    workflow: ["Layout still", "Animate hierarchy", "Time to VO/music", "Export checks"],
    professionalExamples: ["Kinetic list of three benefits with staggered fades"],
    relatedTopics: ["text-animation", "motion-timing", "motion-hierarchy", "staging"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "storytelling-knowledge"],
    keywords: ["motion graphics", "fundamentals", "kinetic graphics", "MG"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  motion({
    topicId: "text-animation",
    name: "Text Animation",
    description: "Animating typography for emphasis, rhythm, and readability.",
    professionalDefinition: "Text animation is the timed reveal, emphasis, and exit of typographic content that supports voiceover and hierarchy.",
    purpose: "Make messages scannable and memorable on mute-heavy platforms.",
    bestPractices: ["Readable duration", "Respect line length", "Match brand type motion rules"],
    commonMistakes: ["Word salad chaos", "Animating faster than reading speed"],
    workflow: ["Write short lines", "Set reading time", "Animate in hierarchy", "Hold"],
    professionalExamples: ["Word-by-word punch for hook; elegant fade for luxury copy"],
    relatedTopics: ["motion-rhythm", "motion-hierarchy", "motion-timing", "logo-animation"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "storytelling-knowledge"],
    keywords: ["text animation", "kinetic type", "typography motion", "titles"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  motion({
    topicId: "logo-animation",
    name: "Logo Animation",
    description: "Bringing brand marks to life with controlled, on-brand motion.",
    professionalDefinition: "Logo animation is choreographed motion of a brand mark—intros, outros, and stingers—that reinforces identity without distorting the logo’s integrity.",
    purpose: "Create recognizable brand punctuation at open/close.",
    bestPractices: ["Protect logo geometry", "End on approved lockup", "Keep under a few seconds for social"],
    commonMistakes: ["Warping trademark shapes", "Overlong intros"],
    workflow: ["Get brand rules", "Storyboard", "Animate to rest lockup", "Deliver masters"],
    professionalExamples: ["Stroke draw + settle; 3D light pass then flat lockup"],
    relatedTopics: ["anticipation", "appeal", "motion-style", "export-settings"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "rendering-knowledge"],
    keywords: ["logo animation", "logo sting", "brand mark motion", "ident"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  motion({
    topicId: "icon-animation",
    name: "Icon Animation",
    description: "Micro-motion for icons that clarifies state and delight without noise.",
    professionalDefinition: "Icon animation is short, purposeful motion of icons to signal state changes, feedback, or feature highlights.",
    purpose: "Improve UI clarity and feature explainers.",
    bestPractices: ["Keep loops subtle", "Prefer morphs over spins", "Match UI motion tokens"],
    commonMistakes: ["Hypnotic loops", "Inconsistent stroke timing"],
    workflow: ["Define state", "Animate change", "Ease", "Export Lottie/video as needed"],
    professionalExamples: ["Checkmark draw-on; cart icon bounce on add"],
    relatedTopics: ["ui-motion", "spacing", "motion-timing", "product-animation"],
    relatedDomains: ["motion-graphics-knowledge", "animation-knowledge", "marketing-knowledge"],
    keywords: ["icon animation", "microinteraction", "icon motion"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  motion({
    topicId: "ui-motion",
    name: "UI Motion",
    description: "Interface transitions and feedback motion for products and product videos.",
    professionalDefinition: "UI motion is the choreography of interface elements—navigation, feedback, and state—that communicates responsiveness and hierarchy.",
    purpose: "Make digital products feel coherent and trustworthy.",
    bestPractices: ["Shared durations/easings", "Motion follows user action", "Reduce motion accessibility options"],
    commonMistakes: ["Parallax overload", "Blocking interactions with long animation"],
    workflow: ["Define tokens", "Prototype", "Implement", "Document in motion spec"],
    professionalExamples: ["Sheet slides up 280ms ease-out; success toast fades"],
    relatedTopics: ["motion-timing", "spacing", "icon-animation", "motion-hierarchy"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "animation-knowledge"],
    keywords: ["UI motion", "interface animation", "product UI", "microinteractions"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  motion({
    topicId: "motion-rhythm",
    name: "Motion Rhythm",
    description: "The patterned timing of moves that creates musical or editorial pulse.",
    professionalDefinition: "Motion rhythm is the recurring pattern of accents, holds, and releases that gives a sequence musicality and brand tempo.",
    purpose: "Align graphics to music and keep attention through patterned beats.",
    bestPractices: ["Hit accents on audio", "Alternate dense/sparse beats", "Don’t sync every frame literally"],
    commonMistakes: ["Arrhythmic chaos", "Constant same interval"],
    workflow: ["Mark audio beats", "Assign accents", "Offset supporting layers", "Review mute"],
    professionalExamples: ["Benefit cards snap on snare hits"],
    relatedTopics: ["motion-timing", "text-animation", "timing", "cut"],
    relatedDomains: ["motion-graphics-knowledge", "storytelling-knowledge", "video-editing-knowledge"],
    keywords: ["motion rhythm", "beat sync", "tempo", "pulse"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  motion({
    topicId: "motion-hierarchy",
    name: "Motion Hierarchy",
    description: "Ordering what moves first and strongest so attention follows the message.",
    professionalDefinition: "Motion hierarchy prioritizes animated elements by amplitude, timing, and contrast so the primary message leads.",
    purpose: "Prevent visual competition in dense graphics packages.",
    bestPractices: ["One hero move", "Stagger supports", "Stillness as hierarchy tool"],
    commonMistakes: ["Everything moves equally", "Background louder than title"],
    workflow: ["Rank elements", "Assign energy budgets", "Animate", "Mute rivals"],
    professionalExamples: ["Title scales in; supporting icons fade later at lower amplitude"],
    relatedTopics: ["staging", "text-animation", "secondary-action", "motion-design"],
    relatedDomains: ["motion-graphics-knowledge", "storytelling-knowledge", "marketing-knowledge"],
    keywords: ["motion hierarchy", "attention order", "primary motion"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  motion({
    topicId: "motion-timing",
    name: "Motion Timing",
    description: "Duration standards for graphics, UI, and branded motion systems.",
    professionalDefinition: "Motion timing for graphics defines duration ranges and easing conventions that keep a brand’s motion language consistent.",
    purpose: "Speed craft and consistency across teams and templates.",
    bestPractices: ["Document tokens (e.g., 150/250/400ms)", "Longer for large spatial moves", "Test on target devices"],
    commonMistakes: ["Random durations per shot", "Ignoring platform reading speed"],
    workflow: ["Define tokens", "Apply to comps", "QA across templates"],
    professionalExamples: ["Brand book: micro 120ms, standard 240ms, expressive 480ms"],
    relatedTopics: ["timing", "ui-motion", "motion-rhythm", "spacing"],
    relatedDomains: ["motion-graphics-knowledge", "animation-knowledge", "rendering-knowledge"],
    keywords: ["motion timing", "duration tokens", "easing standards"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  motion({
    topicId: "motion-style",
    name: "Motion Style",
    description: "The aesthetic fingerprint of motion—editorial, playful, corporate, cinematic.",
    professionalDefinition: "Motion style is the characteristic combination of easing, shape language, texture, and camera behavior that expresses brand personality.",
    purpose: "Keep campaigns visually coherent and on-brand.",
    bestPractices: ["Write a motion style frame", "Limit to 1–2 style drivers", "Reuse across assets"],
    commonMistakes: ["Style mashups", "Trend-chasing off-brand"],
    workflow: ["Mood refs", "Style frames", "Pilot shot", "Systematize"],
    professionalExamples: ["Soft editorial fades vs snappy social pops for same brand tiers"],
    relatedTopics: ["motion-design", "logo-animation", "appeal", "creative-transitions"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "animation-knowledge"],
    keywords: ["motion style", "aesthetic", "brand motion personality"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
];

export const PROFESSIONAL_TRANSITION_TOPICS: ProfessionalAmrTopic[] = [
  trans({
    topicId: "cut",
    name: "Cut",
    description: "An instantaneous change from one shot to another—the default editorial transition.",
    professionalDefinition: "A cut is an immediate splice between shots with no optical blend, used for clarity, pace, and invisible continuity.",
    purpose: "Maintain energy and clarity; the workhorse of professional editing.",
    bestPractices: ["Cut on action when possible", "Match continuity", "Prefer cuts unless a blend adds meaning"],
    commonMistakes: ["Cutting mid-blink awkwardly", "Using fancy transitions as default"],
    workflow: ["Select take", "Mark in/out", "Cut", "Trim for rhythm"],
    professionalExamples: ["Action match from pour start to mid-pour angle"],
    relatedTopics: ["match-cut", "motion-rhythm", "fade", "dissolve"],
    relatedDomains: ["motion-graphics-knowledge", "video-editing-knowledge", "storytelling-knowledge", "video-production-knowledge"],
    keywords: ["cut", "hard cut", "edit", "splice"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  trans({
    topicId: "fade",
    name: "Fade",
    description: "Transition to/from black (or a color) signaling time, chapter, or closure.",
    professionalDefinition: "A fade gradually changes opacity to or from a solid color, typically black, to indicate passage of time or structural boundaries.",
    purpose: "Softly open/close chapters or end films.",
    bestPractices: ["Use sparingly", "Fade-out for endings", "Match audio fades"],
    commonMistakes: ["Fading every scene", "Long fades killing pace"],
    workflow: ["Decide meaning", "Set duration", "Align audio", "Review"],
    professionalExamples: ["Fade from black into brand film; fade out under CTA"],
    relatedTopics: ["dissolve", "cut", "export-settings", "creative-transitions"],
    relatedDomains: ["motion-graphics-knowledge", "video-editing-knowledge", "storytelling-knowledge"],
    keywords: ["fade", "fade in", "fade out", "fade to black"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  trans({
    topicId: "dissolve",
    name: "Dissolve",
    description: "Crossfade between two images suggesting connection or soft time passage.",
    professionalDefinition: "A dissolve (crossfade) overlaps the end of one shot with the start of another by blending opacity.",
    purpose: "Link ideas gently or compress time without a hard cut.",
    bestPractices: ["Motivate the blend", "Watch mid-dissolve mud", "Keep durations intentional"],
    commonMistakes: ["Default dissolve everywhere", "Unrelated shots blended"],
    workflow: ["Align overlapping handles", "Set dissolve length", "Check midpoint"],
    professionalExamples: ["Morning to night city dissolve; idea A morphs conceptually to B"],
    relatedTopics: ["fade", "match-cut", "luma-transition", "cut"],
    relatedDomains: ["motion-graphics-knowledge", "video-editing-knowledge", "storytelling-knowledge"],
    keywords: ["dissolve", "crossfade", "mix", "blend transition"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  trans({
    topicId: "wipe",
    name: "Wipe",
    description: "A geometric leading edge that replaces one shot with another.",
    professionalDefinition: "A wipe transitions by a moving boundary (line, clock, iris edge) that reveals the next shot.",
    purpose: "Stylized scene changes or chapter markers.",
    bestPractices: ["Match brand geometry", "Avoid dated default wipes", "Use with graphic packages"],
    commonMistakes: ["Random star wipes", "Fighting story tone"],
    workflow: ["Choose shape", "Direction motivated", "Time with graphics", "Deliver"],
    professionalExamples: ["Brand-colored linear wipe into new chapter title"],
    relatedTopics: ["shape-transition", "creative-transitions", "motion-style", "cut"],
    relatedDomains: ["motion-graphics-knowledge", "video-editing-knowledge", "marketing-knowledge"],
    keywords: ["wipe", "push wipe", "clock wipe", "edge transition"],
    confidenceScore: 88,
    qualityScore: 87,
  }),
  trans({
    topicId: "match-cut",
    name: "Match Cut",
    description: "A cut that links shots through matched action, shape, or concept.",
    professionalDefinition: "A match cut joins two shots by aligning motion, composition, or metaphor so the cut feels continuous or cleverly associative.",
    purpose: "Create elegant narrative or visual bridges.",
    bestPractices: ["Plan on set/in boards", "Match speed and frame", "Serve story not only cleverness"],
    commonMistakes: ["Forced matches", "Mismatched timing"],
    workflow: ["Design match", "Shoot/animate both sides", "Align cut point", "Polish"],
    professionalExamples: ["Spinning tire to spinning logo; eye open to sunrise"],
    relatedTopics: ["cut", "camera-transition", "staging", "creative-transitions"],
    relatedDomains: ["motion-graphics-knowledge", "storytelling-knowledge", "camera-knowledge", "video-editing-knowledge"],
    keywords: ["match cut", "graphic match", "action match"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  trans({
    topicId: "luma-transition",
    name: "Luma Transition",
    description: "Transitions driven by luminance maps or light-based reveals.",
    professionalDefinition: "A luma transition uses brightness information—often a gradient or animated matte—to blend or reveal shots.",
    purpose: "Create light-motivated, premium graphic transitions.",
    bestPractices: ["Motivate with light sources", "Keep mid-tones clean", "Test on delivery gamma"],
    commonMistakes: ["Noisy luma mattes", "Clipping weirdness in HDR"],
    workflow: ["Design luma matte", "Animate", "Composite", "Color-manage"],
    professionalExamples: ["Light sweep reveal of product from darkness"],
    relatedTopics: ["dissolve", "hdr", "color-space", "creative-transitions"],
    relatedDomains: ["motion-graphics-knowledge", "lighting-knowledge", "rendering-knowledge", "video-editing-knowledge"],
    keywords: ["luma transition", "luminance wipe", "light reveal"],
    confidenceScore: 89,
    qualityScore: 88,
  }),
  trans({
    topicId: "shape-transition",
    name: "Shape Transition",
    description: "Reveals or morphs using branded shapes and masks.",
    professionalDefinition: "A shape transition uses geometric or brand-shaped mattes to reveal the next shot or graphic.",
    purpose: "Tie transitions to brand identity systems.",
    bestPractices: ["Use brand shapes", "Ease edges", "End clean for next scene"],
    commonMistakes: ["Off-brand shapes", "Jagged mask edges"],
    workflow: ["Pick shape", "Animate matte", "Feather if needed", "QA"],
    professionalExamples: ["Rounded square expands to full frame like app icon"],
    relatedTopics: ["wipe", "logo-animation", "motion-style", "creative-transitions"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "video-editing-knowledge"],
    keywords: ["shape transition", "mask reveal", "geometric transition"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  trans({
    topicId: "zoom-transition",
    name: "Zoom Transition",
    description: "Scale-based transition that rushes into or out of a subject.",
    professionalDefinition: "A zoom transition uses rapid scale (optical or digital) to bridge shots, often with motion blur for energy.",
    purpose: "Energetic social pacing or dive into detail.",
    bestPractices: ["Add blur for speed", "Match destination framing", "Don’t overuse"],
    commonMistakes: ["Soft/pixelated digital zooms", "Seasickness from excess"],
    workflow: ["Align center of interest", "Animate scale", "Blur", "Cut on peak"],
    professionalExamples: ["Snap zoom into product detail then cut wide"],
    relatedTopics: ["camera-transition", "cut", "motion-rhythm", "creative-transitions"],
    relatedDomains: ["motion-graphics-knowledge", "camera-knowledge", "video-editing-knowledge"],
    keywords: ["zoom transition", "snap zoom", "scale transition"],
    confidenceScore: 88,
    qualityScore: 87,
  }),
  trans({
    topicId: "camera-transition",
    name: "Camera Transition",
    description: "Transitions motivated by simulated or real camera moves (whip, push, orbit).",
    professionalDefinition: "A camera transition bridges shots using camera-like motion—whip pans, push-ins, or parallax—so the edit feels photographic.",
    purpose: "Maintain cinematic continuity between scenes.",
    bestPractices: ["Match direction and speed", "Plan on set when possible", "Use motion blur"],
    commonMistakes: ["Unmotivated whip spam", "Direction mismatches"],
    workflow: ["Choose move", "Match vectors", "Blend/cut at blur peak", "Stabilize landing"],
    professionalExamples: ["Whip pan from lifestyle to studio hero"],
    relatedTopics: ["match-cut", "zoom-transition", "cut", "creative-transitions"],
    relatedDomains: ["motion-graphics-knowledge", "camera-knowledge", "video-editing-knowledge", "video-production-knowledge"],
    keywords: ["camera transition", "whip pan", "push transition", "parallax bridge"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  trans({
    topicId: "creative-transitions",
    name: "Creative Transitions",
    description: "Custom, concept-driven transitions unique to a campaign’s visual idea.",
    professionalDefinition: "Creative transitions are bespoke transitional devices—morphs, object wipes, or graphic gags—designed for a specific narrative or brand concept.",
    purpose: "Make signature moments memorable when budget and concept support them.",
    bestPractices: ["Concept first", "Reuse as a motif", "Don’t invent one per cut"],
    commonMistakes: ["Creativity without clarity", "Inconsistent rules"],
    workflow: ["Ideate motif", "Prototype one", "Systematize", "Apply sparingly"],
    professionalExamples: ["Product lid closes as wipe; ink bleed morph between scenes"],
    relatedTopics: ["motion-style", "shape-transition", "match-cut", "luma-transition"],
    relatedDomains: ["motion-graphics-knowledge", "marketing-knowledge", "storytelling-knowledge", "animation-knowledge"],
    keywords: ["creative transitions", "custom transition", "signature transition"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
];

export const PROFESSIONAL_RENDERING_TOPICS: ProfessionalAmrTopic[] = [
  render({
    topicId: "rendering-fundamentals",
    name: "Rendering Fundamentals",
    description: "How frames are computed or encoded into deliverable media without generating content here—knowledge only.",
    professionalDefinition: "Rendering fundamentals cover the concepts of turning timelines, 3D scenes, or graded masters into finished pixel/audio streams for review or delivery.",
    purpose: "Help teams choose sensible render/export strategies.",
    bestPractices: ["Separate preview vs final", "Lock color pipeline early", "Document targets"],
    commonMistakes: ["Finalizing from proxy settings", "Ignoring color management"],
    workflow: ["Define deliverable", "Set project settings", "Render/export", "QC"],
    professionalExamples: ["Proxy edit → mezzanine → platform encodes"],
    relatedTopics: ["render-pipeline", "export-settings", "render-quality", "color-space"],
    relatedDomains: ["rendering-knowledge", "video-production-knowledge", "video-editing-knowledge"],
    keywords: ["rendering fundamentals", "export basics", "deliverables", "QC"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  render({
    topicId: "render-pipeline",
    name: "Render Pipeline",
    description: "The staged path from working files to masters and distribution encodes.",
    professionalDefinition: "A render pipeline is the ordered sequence of processes—cache, beauty pass, composite, grade, encode—that produces consistent outputs.",
    purpose: "Prevent quality loss and rework through structured stages.",
    bestPractices: ["Mezzanine masters", "Immutable finals", "Version naming"],
    commonMistakes: ["Re-encoding finals repeatedly", "No checksum/QC gate"],
    workflow: ["Online", "Master", "Derive platform encodes", "Archive"],
    professionalExamples: ["ProRes master → H.264/H.265 social variants"],
    relatedTopics: ["video-codecs", "compression", "export-settings", "performance-optimization"],
    relatedDomains: ["rendering-knowledge", "video-editing-knowledge", "video-production-knowledge"],
    keywords: ["render pipeline", "mezzanine", "mastering", "encode chain"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  render({
    topicId: "render-quality",
    name: "Render Quality",
    description: "Tradeoffs among sharpness, noise, banding, and compute time.",
    professionalDefinition: "Render quality is the perceived and measured fidelity of an output relative to the source and creative intent.",
    purpose: "Hit acceptable quality at sustainable cost/time.",
    bestPractices: ["QC on calibrated display", "Watch gradients for banding", "Don’t oversharpen encodes"],
    commonMistakes: ["Judging on phone only", "Crushing bit depth early"],
    workflow: ["Set quality target", "Sample frames", "Compare A/B", "Approve"],
    professionalExamples: ["10-bit master to avoid sky banding in grade"],
    relatedTopics: ["bitrate", "compression", "resolution", "hdr"],
    relatedDomains: ["rendering-knowledge", "lighting-knowledge", "video-editing-knowledge"],
    keywords: ["render quality", "fidelity", "banding", "QC"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  render({
    topicId: "resolution",
    name: "Resolution",
    description: "Pixel dimensions of working and delivery formats (e.g., 1080p, 4K).",
    professionalDefinition: "Resolution is the frame’s pixel width×height (and sometimes pixel aspect) defining spatial detail for edit and delivery.",
    purpose: "Match platform and future-proofing needs without waste.",
    bestPractices: ["Shoot/master ≥ delivery", "Know platform max", "Avoid upscaling soft sources"],
    commonMistakes: ["Delivering 4K when source is 1080", "Wrong vertical specs"],
    workflow: ["Pick delivery list", "Set sequence", "Export variants", "Verify metadata"],
    professionalExamples: ["4K master; 1080p YouTube; 1080×1920 Stories"],
    relatedTopics: ["export-settings", "frame-rate", "render-quality", "performance-optimization"],
    relatedDomains: ["rendering-knowledge", "camera-knowledge", "marketing-knowledge"],
    keywords: ["resolution", "4K", "1080p", "pixel dimensions"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  render({
    topicId: "frame-rate",
    name: "Frame Rate",
    description: "Temporal resolution of motion (fps) for capture, motion, and delivery.",
    professionalDefinition: "Frame rate is the number of frames displayed per second, affecting motion smoothness, shutter look, and platform compatibility.",
    purpose: "Keep motion natural and platform-legal.",
    bestPractices: ["Match project fps early", "Know 24/25/30/60 use cases", "Document for motion design"],
    commonMistakes: ["Mixed fps without standards conversion", "Judder from wrong cadence"],
    workflow: ["Lock fps", "Animate/edit natively", "Conform if needed", "Export"],
    professionalExamples: ["24fps cinematic; 30fps social; 60fps smooth UI capture"],
    relatedTopics: ["timing", "motion-timing", "export-settings", "resolution"],
    relatedDomains: ["rendering-knowledge", "camera-knowledge", "animation-knowledge", "video-editing-knowledge"],
    keywords: ["frame rate", "fps", "24p", "60fps", "cadence"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  render({
    topicId: "bitrate",
    name: "Bitrate",
    description: "Data rate controlling how much information an encode retains per second.",
    professionalDefinition: "Bitrate is the volume of data allocated per second of media, strongly influencing compression artifacts and file size.",
    purpose: "Balance quality and bandwidth/storage constraints.",
    bestPractices: ["VBR 2-pass when available", "Higher bitrate for high motion/detail", "Follow platform recommendations"],
    commonMistakes: ["Too low on text-heavy motion graphics", "Huge files with no quality gain"],
    workflow: ["Check platform guide", "Set bitrate", "Sample encode", "QC"],
    professionalExamples: ["1080p H.264 ~8–12 Mbps for crisp titles"],
    relatedTopics: ["compression", "video-codecs", "render-quality", "export-settings"],
    relatedDomains: ["rendering-knowledge", "marketing-knowledge", "video-editing-knowledge"],
    keywords: ["bitrate", "Mbps", "VBR", "CBR", "data rate"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  render({
    topicId: "compression",
    name: "Compression",
    description: "Reducing data size via codecs and settings with controlled quality loss.",
    professionalDefinition: "Compression applies algorithms (often lossy) to shrink media size, trading detail for efficiency under bitrate and codec constraints.",
    purpose: "Make delivery practical for web and social without destroying craft.",
    bestPractices: ["Compress from high-quality masters", "Avoid generational loss", "Prefer modern codecs when supported"],
    commonMistakes: ["Export → reimport → re-export loops", "Heavy compression on gradients"],
    workflow: ["Master lightly compressed", "Create delivery encodes", "Compare", "Ship"],
    professionalExamples: ["ProRes master → H.265 delivery for 4K social"],
    relatedTopics: ["video-codecs", "bitrate", "render-pipeline", "render-quality"],
    relatedDomains: ["rendering-knowledge", "video-editing-knowledge", "video-production-knowledge"],
    keywords: ["compression", "lossy", "artifacts", "encode"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  render({
    topicId: "video-codecs",
    name: "Video Codecs",
    description: "Encode/decode formats such as H.264, H.265, ProRes, DNx, AV1.",
    professionalDefinition: "Video codecs are standardized methods for compressing and decompressing video streams for editing, mezzanine, or distribution.",
    purpose: "Pick the right codec for editability vs delivery.",
    bestPractices: ["Mezzanine: ProRes/DNx", "Delivery: H.264/H.265/AV1 per platform", "Match profiles/levels"],
    commonMistakes: ["Editing long-GOP heavily", "Wrong color tags in bitstream"],
    workflow: ["Choose role", "Set profile", "Encode", "Validate playback"],
    professionalExamples: ["Apple ProRes 422 HQ master; H.264 High@4.2 for YouTube"],
    relatedTopics: ["compression", "export-settings", "color-space", "bitrate"],
    relatedDomains: ["rendering-knowledge", "video-editing-knowledge", "video-production-knowledge"],
    keywords: ["codecs", "H.264", "H.265", "ProRes", "AV1"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  render({
    topicId: "color-space",
    name: "Color Space",
    description: "Color encoding systems (Rec.709, Display P3, Rec.2020) and tagging.",
    professionalDefinition: "Color space defines the gamut and transfer characteristics used to represent color in a pipeline, requiring correct tagging and conversion.",
    purpose: "Keep brand colors accurate from grade to device.",
    bestPractices: ["Tag correctly", "Convert intentionally", "Grade in managed pipeline"],
    commonMistakes: ["Untagged exports", "P3 content forced as 709"],
    workflow: ["Set working space", "Grade", "Convert for delivery", "Verify on targets"],
    professionalExamples: ["ACEScct grade → Rec.709 legal delivery"],
    relatedTopics: ["hdr", "export-settings", "render-quality", "luma-transition"],
    relatedDomains: ["rendering-knowledge", "lighting-knowledge", "video-editing-knowledge"],
    keywords: ["color space", "Rec.709", "P3", "Rec.2020", "gamma"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  render({
    topicId: "hdr",
    name: "HDR",
    description: "High dynamic range delivery (PQ/HLG) and mastering considerations.",
    professionalDefinition: "HDR extends luminance and often gamut beyond SDR, requiring compatible mastering, metadata, and careful tone mapping for SDR fallsbacks.",
    purpose: "Deliver premium brightness/contrast when platforms and creatives support it.",
    bestPractices: ["Master with HDR monitor", "Provide SDR trim", "Validate metadata"],
    commonMistakes: ["HDR look crushed on SDR", "No fallback"],
    workflow: ["Decide HDR need", "Master", "Tone-map SDR", "Package"],
    professionalExamples: ["HDR10 master + Rec.709 SDR derive for YouTube"],
    relatedTopics: ["color-space", "render-quality", "export-settings", "bitrate"],
    relatedDomains: ["rendering-knowledge", "lighting-knowledge", "video-production-knowledge"],
    keywords: ["HDR", "PQ", "HLG", "HDR10", "tone mapping"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  render({
    topicId: "export-settings",
    name: "Export Settings",
    description: "The concrete preset choices for resolution, codec, audio, and metadata on export.",
    professionalDefinition: "Export settings are the configured parameters—format, codec, resolution, fps, bitrate, audio, and color tags—used to generate a deliverable file.",
    purpose: "Produce platform-correct files efficiently and repeatedly.",
    bestPractices: ["Save presets per platform", "Include loudness targets", "Burn-in vs clean versions"],
    commonMistakes: ["Wrong aspect", "Muted audio tracks", "Interlaced by accident"],
    workflow: ["Load preset", "Override per job", "Export", "QC checklist"],
    professionalExamples: ["Instagram Reels 1080×1920 H.264 AAC stereo −14 LUFS"],
    relatedTopics: ["video-codecs", "resolution", "bitrate", "frame-rate", "render-pipeline"],
    relatedDomains: ["rendering-knowledge", "marketing-knowledge", "video-editing-knowledge"],
    keywords: ["export settings", "presets", "delivery settings", "encode preset"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  render({
    topicId: "performance-optimization",
    name: "Performance Optimization",
    description: "Speeding renders and exports via caching, hardware, and smarter settings.",
    professionalDefinition: "Performance optimization is the set of practices that reduce render/export time while protecting required quality—proxies, GPU, distributed renders, and lean effects.",
    purpose: "Hit deadlines without sacrificing final fidelity.",
    bestPractices: ["Proxy edit", "Pre-render heavy comps", "Hardware encode when quality OK", "Clean caches wisely"],
    commonMistakes: ["Final quality while scrubbing", "Unlimited effects stacks"],
    workflow: ["Profile bottlenecks", "Optimize", "Final quality pass", "Benchmark"],
    professionalExamples: ["AE prerender → Premiere link; Media Encoder watch folder"],
    relatedTopics: ["render-pipeline", "export-settings", "render-quality", "compression"],
    relatedDomains: ["rendering-knowledge", "video-editing-knowledge", "video-production-knowledge"],
    keywords: ["performance", "render speed", "proxies", "GPU encode", "optimization"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
];

export const AMR_DOMAIN_BRIDGES: AmrDomainBridge[] = [
  {
    domainId: "animation-knowledge",
    knowledgeId: "amr-bridge-animation-knowledge",
    title: "Animation Knowledge Domain",
    description: "Hub for professional animation expansion Step 5.",
    relationshipEvidence: "Primary domain for animation principle topics.",
  },
  {
    domainId: "motion-graphics-knowledge",
    knowledgeId: "amr-bridge-motion-graphics-knowledge",
    title: "Motion Graphics Knowledge Domain",
    description: "Hub for motion graphics and transitions expansion Step 5.",
    relationshipEvidence: "Primary domain for motion graphics and transition topics.",
  },
  {
    domainId: "rendering-knowledge",
    knowledgeId: "amr-bridge-rendering-knowledge",
    title: "Rendering Knowledge Domain",
    description: "Hub for rendering and export expansion Step 5.",
    relationshipEvidence: "Primary domain for rendering and delivery topics.",
  },
  {
    domainId: "video-production-knowledge",
    knowledgeId: "amr-bridge-video-production-knowledge",
    title: "Video Production Knowledge (related)",
    description: "Animation and renders sit inside production workflows.",
    relationshipEvidence: "Production plans schedule animation and delivery encodes.",
  },
  {
    domainId: "camera-knowledge",
    knowledgeId: "amr-bridge-camera-knowledge",
    title: "Camera Knowledge (related)",
    description: "Camera fps/resolution choices constrain motion and renders.",
    relationshipEvidence: "Capture settings define render targets and motion cadence.",
  },
  {
    domainId: "lighting-knowledge",
    knowledgeId: "amr-bridge-lighting-knowledge",
    title: "Lighting Knowledge (related)",
    description: "Lighting and HDR/color pipelines interconnect.",
    relationshipEvidence: "Look intent must survive render color management.",
  },
  {
    domainId: "storytelling-knowledge",
    knowledgeId: "amr-bridge-storytelling-knowledge",
    title: "Storytelling Knowledge (related)",
    description: "Motion and transitions serve narrative beats.",
    relationshipEvidence: "Animation staging and transition choice express story.",
  },
  {
    domainId: "video-editing-knowledge",
    knowledgeId: "amr-bridge-video-editing-knowledge",
    title: "Editing Knowledge (related)",
    description: "Transitions and exports are executed in editing/finishing.",
    relationshipEvidence: "Editors apply transitions and export settings.",
  },
  {
    domainId: "marketing-knowledge",
    knowledgeId: "amr-bridge-marketing-knowledge",
    title: "Marketing Knowledge (related)",
    description: "Motion style and platform exports serve marketing goals.",
    relationshipEvidence: "Delivery presets and brand motion support campaigns.",
  },
];

export const REQUIRED_ANIMATION_TOPIC_IDS: AnimationTopicId[] = PROFESSIONAL_ANIMATION_TOPICS.map(
  (t) => t.topicId as AnimationTopicId
);
export const REQUIRED_MOTION_GRAPHICS_TOPIC_IDS: MotionGraphicsTopicId[] = PROFESSIONAL_MOTION_GRAPHICS_TOPICS.map(
  (t) => t.topicId as MotionGraphicsTopicId
);
export const REQUIRED_TRANSITION_TOPIC_IDS: TransitionTopicId[] = PROFESSIONAL_TRANSITION_TOPICS.map(
  (t) => t.topicId as TransitionTopicId
);
export const REQUIRED_RENDERING_TOPIC_IDS: RenderingTopicId[] = PROFESSIONAL_RENDERING_TOPICS.map(
  (t) => t.topicId as RenderingTopicId
);

export function getAmrTopic(id: string): ProfessionalAmrTopic | null {
  const all = [
    ...PROFESSIONAL_ANIMATION_TOPICS,
    ...PROFESSIONAL_MOTION_GRAPHICS_TOPICS,
    ...PROFESSIONAL_TRANSITION_TOPICS,
    ...PROFESSIONAL_RENDERING_TOPICS,
  ];
  return all.find((t) => t.topicId === id || t.knowledgeId === id || t.name.toLowerCase() === id.toLowerCase()) ?? null;
}

export function findAmrTopics(
  query: string,
  pool: ProfessionalAmrTopic[]
): ProfessionalAmrTopic[] {
  return rankTopics(query, pool, identityHay, (t) => [t.topicId, t.name, t.title]);
}

function identityHay(t: ProfessionalAmrTopic): string[] {
  return [
    t.topicId,
    t.name,
    t.title,
    t.description,
    t.purpose,
    t.professionalDefinition,
    ...t.keywords,
    ...t.bestPractices,
    ...t.workflow,
  ];
}

function rankTopics(
  query: string,
  items: ProfessionalAmrTopic[],
  haystackOf: (item: ProfessionalAmrTopic) => string[],
  identityOf: (item: ProfessionalAmrTopic) => string[]
): ProfessionalAmrTopic[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return [...items];
  const stop = new Set([
    "what", "is", "are", "how", "should", "i", "the", "a", "an", "do", "does", "can", "to", "for",
    "of", "in", "on", "and", "or", "about", "explain", "recommend", "best", "use", "when", "why",
    "animation", "motion", "graphics", "render", "rendering", "export", "settings", "style",
  ]);
  const tokens = lower
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(t));

  const exact = items.filter((item) => {
    const ids = identityOf(item).map((v) => v.toLowerCase());
    return ids.some((id) => id === lower || id.replace(/-/g, " ") === lower || lower.includes(id) || id.includes(lower));
  });
  if (exact.length) {
    return exact.sort((a, b) => {
      const score = (item: ProfessionalAmrTopic) => {
        const ids = identityOf(item).map((v) => v.toLowerCase());
        return ids.some((id) => id === lower || id.replace(/-/g, " ") === lower) ? 1 : 0;
      };
      return score(b) - score(a);
    });
  }

  const direct = items.filter((item) => {
    const hay = haystackOf(item).join(" ").toLowerCase();
    if (hay.includes(lower)) return true;
    return tokens.length > 0 && tokens.every((token) => hay.includes(token));
  });
  if (direct.length) return direct;

  return items
    .map((item) => {
      const parts = haystackOf(item).map((p) => p.toLowerCase());
      const hay = parts.join(" ");
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) score += 1;
        if (parts[0]?.includes(token)) score += 2;
        if (parts[1]?.includes(token)) score += 2;
      }
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

// Fix ui-motion purpose type error - I accidentally set purpose to join result which is fine as string
// Fix fade relatedTopics - done above
// Fix wipe and fade purpose if they used array join - they're strings via join("")

export type { AmrTopicId };
