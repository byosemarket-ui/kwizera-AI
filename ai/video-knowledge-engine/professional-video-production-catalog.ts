/**
 * Curated Professional Video Production Knowledge catalog (Expansion Step 1).
 * Offline-first curated content for the video-production-knowledge domain.
 */

import {
  PROFESSIONAL_VIDEO_PRODUCTION_VERSION,
  VIDEO_PRODUCTION_DOMAIN_ID,
  type ProfessionalVideoProductionTopic,
  type VideoProductionDomainBridge,
  type VideoProductionTopicId,
} from "./professional-video-production-types.js";

function topic(
  partial: Omit<ProfessionalVideoProductionTopic, "knowledgeId" | "metadata"> & {
    knowledgeId?: string;
  }
): ProfessionalVideoProductionTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `vp-${partial.topicId}`,
    metadata: {
      domainId: VIDEO_PRODUCTION_DOMAIN_ID,
      category: "professional-video-production",
      difficulty: partial.confidenceScore >= 90 ? "advanced" : partial.confidenceScore >= 82 ? "intermediate" : "foundation",
      expansionStep: 1,
      version: PROFESSIONAL_VIDEO_PRODUCTION_VERSION,
      learningOnly: true,
      generatesVideo: false,
    },
  };
}

/** All Step 1 professional video production topics. */
export const PROFESSIONAL_VIDEO_PRODUCTION_TOPICS: ProfessionalVideoProductionTopic[] = [
  topic({
    topicId: "video-production-fundamentals",
    title: "Video Production Fundamentals",
    description:
      "Core principles of professional video production: purpose, audience, craft languages, and how planning, capture, and finishing form one continuous system.",
    professionalDefinition:
      "Video production is the disciplined process of planning, capturing, and finishing moving images so that story, brand intent, and technical quality align for a defined audience and delivery platform.",
    bestPractices: [
      "Define audience, message, and success metric before choosing style or format.",
      "Treat pre-production decisions as production constraints, not optional notes.",
      "Preserve continuity of brand, light direction, and editorial rhythm across scenes.",
      "Build every shoot around coverage that supports editing choices, not the reverse.",
    ],
    commonMistakes: [
      "Starting to shoot without a clear objective or audience.",
      "Collecting beautiful shots that cannot be cut into a coherent story.",
      "Ignoring delivery platform constraints until post-production.",
      "Confusing equipment complexity with production quality.",
    ],
    professionalWorkflow: [
      "Clarify brief, audience, and deliverable specs.",
      "Draft story structure and shot/scene plan.",
      "Produce with intentional coverage and continuity.",
      "Edit for pacing and message, then finish for platform delivery.",
    ],
    examples: [
      "A 30-second product launch film planned from CTA backward to opening hook.",
      "A corporate culture film built from interview beats plus B-roll coverage plan.",
    ],
    decisionRules: [
      "If the audience or CTA is undefined, do not begin production.",
      "Always prioritize message clarity over decorative camera moves.",
      "When platform and story conflict, redesign the cut for the platform first.",
      "Never treat unfinished audio as a post-only problem if capture was avoidable.",
    ],
    relatedTopics: ["production-workflow", "story-structure", "professional-planning-methods"],
    relatedDomains: ["video-production-knowledge", "storytelling-knowledge", "marketing-knowledge"],
    keywords: ["video production", "fundamentals", "pipeline", "audience", "deliverable"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  topic({
    topicId: "types-of-marketing-videos",
    title: "Types of Marketing Videos",
    description:
      "Professional taxonomy of marketing video formats and when each format supports awareness, consideration, conversion, or retention.",
    professionalDefinition:
      "Marketing video types are purpose-driven formats—such as brand films, product demos, testimonials, tutorials, and social shorts—selected according to funnel stage, platform, and buying behavior.",
    bestPractices: [
      "Match format to funnel stage before matching format to trend.",
      "Keep one primary CTA per video type.",
      "Reuse master footage into platform-specific cuts instead of reinventing each asset.",
      "Document which video type owns which message so campaigns stay coherent.",
    ],
    commonMistakes: [
      "Using a brand film structure for a hard conversion ad.",
      "Mixing too many CTAs across a single short-form asset.",
      "Copying a competitor format without audience fit.",
    ],
    professionalWorkflow: [
      "Map campaign goal to funnel stage.",
      "Select primary video type and secondary cutdowns.",
      "Define length, aspect ratio, and CTA placement rules.",
      "Brief creative and production against that type checklist.",
    ],
    examples: [
      "Awareness: cinematic brand film; Conversion: product demo with offer CTA.",
      "Retention: customer success story for email nurture and LinkedIn.",
    ],
    decisionRules: [
      "If the goal is awareness, prefer brand or story-led formats over hard sell.",
      "If the goal is conversion, prefer demo, offer, or testimonial formats.",
      "Always choose social-native formats for feed placements.",
      "Never force a long corporate narrative into a 15-second vertical slot without redesign.",
    ],
    relatedTopics: ["commercial-video-production", "product-advertisement-videos", "social-media-videos", "corporate-videos"],
    relatedDomains: ["marketing-knowledge", "video-production-knowledge"],
    keywords: ["marketing videos", "formats", "funnel", "brand film", "demo", "testimonial"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  topic({
    topicId: "commercial-video-production",
    title: "Commercial Video Production",
    description:
      "Professional methods for producing commercials that sell products or services with controlled messaging, pacing, and brand compliance.",
    professionalDefinition:
      "Commercial video production is the craft of packing a persuasive brand message into a timed audiovisual unit optimized for attention, recall, and action.",
    bestPractices: [
      "Open with a hook in the first 1–3 seconds for most paid placements.",
      "Make the product benefit visible, not only narrated.",
      "Lock legal/brand claims before picture lock.",
      "Design cutdowns (15s/6s) from the master commercial structure.",
    ],
    commonMistakes: [
      "Delaying product reveal until after audience drop-off.",
      "Overpacking claims that dilute the single selling idea.",
      "Ignoring safe-area and subtitle needs for muted autoplay.",
    ],
    professionalWorkflow: [
      "Approve single-minded proposition and claims.",
      "Storyboard beats: hook, problem/desire, proof, CTA.",
      "Produce controlled lighting and product hero coverage.",
      "Edit for retention curve; finish with brand and legal end card.",
    ],
    examples: [
      "Retail offer commercial with price lock and store CTA in final three seconds.",
      "Service commercial using customer problem → solution → proof → booking CTA.",
    ],
    decisionRules: [
      "If muted viewing is likely, always plan visual storytelling plus captions.",
      "Always protect one primary offer; secondary offers belong in companion cuts.",
      "When brand guidelines conflict with trend effects, preserve brand first.",
      "Never lock picture before legal review of claims and logos.",
    ],
    relatedTopics: ["product-advertisement-videos", "video-pacing", "video-style", "types-of-marketing-videos"],
    relatedDomains: ["marketing-knowledge", "video-production-knowledge", "lighting-knowledge"],
    keywords: ["commercial", "advertisement", "hook", "CTA", "brand compliance"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  topic({
    topicId: "product-advertisement-videos",
    title: "Product Advertisement Videos",
    description:
      "How to present products on camera so features, benefits, and desire are clear through framing, motion, and editorial emphasis.",
    professionalDefinition:
      "Product advertisement video craft focuses on revealing product value through controlled hero shots, demonstration beats, and benefit-led editing.",
    bestPractices: [
      "Establish the product hero early and return to it as a visual anchor.",
      "Demonstrate benefit in use, not only beauty close-ups.",
      "Control reflections, labels, and packaging readability.",
      "Sync motion and cut points to the product's most persuasive moment.",
    ],
    commonMistakes: [
      "Beauty footage without proof of use or outcome.",
      "Inconsistent product orientation across shots.",
      "Busy backgrounds competing with packaging detail.",
    ],
    professionalWorkflow: [
      "List must-show features and must-prove benefits.",
      "Plan hero, detail, context, and usage coverage.",
      "Capture controlled lighting for texture and brand color accuracy.",
      "Edit feature → benefit → proof → CTA.",
    ],
    examples: [
      "Skincare ad: texture macro → application → result claim → purchase CTA.",
      "Hardware demo: problem setup → product in action → specs overlay → buy now.",
    ],
    decisionRules: [
      "If a feature cannot be shown, do not claim it as a visual proof beat.",
      "Always keep packaging readable for at least one clear hero moment.",
      "When in doubt between style and clarity, choose clarity for product ads.",
      "Never hide the product for more than a few seconds in short ads.",
    ],
    relatedTopics: ["commercial-video-production", "shot-types", "shot-planning", "scene-planning"],
    relatedDomains: ["video-production-knowledge", "lighting-knowledge", "camera-knowledge", "marketing-knowledge"],
    keywords: ["product ad", "hero shot", "demo", "packaging", "benefit"],
    confidenceScore: 90,
    qualityScore: 90,
  }),
  topic({
    topicId: "social-media-videos",
    title: "Social Media Videos",
    description:
      "Platform-native production and editing principles for short-form and feed video across social channels.",
    professionalDefinition:
      "Social media video production adapts story, framing, pacing, and captions to platform behavior—especially vertical formats, muted autoplay, and rapid scroll interruption.",
    bestPractices: [
      "Design for vertical or platform-native aspect ratios from pre-production.",
      "Front-load the hook and on-screen text for muted viewers.",
      "Keep subjects large in frame; avoid wide empty compositions in vertical.",
      "Produce reusable shot kits that can become multiple platform cutdowns.",
    ],
    commonMistakes: [
      "Letterboxing a horizontal commercial into a vertical feed without redesign.",
      "Relying on audio-only hooks.",
      "Overlong intros before the first value beat.",
    ],
    professionalWorkflow: [
      "Select platform and length target.",
      "Write scroll-stopping first frame and first three seconds.",
      "Shoot with vertical-safe framing and caption space.",
      "Edit tight loops or clear end-screen CTAs.",
    ],
    examples: [
      "15-second vertical product tip with burned-in captions and sticker CTA.",
      "Carousel-style multi-clip series from one shoot day.",
    ],
    decisionRules: [
      "If the platform is feed-based, always plan a visual hook without sound.",
      "Always reserve lower-third and edge safe areas for UI overlays.",
      "When adapting a long film, redesign structure rather than speed-ramping only.",
      "Never publish social cuts without caption QA.",
    ],
    relatedTopics: ["types-of-marketing-videos", "video-pacing", "visual-rhythm", "video-style"],
    relatedDomains: ["marketing-knowledge", "video-production-knowledge", "video-editing-knowledge"],
    keywords: ["social media", "short-form", "vertical", "captions", "hook"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  topic({
    topicId: "corporate-videos",
    title: "Corporate Videos",
    description:
      "Professional standards for corporate storytelling: culture, explainers, leadership messages, and institutional credibility.",
    professionalDefinition:
      "Corporate video production communicates organizational identity, process, or leadership messages with clarity, credibility, and brand-consistent tone.",
    bestPractices: [
      "Lead with human stakes or business outcome, not org-chart narration.",
      "Balance interview A-roll with purposeful B-roll coverage.",
      "Keep claims accurate and approval-tracked.",
      "Design modular chapters for website and sales enablement reuse.",
    ],
    commonMistakes: [
      "Wall-to-wall talking heads without visual proof.",
      "Generic stock pacing that erases brand personality.",
      "Unclear audience (internal vs customer vs investor).",
    ],
    professionalWorkflow: [
      "Confirm audience and approval stakeholders.",
      "Outline message pillars and interview questions.",
      "Capture interviews plus supporting operational B-roll.",
      "Edit for clarity chapters; finish with brand packaging.",
    ],
    examples: [
      "Employee culture film with three message pillars and workplace B-roll.",
      "Explainer video mapping a service workflow for prospects.",
    ],
    decisionRules: [
      "If audience is mixed, split into targeted cuts rather than one overloaded film.",
      "Always secure stakeholder approval gates before public release.",
      "When interviews dominate, schedule B-roll intentionally, not as leftover time.",
      "Never invent metrics or customer claims without source approval.",
    ],
    relatedTopics: ["story-structure", "scene-planning", "production-workflow", "types-of-marketing-videos"],
    relatedDomains: ["video-production-knowledge", "storytelling-knowledge", "marketing-knowledge"],
    keywords: ["corporate", "explainer", "culture film", "interview", "B-roll"],
    confidenceScore: 88,
    qualityScore: 88,
  }),
  topic({
    topicId: "story-structure",
    title: "Story Structure",
    description:
      "Narrative architecture for professional videos: setup, conflict or desire, proof, and resolution aligned to runtime.",
    professionalDefinition:
      "Story structure in video production is the ordered arrangement of beats that guide attention from opening interest to emotional or commercial resolution.",
    bestPractices: [
      "Scale structure to runtime: micro-arc for shorts, fuller arc for longer films.",
      "Make each beat earn the next; remove ornamental scenes.",
      "Align emotional peak with product or message reveal when selling.",
      "Use recurring visual motifs to reinforce theme.",
    ],
    commonMistakes: [
      "Starting in the middle without orientation for the viewer.",
      "Resolving too early and diluting the ending CTA.",
      "Adding scenes that do not advance desire, proof, or emotion.",
    ],
    professionalWorkflow: [
      "Write the one-sentence story promise.",
      "List beats against target duration.",
      "Assign shots/scenes to each beat.",
      "Edit against the beat sheet, not against favorite takes alone.",
    ],
    examples: [
      "Problem → aspiration → demonstration → social proof → CTA.",
      "Day-in-the-life structure for founder brand film.",
    ],
    decisionRules: [
      "If a scene does not advance story or proof, cut it.",
      "Always place the strongest retention beat near the open for short ads.",
      "When runtime shrinks, preserve hook and CTA first.",
      "Never invent a climax that the footage cannot support.",
    ],
    relatedTopics: ["scene-planning", "video-pacing", "commercial-video-production", "video-production-fundamentals"],
    relatedDomains: ["storytelling-knowledge", "video-production-knowledge", "marketing-knowledge"],
    keywords: ["story structure", "beats", "narrative", "arc", "CTA"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  topic({
    topicId: "shot-types",
    title: "Shot Types",
    description:
      "Professional shot vocabulary used in production planning and editing: wide, medium, close-up, insert, POV, and supporting coverage.",
    professionalDefinition:
      "Shot types are standardized framing categories that control information density, emotional proximity, and editorial flexibility within a scene.",
    bestPractices: [
      "Plan a mix of master, medium, and close coverage for editable scenes.",
      "Use inserts to prove product detail or process clarity.",
      "Match shot size progression to story intensity.",
      "Document intended shot type on the shot list to avoid missing coverage.",
    ],
    commonMistakes: [
      "Shooting only medium shots and trapping the edit.",
      "Jumping shot sizes without motivation.",
      "Close-ups without establishing geography.",
    ],
    professionalWorkflow: [
      "Translate scene beats into required shot types.",
      "Prioritize must-have sizes before stylistic extras.",
      "Capture consistency of eye-line and screen direction.",
      "Label takes by shot type for faster post.",
    ],
    examples: [
      "Product scene: wide environment, medium usage, macro insert of detail.",
      "Interview: medium talking head plus cutaway inserts of hands/work.",
    ],
    decisionRules: [
      "If the edit needs options, always capture at least two shot sizes per key beat.",
      "Always establish space before relying on close coverage.",
      "When emotion is the goal, prefer closer framing after context is clear.",
      "Never leave a product claim without a supporting insert when possible.",
    ],
    relatedTopics: ["shot-planning", "camera-coverage", "scene-planning", "product-advertisement-videos"],
    relatedDomains: ["camera-knowledge", "video-production-knowledge"],
    keywords: ["shot types", "wide", "close-up", "insert", "coverage"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  topic({
    topicId: "shot-planning",
    title: "Shot Planning",
    description:
      "How professionals plan shots before production so each frame has purpose, order, and technical readiness.",
    professionalDefinition:
      "Shot planning is the pre-visualization and listing of intended shots—including size, angle, motion, and purpose—so production time and editorial needs are protected.",
    bestPractices: [
      "Attach each shot to a story beat or proof need.",
      "Order the shot list for lighting and location efficiency.",
      "Note lens intent, movement, and audio needs per shot.",
      "Mark priority tiers: must-have, should-have, nice-to-have.",
    ],
    commonMistakes: [
      "Improvising the entire day without a prioritized list.",
      "Planning cinematic moves that consume time needed for coverage.",
      "Omitting contingency shots for risky setups.",
    ],
    professionalWorkflow: [
      "Derive shot list from scene plan and story beats.",
      "Group by location and lighting setup.",
      "Assign priorities and estimated times.",
      "Revise on set only with explicit trade-off decisions.",
    ],
    examples: [
      "Location day scheduled by setup, not by story order.",
      "Product tabletop shot list ordered from wide hero to macro inserts.",
    ],
    decisionRules: [
      "If time runs short, protect must-have coverage first.",
      "Always know which shot unlocks the edit before which shot is decorative.",
      "When a move is complex, plan a static safety take.",
      "Never start a setup without confirming its story purpose.",
    ],
    relatedTopics: ["shot-types", "scene-planning", "camera-coverage", "pre-production"],
    relatedDomains: ["camera-knowledge", "video-production-knowledge", "storytelling-knowledge"],
    keywords: ["shot list", "shot planning", "priority", "coverage plan"],
    confidenceScore: 89,
    qualityScore: 88,
  }),
  topic({
    topicId: "scene-planning",
    title: "Scene Planning",
    description:
      "Organizing scenes as production units with objectives, blocking, coverage, and transitions into the larger story.",
    professionalDefinition:
      "Scene planning defines what a scene must accomplish narratively and practically—location, talent, action, coverage, and how it connects to adjacent scenes.",
    bestPractices: [
      "Write a one-line scene objective before blocking.",
      "Plan entrances, exits, and continuity anchors.",
      "Design coverage that supports the intended cut pattern.",
      "Coordinate wardrobe, props, and brand assets per scene.",
    ],
    commonMistakes: [
      "Treating scenes as disconnected pretty setups.",
      "Missing transition logic between scenes.",
      "Overblocking action that cannot be covered in time.",
    ],
    professionalWorkflow: [
      "Break script/brief into scenes with objectives.",
      "Assign locations, talent, and key props.",
      "Draft coverage and estimated duration.",
      "Confirm scene order vs shoot order.",
    ],
    examples: [
      "Retail spot: store entrance scene → product interaction scene → checkout CTA scene.",
      "Corporate film: workplace scene clusters mapped to message pillars.",
    ],
    decisionRules: [
      "If a scene lacks an objective, rewrite or remove it.",
      "Always plan how the viewer orients geographically and emotionally.",
      "When shoot order differs from story order, protect continuity notes.",
      "Never leave scene transitions to chance in branded work.",
    ],
    relatedTopics: ["story-structure", "shot-planning", "camera-coverage", "production"],
    relatedDomains: ["storytelling-knowledge", "video-production-knowledge"],
    keywords: ["scene planning", "blocking", "continuity", "scene objective"],
    confidenceScore: 89,
    qualityScore: 88,
  }),
  topic({
    topicId: "camera-coverage",
    title: "Camera Coverage",
    description:
      "Professional coverage strategy: capturing enough complementary angles and sizes to cut a scene with continuity and emphasis.",
    professionalDefinition:
      "Camera coverage is the deliberate set of angles and shot sizes recorded for a scene so editors can maintain continuity, control emphasis, and solve performance or timing issues.",
    bestPractices: [
      "Capture a master that preserves geography, then coverage for emphasis.",
      "Protect screen direction and eyelines across angles.",
      "Record safety coverage for complex action or dialogue.",
      "Coordinate multi-cam only when it increases usable options, not noise.",
    ],
    commonMistakes: [
      "Single-angle shooting that locks the edit.",
      "Crossing the line without intentional style justification.",
      "Coverage that mismatches performance energy across takes.",
    ],
    professionalWorkflow: [
      "Decide editorial pattern (master-driven, coverage-driven, or montage).",
      "List required angles for dialogue/action.",
      "Shoot master → supporting sizes → inserts.",
      "Verify continuity before striking the setup.",
    ],
    examples: [
      "Interview coverage: camera A medium, camera B tight, plus B-roll inserts.",
      "Product hand demo covered from hero angle and detail angle.",
    ],
    decisionRules: [
      "If only one take is possible, prioritize the angle that carries story information.",
      "Always maintain continuity of action across coverage.",
      "When using stylized line crosses, do so consistently and intentionally.",
      "Never strike lights before confirming insert needs.",
    ],
    relatedTopics: ["shot-types", "shot-planning", "scene-planning", "post-production"],
    relatedDomains: ["camera-knowledge", "video-production-knowledge", "video-editing-knowledge"],
    keywords: ["coverage", "master shot", "angles", "continuity", "multi-cam"],
    confidenceScore: 88,
    qualityScore: 87,
  }),
  topic({
    topicId: "video-pacing",
    title: "Video Pacing",
    description:
      "Controlling information rate and cut frequency so attention, comprehension, and emotion stay aligned with runtime.",
    professionalDefinition:
      "Video pacing is the temporal design of shot length, scene duration, and information density that shapes how quickly a viewer processes story and persuasion.",
    bestPractices: [
      "Vary pace: accelerate through low-information moments, breathe on proof moments.",
      "Let on-screen text and voiceover dictate minimum readable duration.",
      "Front-load retention for ads; allow measured pacing for explainers.",
      "Use cut frequency as emphasis, not as default decoration.",
    ],
    commonMistakes: [
      "Constant rapid cutting that prevents comprehension.",
      "Holding static wide shots far beyond their informational value.",
      "Mismatched voiceover speed and picture change rate.",
    ],
    professionalWorkflow: [
      "Define target pace profile for format (ad vs corporate vs social).",
      "Assemble rough cut against beat sheet timing.",
      "Measure drop-off risk points and tighten.",
      "Lock pace before heavy finishing effects.",
    ],
    examples: [
      "6-second bumper with two shots and one text lockup.",
      "Two-minute explainer with slower proof sections and faster transitions between chapters.",
    ],
    decisionRules: [
      "If viewers must read text, hold long enough for comfortable reading.",
      "Always slow down on the product's key proof beat.",
      "When retention falls, cut earlier—do not add more decoration.",
      "Never pace a corporate explainer like a hyperactive social trend cut unless intentional.",
    ],
    relatedTopics: ["visual-rhythm", "story-structure", "social-media-videos", "post-production"],
    relatedDomains: ["video-editing-knowledge", "video-production-knowledge", "storytelling-knowledge"],
    keywords: ["pacing", "cut rate", "retention", "timing", "duration"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  topic({
    topicId: "visual-rhythm",
    title: "Visual Rhythm",
    description:
      "Patterning motion, composition changes, and editorial accents so the picture feels intentional and musically coherent.",
    professionalDefinition:
      "Visual rhythm is the patterned recurrence of movement, framing changes, color accents, and cut points that create expectancy and flow for the viewer.",
    bestPractices: [
      "Align cut points and motion accents with music or narration stresses when appropriate.",
      "Alternate visual density (busy vs calm frames) to avoid fatigue.",
      "Repeat motifs (color, shape, camera move) to unify the piece.",
      "Use stillness strategically after motion peaks.",
    ],
    commonMistakes: [
      "Random motion that fights the soundtrack.",
      "Identical shot lengths creating mechanical monotony.",
      "Motifs introduced once and abandoned.",
    ],
    professionalWorkflow: [
      "Choose a rhythmic reference (music bed or VO cadence).",
      "Map accents to picture changes.",
      "Pass for motif consistency.",
      "Final trim for breath and emphasis.",
    ],
    examples: [
      "Product montage cut on percussion hits with recurring color accent.",
      "Interview film using B-roll pulses between quiet dialogue holds.",
    ],
    decisionRules: [
      "If music drives the piece, picture accents should support—not contradict—it.",
      "Always give emotional lines visual breathing room.",
      "When motifs conflict with clarity, clarity wins in commercial work.",
      "Never add motion solely to hide weak storytelling.",
    ],
    relatedTopics: ["video-pacing", "video-style", "post-production", "social-media-videos"],
    relatedDomains: ["video-editing-knowledge", "animation-knowledge", "video-production-knowledge"],
    keywords: ["visual rhythm", "motif", "motion accents", "editorial flow"],
    confidenceScore: 87,
    qualityScore: 86,
  }),
  topic({
    topicId: "video-style",
    title: "Video Style",
    description:
      "Defining and maintaining a coherent audiovisual style: look, tone, motion language, typography, and brand fit.",
    professionalDefinition:
      "Video style is the consistent system of visual and sonic choices—lighting mood, color, lens language, motion, type, and edit feel—that expresses brand personality and story tone.",
    bestPractices: [
      "Write a short style frame before production (references + do/don't).",
      "Lock primary look early; avoid late style thrash.",
      "Ensure style supports message readability.",
      "Carry style into captions, lower-thirds, and end cards.",
    ],
    commonMistakes: [
      "Mixing incompatible looks across scenes without transition logic.",
      "Trend effects that erase brand recognition.",
      "Typography fighting background contrast.",
    ],
    professionalWorkflow: [
      "Gather approved brand and reference boards.",
      "Define lighting, grade intent, motion, and type rules.",
      "Apply style consistently in production and post.",
      "QA style continuity across all deliverables.",
    ],
    examples: [
      "Clean commercial style: soft product light, restrained grade, modern sans captions.",
      "Documentary corporate style: natural light bias, handheld accents, minimal graphics.",
    ],
    decisionRules: [
      "If style reduces product or message clarity, restyle.",
      "Always reconcile creative style with brand guidelines before shoot.",
      "When multiple deliverables share a campaign, share one style system.",
      "Never introduce a new grade language in the final three seconds unless planned.",
    ],
    relatedTopics: ["commercial-video-production", "visual-rhythm", "post-production", "social-media-videos"],
    relatedDomains: ["video-production-knowledge", "lighting-knowledge", "rendering-knowledge"],
    keywords: ["video style", "look", "tone", "brand look", "motion language"],
    confidenceScore: 88,
    qualityScore: 88,
  }),
  topic({
    topicId: "production-workflow",
    title: "Production Workflow",
    description:
      "End-to-end professional workflow connecting brief, pre-production, production, post, and delivery as a managed system.",
    professionalDefinition:
      "A production workflow is the sequenced set of roles, gates, and assets that move a video from brief to approved deliverables with quality control and version discipline.",
    bestPractices: [
      "Use explicit approval gates between phases.",
      "Centralize asset naming, versions, and review notes.",
      "Plan delivery specs at kickoff, not at export day.",
      "Hold a wrap checklist before declaring production complete.",
    ],
    commonMistakes: [
      "Skipping paperwork and rights clearances.",
      "Parallel uncontrolled versions of the edit.",
      "Discovering delivery specs after creative lock.",
    ],
    professionalWorkflow: [
      "Kickoff and brief lock.",
      "Pre-production planning and resource confirmation.",
      "Production capture with logging.",
      "Post editorial → finishing → review → delivery.",
    ],
    examples: [
      "Agency workflow with client review rounds at script, rough cut, and picture lock.",
      "In-house studio workflow with shared shot list and edit bin standards.",
    ],
    decisionRules: [
      "If a gate is skipped, reopen it before advancing spend.",
      "Always freeze delivery specs before finishing grade/audio.",
      "When feedback conflicts, escalate to the single decision owner.",
      "Never deliver without a final QA pass for picture, audio, captions, and brand.",
    ],
    relatedTopics: ["pre-production", "production", "post-production", "professional-planning-methods"],
    relatedDomains: ["video-production-knowledge", "rendering-knowledge", "video-editing-knowledge"],
    keywords: ["workflow", "pipeline", "approvals", "delivery", "versioning"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  topic({
    topicId: "pre-production",
    title: "Pre-production",
    description:
      "Professional pre-production: research, scripting, planning, casting, locations, schedules, and risk control before cameras roll.",
    professionalDefinition:
      "Pre-production is the planning phase that converts a creative brief into executable schedules, shot/scene plans, budgets, and risk controls before capture begins.",
    bestPractices: [
      "Lock creative intent and deliverables before booking heavy spend.",
      "Build shot lists, call sheets, and contingency plans.",
      "Scout locations for sound, power, light, and brand fit.",
      "Clear talent, music, and location rights early.",
    ],
    commonMistakes: [
      "Treating pre-production as optional paperwork.",
      "Underestimating setup and transition time.",
      "Leaving legal clearances to post.",
    ],
    professionalWorkflow: [
      "Brief → concept → script/storyboard.",
      "Budget, schedule, and resource plan.",
      "Location/talent/tech prep.",
      "Final production packet and readiness check.",
    ],
    examples: [
      "One-day product shoot packet with prioritized shot list and lighting plot notes.",
      "Multi-location corporate schedule with travel and interview buffers.",
    ],
    decisionRules: [
      "If rights or claims are uncleared, do not shoot those moments.",
      "Always include contingency time for critical setups.",
      "When budget shrinks, cut scope in pre-production—not quality on set.",
      "Never arrive on set without a shared shot priority list.",
    ],
    relatedTopics: ["professional-planning-methods", "shot-planning", "scene-planning", "production-workflow"],
    relatedDomains: ["video-production-knowledge", "camera-knowledge", "lighting-knowledge"],
    keywords: ["pre-production", "call sheet", "storyboard", "schedule", "clearances"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  topic({
    topicId: "production",
    title: "Production",
    description:
      "On-set professional production practice: executing the plan, protecting continuity, and capturing editable media efficiently.",
    professionalDefinition:
      "Production is the capture phase where planned shots, performances, sound, and continuity are executed under time and quality constraints.",
    bestPractices: [
      "Protect the must-have shot list before experiments.",
      "Monitor picture and sound in real time.",
      "Log takes and note selects for post speed.",
      "Maintain continuity of light, wardrobe, product position, and eyelines.",
    ],
    commonMistakes: [
      "Chasing unplanned ideas until coverage is incomplete.",
      "Poor slate/logging that slows editorial.",
      "Ignoring background audio problems during capture.",
    ],
    professionalWorkflow: [
      "Safety and tech check.",
      "Block, light, rehearse, roll.",
      "Review critical takes before moving on.",
      "Wrap with media backup and notes.",
    ],
    examples: [
      "Tabletop product day with hero lighting locked before detail inserts.",
      "Interview day with dedicated quiet room and B-roll second unit.",
    ],
    decisionRules: [
      "If a take is unusable for sound or focus, reshoot before striking.",
      "Always back up media before leaving the location.",
      "When behind schedule, renegotiate scope with priorities, not silent cuts.",
      "Never rely on 'fix it in post' for avoidable capture failures.",
    ],
    relatedTopics: ["pre-production", "camera-coverage", "post-production", "production-workflow"],
    relatedDomains: ["video-production-knowledge", "camera-knowledge", "lighting-knowledge", "video-editing-knowledge"],
    keywords: ["production", "on-set", "continuity", "logging", "capture"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  topic({
    topicId: "post-production",
    title: "Post-production",
    description:
      "Editorial finishing: assembly, pacing, sound, graphics, color, captions, review, and delivery packaging.",
    professionalDefinition:
      "Post-production transforms captured media into the finished video through editing, sound design, graphics, color, quality control, and export for specified platforms.",
    bestPractices: [
      "Organize bins and name versions clearly.",
      "Lock story and pace before heavy grade and VFX.",
      "Mix for the loudest common playback environment of the target platform.",
      "Run picture, audio, caption, and brand QA before delivery.",
    ],
    commonMistakes: [
      "Grading before narrative is stable.",
      "Unlabeled versions causing wrong delivery.",
      "Skipping caption and safe-area checks.",
    ],
    professionalWorkflow: [
      "Ingest and sync.",
      "Rough cut → fine cut → picture lock.",
      "Sound, graphics, color, captions.",
      "Review rounds → final exports → archive.",
    ],
    examples: [
      "Social cutdown package derived from a master commercial edit.",
      "Corporate film with chapter markers and burned-in subtitle version.",
    ],
    decisionRules: [
      "If feedback changes story, reopen picture lock before finishing spend.",
      "Always export a reviewable proxy and a delivery master according to specs.",
      "When platforms differ, create dedicated exports—not one stretched file.",
      "Never deliver without checking last-frame brand lockup and CTA.",
    ],
    relatedTopics: ["video-pacing", "visual-rhythm", "video-style", "production-workflow"],
    relatedDomains: ["video-editing-knowledge", "rendering-knowledge", "animation-knowledge", "video-production-knowledge"],
    keywords: ["post-production", "editing", "color", "sound mix", "export"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  topic({
    topicId: "professional-planning-methods",
    title: "Professional Planning Methods",
    description:
      "Planning methods used by professional teams: brief frameworks, beat sheets, shot lists, risk registers, and reverse-planning from delivery.",
    professionalDefinition:
      "Professional planning methods are structured techniques that reduce production risk by defining outcomes, constraints, priorities, and decision ownership before creative execution.",
    bestPractices: [
      "Plan backward from delivery specs and launch date.",
      "Use a single decision owner for conflicting feedback.",
      "Maintain a living risk register (weather, talent, rights, tech).",
      "Separate creative options from production-critical path items.",
    ],
    commonMistakes: [
      "Optimistic schedules without buffers.",
      "Diffuse approval ownership.",
      "Planning tools that are not shared with the full team.",
    ],
    professionalWorkflow: [
      "Define outcome metrics and constraints.",
      "Choose planning artifacts (brief, beat sheet, shot list, schedule).",
      "Assign owners and gates.",
      "Review readiness and residual risks before production.",
    ],
    examples: [
      "Reverse schedule from campaign launch with lock dates for script and picture.",
      "Priority-tier shot list used as the on-set decision tool.",
    ],
    decisionRules: [
      "If no decision owner exists, appoint one before creative reviews continue.",
      "Always include contingency for the single hardest setup.",
      "When scope and deadline conflict, cut scope with explicit stakeholder sign-off.",
      "Never treat planning documents as static once production realities change—update and communicate.",
    ],
    relatedTopics: ["pre-production", "production-workflow", "shot-planning", "video-production-fundamentals"],
    relatedDomains: ["video-production-knowledge", "marketing-knowledge", "storytelling-knowledge"],
    keywords: ["planning methods", "brief", "risk register", "reverse planning", "decision owner"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
];

/** Domain relationship bridges (anchors) — not full Camera/Lighting specialty knowledge. */
export const VIDEO_PRODUCTION_DOMAIN_BRIDGES: VideoProductionDomainBridge[] = [
  {
    domainId: "video-production-knowledge",
    knowledgeId: "vp-bridge-video-production-knowledge",
    title: "Video Production Knowledge Domain",
    description: "Hub for professional video production knowledge expansion Step 1.",
    relationshipEvidence: "Primary domain for professional video production topics.",
  },
  {
    domainId: "camera-knowledge",
    knowledgeId: "vp-bridge-camera-knowledge",
    title: "Camera Knowledge (related domain)",
    description:
      "Relationship anchor to Camera Knowledge. Full camera specialty content is reserved for a later expansion step.",
    relationshipEvidence: "Video production depends on camera language for coverage and framing.",
  },
  {
    domainId: "lighting-knowledge",
    knowledgeId: "vp-bridge-lighting-knowledge",
    title: "Lighting Knowledge (related domain)",
    description: "Relationship anchor to Lighting Knowledge used by commercial and product video craft.",
    relationshipEvidence: "Video production relies on lighting for mood, product clarity, and continuity.",
  },
  {
    domainId: "storytelling-knowledge",
    knowledgeId: "vp-bridge-storytelling-knowledge",
    title: "Storytelling Knowledge (related domain)",
    description: "Relationship anchor to Storytelling Knowledge for narrative structure and scene purpose.",
    relationshipEvidence: "Video production uses storytelling structure to order beats and scenes.",
  },
  {
    domainId: "marketing-knowledge",
    knowledgeId: "vp-bridge-marketing-knowledge",
    title: "Marketing Knowledge (related domain)",
    description: "Relationship anchor to Marketing Knowledge for funnel-fit video types and CTAs.",
    relationshipEvidence: "Marketing video production inherits goals and audience rules from marketing knowledge.",
  },
  {
    domainId: "video-editing-knowledge",
    knowledgeId: "vp-bridge-video-editing-knowledge",
    title: "Editing Knowledge (related domain)",
    description: "Relationship anchor to Video Editing Knowledge for pacing, rhythm, and finishing craft.",
    relationshipEvidence: "Production coverage and post-production editing are interdependent.",
  },
  {
    domainId: "rendering-knowledge",
    knowledgeId: "vp-bridge-rendering-knowledge",
    title: "Rendering Knowledge (related domain)",
    description: "Relationship anchor to Rendering Knowledge for delivery and export readiness.",
    relationshipEvidence: "Finished video production depends on rendering and delivery specifications.",
  },
  {
    domainId: "animation-knowledge",
    knowledgeId: "vp-bridge-animation-knowledge",
    title: "Animation Knowledge (related domain)",
    description: "Relationship anchor to Animation Knowledge for motion graphics and animated accents.",
    relationshipEvidence: "Video style and post often integrate animation and motion graphics.",
  },
];

export const REQUIRED_VIDEO_PRODUCTION_TOPIC_IDS: VideoProductionTopicId[] =
  PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.map((entry) => entry.topicId);

export function getVideoProductionTopic(topicId: string): ProfessionalVideoProductionTopic | null {
  return PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.find((entry) => entry.topicId === topicId || entry.knowledgeId === topicId) ?? null;
}

export function findVideoProductionTopics(query: string): ProfessionalVideoProductionTopic[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return [...PROFESSIONAL_VIDEO_PRODUCTION_TOPICS];

  const stopWords = new Set([
    "what",
    "is",
    "are",
    "how",
    "should",
    "i",
    "the",
    "a",
    "an",
    "do",
    "does",
    "can",
    "to",
    "for",
    "of",
    "in",
    "on",
    "and",
    "or",
    "about",
    "explain",
    "recommend",
    "compare",
    "professional",
    "video",
    "production",
    "method",
    "methods",
    "plan",
    "planning",
    "?",
  ]);
  const tokens = lower
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));

  const direct = PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.filter((entry) => {
    const haystack = [
      entry.topicId,
      entry.title,
      entry.description,
      entry.professionalDefinition,
      ...entry.keywords,
      ...entry.bestPractices,
      ...entry.decisionRules,
    ]
      .join(" ")
      .toLowerCase();
    if (haystack.includes(lower)) return true;
    if (lower.includes(entry.topicId.replace(/-/g, " "))) return true;
    return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
  });

  if (direct.length) return direct;

  const scored = PROFESSIONAL_VIDEO_PRODUCTION_TOPICS.map((entry) => {
    const haystack = [
      entry.topicId,
      entry.title,
      ...entry.keywords,
      ...entry.relatedTopics,
    ]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
      if (entry.topicId.includes(token)) score += 2;
      if (entry.title.toLowerCase().includes(token)) score += 2;
    }
    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((item) => item.entry);
}
