/**
 * Curated Professional Storytelling & Scene Design Knowledge catalog (Expansion Step 4).
 */

import {
  PROFESSIONAL_STORYTELLING_SCENE_VERSION,
  SCENE_DOMAIN_ID,
  STORYTELLING_DOMAIN_ID,
  type SceneDesignTopicId,
  type StorytellingSceneDomainBridge,
  type StorytellingTopicId,
  type ProfessionalStorytellingSceneTopic,
} from "./professional-storytelling-scene-types.js";

function story(
  partial: Omit<ProfessionalStorytellingSceneTopic, "knowledgeId" | "title" | "metadata"> & {
    knowledgeId?: string;
    title?: string;
  }
): ProfessionalStorytellingSceneTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `story-${partial.topicId}`,
    title: partial.title ?? partial.name,
    metadata: {
      domainId: STORYTELLING_DOMAIN_ID,
      category: "professional-storytelling",
      difficulty: partial.confidenceScore >= 90 ? "advanced" : partial.confidenceScore >= 84 ? "intermediate" : "foundation",
      expansionStep: 4,
      version: PROFESSIONAL_STORYTELLING_SCENE_VERSION,
      learningOnly: true,
      generatesVideo: false,
    },
  };
}

function scene(
  partial: Omit<ProfessionalStorytellingSceneTopic, "knowledgeId" | "title" | "metadata"> & {
    knowledgeId?: string;
    title?: string;
  }
): ProfessionalStorytellingSceneTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `scene-${partial.topicId}`,
    title: partial.title ?? partial.name,
    metadata: {
      domainId: SCENE_DOMAIN_ID,
      category: "professional-scene-design",
      difficulty: partial.confidenceScore >= 90 ? "advanced" : partial.confidenceScore >= 84 ? "intermediate" : "foundation",
      expansionStep: 4,
      version: PROFESSIONAL_STORYTELLING_SCENE_VERSION,
      learningOnly: true,
      generatesVideo: false,
    },
  };
}

export const PROFESSIONAL_STORYTELLING_TOPICS: ProfessionalStorytellingSceneTopic[] = [
  story({
    topicId: "storytelling-fundamentals",
    name: "Storytelling Fundamentals",
    description: "Core principles of narrative for commercial and marketing video: audience, desire, obstacle, change, and proof.",
    purpose: "Give every commercial a clear story spine so scenes serve persuasion, not decoration.",
    professionalDefinition:
      "Storytelling fundamentals are the non-negotiable building blocks—who wants what, why it matters, what blocks them, and how the brand helps—applied to short-form marketing narrative.",
    whenToUse: ["Any brand film brief", "Campaign concepting", "Teaching crews a shared narrative language"],
    whenNotToUse: ["When skipping to shots without defining audience desire"],
    bestPractices: ["Define audience and desire before structure", "One promise per film", "Prove change with evidence"],
    commonMistakes: ["Feature dumps without desire", "Beautiful scenes with no stakes"],
    workflow: ["Clarify audience", "State desire and obstacle", "Map change", "Attach CTA"],
    professionalExamples: ["Skincare ad: desire for confidence → obstacle of dullness → product change → shop CTA"],
    relatedTopics: ["story-structure", "emotional-journey", "product-storytelling", "visual-storytelling"],
    relatedDomains: ["storytelling-knowledge", "marketing-knowledge", "branding-knowledge", "video-production-knowledge"],
    keywords: ["storytelling fundamentals", "narrative", "desire", "obstacle", "commercial story"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  story({
    topicId: "story-structure",
    name: "Story Structure",
    description: "The organized arrangement of beginning, development, climax, and close for marketing narratives.",
    purpose: "Ensure pacing and information order support comprehension and conversion.",
    professionalDefinition:
      "Story structure is the deliberate sequencing of narrative beats so attention, emotion, and decision progress in a controllable arc.",
    whenToUse: ["Scripts over ~15 seconds", "Multi-scene commercials", "Explainers with persuasion goals"],
    whenNotToUse: ["Single-shot pack reveals with no narrative ambition"],
    bestPractices: ["Lock beats before shooting", "Map each beat to a scene purpose", "Protect climax clarity"],
    commonMistakes: ["All middle, no hook", "CTA before any value"],
    workflow: ["Choose structure model", "List beats", "Assign scenes", "Time-box each beat"],
    professionalExamples: ["15s social: hook → problem → product → proof → CTA"],
    relatedTopics: ["three-act-structure", "beginning", "middle", "ending", "narrative-flow"],
    relatedDomains: ["storytelling-knowledge", "scene-knowledge", "marketing-knowledge", "video-production-knowledge"],
    keywords: ["story structure", "beats", "arc", "narrative order", "pacing"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  story({
    topicId: "three-act-structure",
    name: "Three-Act Structure",
    description: "Classic setup, confrontation, and resolution adapted for commercial length.",
    purpose: "Provide a reliable arc template for brand and product films of any length.",
    professionalDefinition:
      "Three-act structure divides the story into Act I (setup/hook), Act II (conflict/development), and Act III (resolution/CTA), scaled to commercial runtime.",
    whenToUse: ["Brand films", "Founder stories", "Longer product narratives"],
    whenNotToUse: ["Ultra-short bumper ads that only need one beat"],
    bestPractices: ["Compress acts proportionally", "Place turning points clearly", "End Act III with action"],
    commonMistakes: ["Act II wandering without escalation", "Resolution without CTA"],
    workflow: ["Write Act I hook", "Escalate Act II conflict", "Resolve with brand role", "Place CTA"],
    professionalExamples: ["Act I: missed deadline; Act II: chaos; Act III: tool restores control + trial CTA"],
    relatedTopics: ["story-structure", "beginning", "middle", "ending", "conflict", "resolution"],
    relatedDomains: ["storytelling-knowledge", "scene-knowledge", "marketing-knowledge", "branding-knowledge"],
    keywords: ["three-act", "setup", "confrontation", "resolution", "acts"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  story({
    topicId: "narrative-flow",
    name: "Narrative Flow",
    description: "The continuous progression of information and emotion so viewers never lose the thread.",
    purpose: "Keep attention glued by making each beat feel inevitable and useful.",
    professionalDefinition:
      "Narrative flow is the causal and emotional continuity between beats—each scene answers an implied question raised by the previous one.",
    whenToUse: ["Multi-scene edits", "Storyboards", "Script revisions"],
    whenNotToUse: ["Montage-only mood pieces with intentional discontinuity"],
    bestPractices: ["Ask what question each cut answers", "Remove orphan beats", "Bridge emotion across scenes"],
    commonMistakes: ["Jumping to demo before problem is felt", "Random B-roll breaks"],
    workflow: ["List beat questions", "Reorder for causality", "Check emotion handoffs"],
    professionalExamples: ["Problem felt → curiosity → reveal → proof → desire → CTA"],
    relatedTopics: ["story-structure", "emotional-journey", "scene-transition-planning", "visual-storytelling"],
    relatedDomains: ["storytelling-knowledge", "scene-knowledge", "video-production-knowledge", "composition-knowledge"],
    keywords: ["narrative flow", "causality", "continuity of story", "beat progression"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  story({
    topicId: "beginning",
    name: "Beginning",
    description: "The opening beats that establish world, stakes, and reason to keep watching.",
    purpose: "Hook attention fast and set the promise of the film.",
    professionalDefinition:
      "The beginning is the first narrative unit that orients the audience, plants desire or tension, and invites continued attention—typically within the first 1–3 seconds on social.",
    whenToUse: ["Every commercial", "Series episode opens", "Landing-page videos"],
    whenNotToUse: ["Mid-roll continuation where context already exists"],
    bestPractices: ["Hook visually and verbally", "Show who it's for", "Avoid slow logos-first opens on social"],
    commonMistakes: ["Generic establishing shots with no stakes", "Delayed problem statement"],
    workflow: ["Write hook line", "Choose opening scene type", "Plant brand world lightly"],
    professionalExamples: ["Cold open of spilled coffee then cut to calm morning with product"],
    relatedTopics: ["opening-scene", "story-structure", "three-act-structure", "brand-storytelling"],
    relatedDomains: ["storytelling-knowledge", "scene-knowledge", "marketing-knowledge", "camera-knowledge"],
    keywords: ["beginning", "hook", "cold open", "setup", "first beat"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  story({
    topicId: "middle",
    name: "Middle",
    description: "The developmental section where conflict escalates and the product/brand earns relevance.",
    purpose: "Deepen stakes and demonstrate value before asking for action.",
    professionalDefinition:
      "The middle is the narrative span between hook and resolution where obstacles intensify, benefits are shown, and emotional investment grows.",
    whenToUse: ["Any structure longer than a single reveal", "Demo-heavy product films"],
    whenNotToUse: ["3-second logo bumpers"],
    bestPractices: ["Escalate one clear conflict", "Interleave proof", "Avoid feature laundry lists"],
    commonMistakes: ["Flat middle with no rising tension", "Too many competing claims"],
    workflow: ["List obstacles", "Match to product capabilities", "Order by rising intensity"],
    professionalExamples: ["Messy workflow → partial fixes fail → product consolidates steps"],
    relatedTopics: ["conflict", "product-storytelling", "demonstration-scene", "narrative-flow"],
    relatedDomains: ["storytelling-knowledge", "product-knowledge", "marketing-knowledge", "scene-knowledge"],
    keywords: ["middle", "development", "escalation", "rising action"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  story({
    topicId: "ending",
    name: "Ending",
    description: "The closing beats that resolve tension, crystallize the promise, and drive action.",
    purpose: "Leave a clear memory and a next step.",
    professionalDefinition:
      "The ending is the final narrative unit that resolves the central conflict, states the transformed state, and places the call to action.",
    whenToUse: ["Every persuasion film", "Series finales", "Landing videos"],
    whenNotToUse: ["Teaser trails that intentionally withhold resolution"],
    bestPractices: ["Show the after-state", "One CTA", "Match tone of brand"],
    commonMistakes: ["Fizzling out", "Multiple CTAs competing"],
    workflow: ["Write after-state", "Place CTA", "Design closing scene"],
    professionalExamples: ["Calm desk, finished work, 'Start free trial' end card"],
    relatedTopics: ["resolution", "call-to-action-placement", "closing-scene", "three-act-structure"],
    relatedDomains: ["storytelling-knowledge", "marketing-knowledge", "branding-knowledge", "scene-knowledge"],
    keywords: ["ending", "close", "payoff", "final beat", "resolution close"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  story({
    topicId: "character-development",
    name: "Character Development",
    description: "Shaping protagonists (customer, founder, brand persona) so viewers identify and care.",
    purpose: "Make the story human so product benefits feel personal.",
    professionalDefinition:
      "Character development in commercial storytelling is the selective revelation of goals, flaws, and change for the person (or brand persona) the audience follows.",
    whenToUse: ["Testimonials", "Founder films", "Lifestyle narratives"],
    whenNotToUse: ["Pure pack-shot catalogs with no human lead"],
    bestPractices: ["One primary character", "Show desire through action", "Keep arcs short and clear"],
    commonMistakes: ["Overwritten backstory", "Relatable character without product link"],
    workflow: ["Define character goal", "Show obstacle", "Show change via product"],
    professionalExamples: ["Parent juggling morning chaos finds calm routine with product"],
    relatedTopics: ["emotional-journey", "customer-journey", "conflict", "testimonial-scene"],
    relatedDomains: ["storytelling-knowledge", "marketing-knowledge", "branding-knowledge", "product-knowledge"],
    keywords: ["character", "protagonist", "persona", "identification", "arc"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  story({
    topicId: "conflict",
    name: "Conflict",
    description: "The obstacle, tension, or unmet need that makes the story necessary.",
    purpose: "Create urgency and meaning for the product or brand solution.",
    professionalDefinition:
      "Conflict is the opposing force—external friction or internal doubt—that blocks the character’s desire and motivates seeking a solution.",
    whenToUse: ["Problem-aware audiences", "Competitive categories", "Transformation stories"],
    whenNotToUse: ["When conflict feels manipulative or brand-inappropriate"],
    bestPractices: ["Make conflict specific and visual", "Keep it solvable by the offer", "Escalate once"],
    commonMistakes: ["Vague ‘life is hard’ conflict", "Conflict the product can’t address"],
    workflow: ["Name conflict", "Visualize it", "Link to product capability"],
    professionalExamples: ["Inventory chaos visualized as overflowing tabs before inventory app"],
    relatedTopics: ["middle", "resolution", "emotional-journey", "product-storytelling"],
    relatedDomains: ["storytelling-knowledge", "marketing-knowledge", "product-knowledge", "scene-knowledge"],
    keywords: ["conflict", "obstacle", "tension", "problem", "stakes"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  story({
    topicId: "resolution",
    name: "Resolution",
    description: "The satisfying settling of conflict through the brand/product’s role.",
    purpose: "Prove that change is real and attributable to the offer.",
    professionalDefinition:
      "Resolution is the narrative closure in which conflict is addressed, the new equilibrium is shown, and credibility for the solution is established.",
    whenToUse: ["After conflict is established", "Before or with CTA"],
    whenNotToUse: ["Before the audience feels the problem"],
    bestPractices: ["Show before/after clearly", "Use proof (demo, metric, testimonial)", "Keep resolution honest"],
    commonMistakes: ["Magical resolution without proof", "Resolving a different problem than setup"],
    workflow: ["State resolved state", "Choose proof scene", "Bridge to CTA"],
    professionalExamples: ["Dashboard calm + 5-star quote + ‘Get started’"],
    relatedTopics: ["ending", "conflict", "call-to-action-placement", "demonstration-scene"],
    relatedDomains: ["storytelling-knowledge", "marketing-knowledge", "product-knowledge", "scene-knowledge"],
    keywords: ["resolution", "payoff", "solution", "after state", "closure"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  story({
    topicId: "emotional-journey",
    name: "Emotional Journey",
    description: "The planned sequence of feelings the viewer should experience from hook to CTA.",
    purpose: "Align emotion with persuasion so decisions feel motivated, not forced.",
    professionalDefinition:
      "Emotional journey is the intentional path of affect—curiosity, tension, relief, desire, confidence—mapped across story beats and scenes.",
    whenToUse: ["Brand films", "Cause campaigns", "Premium product stories"],
    whenNotToUse: ["Purely informational how-tos with no persuasion goal"],
    bestPractices: ["Name target emotion per beat", "Avoid emotional whiplash", "End on confident action"],
    commonMistakes: ["Tone mismatch with brand", "All intensity, no relief"],
    workflow: ["Map emotion per act", "Assign scene moods", "Validate with rough cut"],
    professionalExamples: ["Anxiety → recognition → relief → pride → share/CTA"],
    relatedTopics: ["narrative-flow", "conflict", "resolution", "visual-storytelling", "lifestyle-scene"],
    relatedDomains: ["storytelling-knowledge", "branding-knowledge", "lighting-knowledge", "marketing-knowledge"],
    keywords: ["emotional journey", "emotion map", "feeling arc", "mood progression"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  story({
    topicId: "call-to-action-placement",
    name: "Call To Action Placement",
    description: "Where and how the ask appears so it feels earned and clear.",
    purpose: "Convert attention into a measurable next step without breaking trust.",
    professionalDefinition:
      "CTA placement is the strategic positioning of the requested action—timing, wording, visual weight—after sufficient value and trust have been delivered.",
    whenToUse: ["All conversion-oriented videos", "Landing embeds", "Social ads"],
    whenNotToUse: ["Pure awareness films that intentionally defer the ask"],
    bestPractices: ["One primary CTA", "Place after proof", "Match platform norms", "Repeat softly if long"],
    commonMistakes: ["CTA in first second with no value", "Competing CTAs"],
    workflow: ["Define single action", "Place after resolution beat", "Design end card"],
    professionalExamples: ["Soft mid-roll ‘Learn more’ + strong end-card ‘Shop now’"],
    relatedTopics: ["ending", "resolution", "closing-scene", "brand-storytelling"],
    relatedDomains: ["storytelling-knowledge", "marketing-knowledge", "branding-knowledge", "scene-knowledge"],
    keywords: ["CTA", "call to action", "ask", "conversion", "end card"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  story({
    topicId: "brand-storytelling",
    name: "Brand Storytelling",
    description: "Narratives that express brand identity, values, and world beyond a single SKU.",
    purpose: "Build long-term meaning and preference, not only immediate sales.",
    professionalDefinition:
      "Brand storytelling is narrative craft that communicates who the brand is, what it believes, and how it shows up—consistent with identity systems and audience expectations.",
    whenToUse: ["Brand films", "Launch films", "Culture/employer brand", "Rebrands"],
    whenNotToUse: ["Hard performance ads that must stay feature-price focused"],
    bestPractices: ["Anchor in brand pillars", "Show values through action", "Keep product as proof not only logo"],
    commonMistakes: ["Generic purpose-washing", "Inconsistent tone vs brand guidelines"],
    workflow: ["Extract brand pillars", "Choose human story", "Align visuals/voice", "Close with brand mark + CTA"],
    professionalExamples: ["Craft brewery film following farmers → brew → community toast"],
    relatedTopics: ["storytelling-fundamentals", "emotional-journey", "visual-storytelling", "opening-scene"],
    relatedDomains: ["storytelling-knowledge", "branding-knowledge", "marketing-knowledge", "lighting-knowledge"],
    keywords: ["brand storytelling", "brand film", "brand narrative", "identity story"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  story({
    topicId: "product-storytelling",
    name: "Product Storytelling",
    description: "Narratives that center product benefits, proof, and usage contexts.",
    purpose: "Make features meaningful by tying them to desire and outcomes.",
    professionalDefinition:
      "Product storytelling is the craft of framing a product’s capabilities as a journey from problem to proven outcome, using demo, lifestyle, and reveal scenes.",
    whenToUse: ["Product launches", "Ecommerce videos", "Feature explainers"],
    whenNotToUse: ["Pure brand anthems with no product focus"],
    bestPractices: ["Lead with outcome", "Show use, not only beauty", "One hero feature arc"],
    commonMistakes: ["Spec dump", "Reveal without context"],
    workflow: ["Pick hero benefit", "Show conflict", "Demo capability", "Prove + CTA"],
    professionalExamples: ["Noise-cancel headphones: chaotic commute → silence → focus"],
    relatedTopics: ["product-reveal-scene", "demonstration-scene", "conflict", "customer-journey"],
    relatedDomains: ["storytelling-knowledge", "product-knowledge", "marketing-knowledge", "scene-knowledge"],
    keywords: ["product storytelling", "product narrative", "benefit story", "feature story"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  story({
    topicId: "customer-journey",
    name: "Customer Journey",
    description: "Aligning story beats with awareness, consideration, decision, and advocacy stages.",
    purpose: "Match narrative depth and CTA to where the viewer is in buying.",
    professionalDefinition:
      "Customer-journey storytelling maps narrative intensity and proof type to the viewer’s stage—from problem awareness through purchase and advocacy.",
    whenToUse: ["Funnel-specific ads", "Retargeting variants", "Lifecycle campaigns"],
    whenNotToUse: ["One-size scripts forced across all funnel stages"],
    bestPractices: ["Different hooks per stage", "More proof later in funnel", "CTA matches stage"],
    commonMistakes: ["Hard sell to cold audiences", "No reminder of value for warm audiences"],
    workflow: ["Identify stage", "Select story depth", "Choose scene sequence", "Tune CTA"],
    professionalExamples: ["Cold: problem film; warm: demo; hot: offer + urgency CTA"],
    relatedTopics: ["call-to-action-placement", "product-storytelling", "emotional-journey", "comparison-scene"],
    relatedDomains: ["storytelling-knowledge", "marketing-knowledge", "product-knowledge", "branding-knowledge"],
    keywords: ["customer journey", "funnel", "awareness", "consideration", "decision"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  story({
    topicId: "visual-storytelling",
    name: "Visual Storytelling",
    description: "Communicating narrative through image, motion, lighting, and composition—not only dialogue.",
    purpose: "Make stories work muted, international, and emotionally immediate.",
    professionalDefinition:
      "Visual storytelling is the use of shot design, lighting, composition, and scene staging to convey plot and emotion with minimal verbal dependence.",
    whenToUse: ["Social (sound-off)", "International markets", "Premium cinematic brands"],
    whenNotToUse: ["When legal claims require precise spoken/on-screen text only"],
    bestPractices: ["Show don’t only tell", "Design readable silhouettes", "Align light/mood to emotion"],
    commonMistakes: ["Pretty shots that don’t advance story", "Unreadable action"],
    workflow: ["Beat as image", "Assign camera/light/comp", "Cut for clarity"],
    professionalExamples: ["Hands trembling → product grip → steady pour, no VO needed"],
    relatedTopics: ["scene-composition", "emotional-journey", "hero-scene", "narrative-flow"],
    relatedDomains: [
      "storytelling-knowledge",
      "composition-knowledge",
      "lighting-knowledge",
      "camera-knowledge",
      "camera-movement-knowledge",
    ],
    keywords: ["visual storytelling", "show don't tell", "image narrative", "cinematic story"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
];

export const PROFESSIONAL_SCENE_DESIGN_TOPICS: ProfessionalStorytellingSceneTopic[] = [
  scene({
    topicId: "scene-planning",
    name: "Scene Planning",
    description: "Pre-visualizing and documenting what each scene must accomplish before production.",
    purpose: "Prevent wasted shots by locking purpose, coverage, and dependencies early.",
    professionalDefinition:
      "Scene planning is the pre-production discipline of defining each scene’s narrative job, duration target, locations, talent, props, and coverage needs.",
    whenToUse: ["Any multi-scene production", "Storyboard and shot-list phases"],
    whenNotToUse: ["Spontaneous documentary moments that must stay reactive"],
    bestPractices: ["One purpose per scene", "List must-get shots", "Note continuity risks"],
    commonMistakes: ["Scenes without a job", "Overplanning coverage that won’t cut"],
    workflow: ["List story beats", "Map to scenes", "Assign locations/props", "Build shot list"],
    professionalExamples: ["Beat sheet → scene cards → shot list for 30s ad"],
    relatedTopics: ["scene-purpose", "scene-timing", "story-structure", "scene-composition"],
    relatedDomains: ["scene-knowledge", "storytelling-knowledge", "video-production-knowledge", "camera-knowledge"],
    keywords: ["scene planning", "previs", "shot list", "scene cards", "prep"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  scene({
    topicId: "scene-composition",
    name: "Scene Composition",
    description: "Arranging subjects, props, and space within a scene for clarity and hierarchy.",
    purpose: "Make the scene’s story point readable in a single glance.",
    professionalDefinition:
      "Scene composition is the spatial and visual organization of elements inside a scene so the primary subject and action dominate attention.",
    whenToUse: ["Hero and demo scenes", "Any framed storytelling beat"],
    whenNotToUse: ["Intentional chaos as stylistic conflict—only when motivated"],
    bestPractices: ["Clear subject", "Supportive background", "Use depth layers"],
    commonMistakes: ["Busy frames hiding product", "Unmotivated symmetry"],
    workflow: ["Place hero", "Dress supporting props", "Check framing on camera"],
    professionalExamples: ["Product centered with lifestyle depth behind, logo readable"],
    relatedTopics: ["environment-design", "props-selection", "background-selection", "hero-scene"],
    relatedDomains: ["scene-knowledge", "composition-knowledge", "lighting-knowledge", "camera-knowledge"],
    keywords: ["scene composition", "staging", "blocking", "visual hierarchy in scene"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  scene({
    topicId: "scene-continuity",
    name: "Scene Continuity",
    description: "Maintaining consistent details, screen direction, and logic across takes and scenes.",
    purpose: "Preserve believability so viewers stay in the story.",
    professionalDefinition:
      "Scene continuity is the consistency of props, wardrobe, eyelines, lighting logic, and geography across cuts and related scenes.",
    whenToUse: ["Multi-take coverage", "Narrative day-spanning stories"],
    whenNotToUse: ["Montage that intentionally jumps time/style"],
    bestPractices: ["Script supervisor notes", "Photo references", "Match eyelines"],
    commonMistakes: ["Prop teleportation", "Crossing line of action unplanned"],
    workflow: ["Mark continuity", "Check between takes", "Verify in edit"],
    professionalExamples: ["Coffee level and hand position matched across reverse angles"],
    relatedTopics: ["scene-transition-planning", "scene-planning", "narrative-flow", "scene-composition"],
    relatedDomains: ["scene-knowledge", "video-production-knowledge", "camera-knowledge", "storytelling-knowledge"],
    keywords: ["continuity", "matching", "screen direction", "consistency"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  scene({
    topicId: "scene-transition-planning",
    name: "Scene Transition Planning",
    description: "Designing how one scene hands off to the next visually and narratively.",
    purpose: "Keep narrative flow smooth and intentional across cuts.",
    professionalDefinition:
      "Scene transition planning is the pre-design of cut, dissolve, match-cut, whip, or motivated camera moves that bridge scene purposes and emotions.",
    whenToUse: ["Multi-scene films", "Tone shifts", "Time jumps"],
    whenNotToUse: ["Single continuous take pieces"],
    bestPractices: ["Motivate transitions", "Match emotion handoff", "Plan audio bridges"],
    commonMistakes: ["Random fancy transitions", "Hard cuts that break causality"],
    workflow: ["List scene jobs", "Choose transition type", "Plan audio/visual match"],
    professionalExamples: ["Match-cut pouring coffee to pouring product serum"],
    relatedTopics: ["narrative-flow", "scene-timing", "closing-scene", "opening-scene"],
    relatedDomains: ["scene-knowledge", "storytelling-knowledge", "video-production-knowledge", "camera-movement-knowledge"],
    keywords: ["transitions", "match cut", "scene bridge", "handoff"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  scene({
    topicId: "scene-timing",
    name: "Scene Timing",
    description: "Allocating duration so each scene earns its screen time relative to the whole.",
    purpose: "Protect hook and CTA while giving proof enough room.",
    professionalDefinition:
      "Scene timing is the deliberate budgeting of seconds (or frames) per scene according to narrative priority and platform length.",
    whenToUse: ["Timed ads (6/15/30/60)", "Platform-native lengths"],
    whenNotToUse: ["Untimed documentary observational scenes"],
    bestPractices: ["Time-box on paper first", "Front-load hook", "Reserve end for CTA"],
    commonMistakes: ["Hero scene eating CTA time", "Equal timing for unequal importance"],
    workflow: ["Set total length", "Assign % per beat", "Rehearse with stopwatch"],
    professionalExamples: ["15s: 2s hook, 5s problem, 5s demo, 3s CTA"],
    relatedTopics: ["scene-planning", "scene-purpose", "call-to-action-placement", "opening-scene"],
    relatedDomains: ["scene-knowledge", "marketing-knowledge", "video-production-knowledge", "storytelling-knowledge"],
    keywords: ["scene timing", "duration", "pacing", "time budget"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  scene({
    topicId: "scene-purpose",
    name: "Scene Purpose",
    description: "The single narrative or persuasion job a scene must accomplish.",
    purpose: "Keep every scene necessary and cuttable if it fails its job.",
    professionalDefinition:
      "Scene purpose is the explicit statement of what the audience must understand or feel after the scene—hook, problem, proof, desire, or action.",
    whenToUse: ["Planning every scene", "Edit reviews"],
    whenNotToUse: ["Scenes kept only because they look expensive"],
    bestPractices: ["Write purpose on slate/card", "Kill scenes without purpose", "One purpose each"],
    commonMistakes: ["Multi-purpose muddle", "Pretty but purposeless"],
    workflow: ["State purpose", "Design coverage for it", "Validate in cut"],
    professionalExamples: ["Purpose: prove waterproof → dunk demo scene only"],
    relatedTopics: ["scene-planning", "hero-scene", "demonstration-scene", "story-structure"],
    relatedDomains: ["scene-knowledge", "storytelling-knowledge", "marketing-knowledge", "product-knowledge"],
    keywords: ["scene purpose", "scene job", "narrative function", "intent"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  scene({
    topicId: "opening-scene",
    name: "Opening Scene",
    description: "The first scene that hooks attention and establishes story world.",
    purpose: "Stop the scroll and set narrative expectations.",
    professionalDefinition:
      "An opening scene is the initial designed unit of picture and sound that captures attention, orients context, and launches the story’s promise.",
    whenToUse: ["All commercials", "Series cold opens"],
    whenNotToUse: ["Seamless mid-funnel continuations"],
    bestPractices: ["Visual hook in first second", "Clear subject", "Plant conflict or curiosity"],
    commonMistakes: ["Slow logo-first opens on social", "Unrelated beauty plate"],
    workflow: ["Design hook visual", "Write VO/title if needed", "Time-box tightly"],
    professionalExamples: ["Smash cut to broken phone screen then brand repair kit"],
    relatedTopics: ["beginning", "scene-timing", "hero-scene", "brand-storytelling"],
    relatedDomains: ["scene-knowledge", "storytelling-knowledge", "marketing-knowledge", "camera-knowledge"],
    keywords: ["opening scene", "cold open", "hook scene", "first scene"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  scene({
    topicId: "closing-scene",
    name: "Closing Scene",
    description: "The final scene that resolves emotion and delivers branding/CTA.",
    purpose: "Land the memory and the ask cleanly.",
    professionalDefinition:
      "A closing scene is the terminal unit that shows the after-state, brand signature, and call to action with unambiguous hierarchy.",
    whenToUse: ["End of every conversion film", "Episode closes"],
    whenNotToUse: ["Cliffhanger teasers withholding close"],
    bestPractices: ["Clean background for end card", "One CTA", "Hold long enough to read"],
    commonMistakes: ["Rushed end card", "Clutter fighting logo"],
    workflow: ["Design after-state", "Composite end card", "Verify legibility"],
    professionalExamples: ["Wide lifestyle resolve → logo + ‘Shop now’ hold 2s"],
    relatedTopics: ["ending", "call-to-action-placement", "resolution", "scene-timing"],
    relatedDomains: ["scene-knowledge", "marketing-knowledge", "branding-knowledge", "rendering-knowledge"],
    keywords: ["closing scene", "end scene", "end card", "final scene"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  scene({
    topicId: "hero-scene",
    name: "Hero Scene",
    description: "A premium, high-attention scene that showcases the product or brand at peak desire.",
    purpose: "Create the memorable visual peak of the commercial.",
    professionalDefinition:
      "A hero scene is a carefully lit and composed set-piece designed to maximize desirability and clarity of the product or brand moment.",
    whenToUse: ["Product launches", "Brand peaks", "Keyframe social stills"],
    whenNotToUse: ["Every scene—overuse dilutes impact"],
    bestPractices: ["Best lighting/composition budget here", "Readable logo/form", "Minimal distraction"],
    commonMistakes: ["Hero look without story context", "Obscured product"],
    workflow: ["Choose hero moment", "Design light/comp", "Shoot coverage of peak"],
    professionalExamples: ["Slow orbit of watch face with rim light and clean void"],
    relatedTopics: ["product-reveal-scene", "scene-composition", "visual-storytelling", "lifestyle-scene"],
    relatedDomains: [
      "scene-knowledge",
      "product-knowledge",
      "lighting-knowledge",
      "composition-knowledge",
      "camera-movement-knowledge",
    ],
    keywords: ["hero scene", "hero shot", "beauty scene", "peak moment"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  scene({
    topicId: "product-reveal-scene",
    name: "Product Reveal Scene",
    description: "The moment the product is disclosed or unveiled as the answer.",
    purpose: "Convert built curiosity into clear product recognition.",
    professionalDefinition:
      "A product reveal scene is a staged disclosure—visual, kinetic, or narrative—that introduces the product as the solution after context is set.",
    whenToUse: ["After problem/setup", "Launch films", "Unboxing narratives"],
    whenNotToUse: ["When product must be visible from frame one for compliance"],
    bestPractices: ["Earn the reveal", "Keep silhouette clear", "Follow with proof"],
    commonMistakes: ["Reveal with no setup", "Reveal then abandon product"],
    workflow: ["Build curiosity", "Reveal", "Hold for recognition", "Bridge to demo"],
    professionalExamples: ["Hands open box → product rises into key light"],
    relatedTopics: ["hero-scene", "product-storytelling", "demonstration-scene", "opening-scene"],
    relatedDomains: ["scene-knowledge", "product-knowledge", "lighting-knowledge", "camera-knowledge"],
    keywords: ["product reveal", "unveil", "introduction scene", "reveal"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  scene({
    topicId: "lifestyle-scene",
    name: "Lifestyle Scene",
    description: "Scenes placing the product in aspirational or authentic daily life contexts.",
    purpose: "Help viewers imagine ownership and belonging.",
    professionalDefinition:
      "A lifestyle scene depicts credible or aspirational use contexts that associate the product with identity, place, and emotion.",
    whenToUse: ["Brand building", "Social ads", "After functional proof"],
    whenNotToUse: ["When claims require pure lab/demo clarity"],
    bestPractices: ["Cast and location match audience", "Product naturally integrated", "Avoid forced placement"],
    commonMistakes: ["Product as afterthought prop", "Inauthentic settings"],
    workflow: ["Define lifestyle promise", "Scout/location", "Integrate product use"],
    professionalExamples: ["Morning run with earbuds → coffee shop arrival calm"],
    relatedTopics: ["emotional-journey", "brand-storytelling", "environment-design", "hero-scene"],
    relatedDomains: ["scene-knowledge", "marketing-knowledge", "branding-knowledge", "composition-knowledge"],
    keywords: ["lifestyle", "aspirational", "context scene", "day-in-life"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  scene({
    topicId: "demonstration-scene",
    name: "Demonstration Scene",
    description: "Scenes that prove how the product works through visible action.",
    purpose: "Deliver evidence that reduces risk and builds belief.",
    professionalDefinition:
      "A demonstration scene is a purpose-built unit showing product function, feature interaction, or performance under observable conditions.",
    whenToUse: ["Feature-led products", "Consideration-stage ads", "Explainers"],
    whenNotToUse: ["When demo is legally restricted or unsafe to imply"],
    bestPractices: ["One feature per demo beat", "Readable hands/UI", "Before/after when possible"],
    commonMistakes: ["Too fast to comprehend", "Demo of unused features"],
    workflow: ["Pick claim", "Design demo action", "Capture clean coverage", "Add proof titles if needed"],
    professionalExamples: ["Wipe-clean demo of stain on fabric with timer overlay"],
    relatedTopics: ["product-storytelling", "resolution", "comparison-scene", "scene-purpose"],
    relatedDomains: ["scene-knowledge", "product-knowledge", "marketing-knowledge", "camera-knowledge"],
    keywords: ["demonstration", "demo scene", "how it works", "proof scene"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  scene({
    topicId: "comparison-scene",
    name: "Comparison Scene",
    description: "Scenes that contrast options, before/after, or competitor-class differences fairly.",
    purpose: "Clarify superiority or fit without confusing or misleading.",
    professionalDefinition:
      "A comparison scene stages two or more states or options so differences in outcome, quality, or ease are visually obvious and claim-safe.",
    whenToUse: ["Consideration stage", "Before/after categories", "Vs-old-way narratives"],
    whenNotToUse: ["When comparative claims are legally barred"],
    bestPractices: ["Fair framing", "Same camera/light conditions when claiming parity tests", "Clear labels"],
    commonMistakes: ["Biased lighting favoring hero", "Ambiguous labels"],
    workflow: ["Define comparison axis", "Match conditions", "Show outcome", "Cite if required"],
    professionalExamples: ["Split screen: manual spreadsheet vs automated dashboard"],
    relatedTopics: ["demonstration-scene", "customer-journey", "conflict", "resolution"],
    relatedDomains: ["scene-knowledge", "marketing-knowledge", "product-knowledge", "storytelling-knowledge"],
    keywords: ["comparison", "before after", "versus", "split screen"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  scene({
    topicId: "testimonial-scene",
    name: "Testimonial Scene",
    description: "Scenes featuring real or portrayed customers validating the offer.",
    purpose: "Transfer trust through social proof.",
    professionalDefinition:
      "A testimonial scene presents a credible speaker’s experience—interview, VO, or UGC style—supporting a claim with human authenticity.",
    whenToUse: ["Trust gaps", "Retargeting", "Service businesses"],
    whenNotToUse: ["When testimonials can’t be substantiated"],
    bestPractices: ["Specific outcomes over vague praise", "Natural delivery", "Match brand tone"],
    commonMistakes: ["Over-scripted stiffness", "Unverifiable claims"],
    workflow: ["Select speaker", "Capture interview", "Cut soundbites to claims", "Disclose if required"],
    professionalExamples: ["Founder-customer interview cut against product-in-use B-roll"],
    relatedTopics: ["character-development", "emotional-journey", "resolution", "closing-scene"],
    relatedDomains: ["scene-knowledge", "marketing-knowledge", "branding-knowledge", "lighting-knowledge"],
    keywords: ["testimonial", "social proof", "review scene", "customer quote"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  scene({
    topicId: "background-selection",
    name: "Background Selection",
    description: "Choosing what sits behind action to support story without stealing focus.",
    purpose: "Control context, brand, and readability of the subject.",
    professionalDefinition:
      "Background selection is the intentional choice and control of rear-plane environment, color, and detail so scene purpose stays clear.",
    whenToUse: ["Every planned scene", "Location scouts"],
    whenNotToUse: ["Leaving BG to chance on hero frames"],
    bestPractices: ["Simplify", "Avoid conflicting text/logos", "Match emotional tone"],
    commonMistakes: ["Clutter", "Tone-on-tone subject merge"],
    workflow: ["Scout", "Dress or blur", "Verify on camera"],
    professionalExamples: ["Soft branded office bokeh behind interview subject"],
    relatedTopics: ["environment-design", "scene-composition", "lifestyle-scene", "hero-scene"],
    relatedDomains: ["scene-knowledge", "composition-knowledge", "lighting-knowledge", "branding-knowledge"],
    keywords: ["background", "backdrop", "set background", "BG selection"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  scene({
    topicId: "props-selection",
    name: "Props Selection",
    description: "Choosing objects that support story, brand, and product readability.",
    purpose: "Add meaning and realism without clutter or brand conflict.",
    professionalDefinition:
      "Props selection is the curated choice of physical objects that motivate action, signal lifestyle, and reinforce product context.",
    whenToUse: ["Tabletop", "Lifestyle", "Demo setups"],
    whenNotToUse: ["Props that compete with the hero product"],
    bestPractices: ["Fewer better props", "Period/brand accurate", "Continuity labeled"],
    commonMistakes: ["Prop spam", "Competitor logos in frame"],
    workflow: ["List story needs", "Source props", "Dress and photo-ref"],
    professionalExamples: ["Morning props: mug, keys, product pouch—only three"],
    relatedTopics: ["scene-composition", "environment-design", "product-reveal-scene", "scene-continuity"],
    relatedDomains: ["scene-knowledge", "product-knowledge", "branding-knowledge", "composition-knowledge"],
    keywords: ["props", "prop styling", "set dressing objects", "hero props"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  scene({
    topicId: "environment-design",
    name: "Environment Design",
    description: "Designing the overall space—architecture, set, location—as a storytelling system.",
    purpose: "Make place express brand world and support blocking.",
    professionalDefinition:
      "Environment design is the holistic crafting of location or set—layout, materials, light logic, and pathways—so scenes feel coherent and brand-true.",
    whenToUse: ["Studio builds", "Location transforms", "Brand world films"],
    whenNotToUse: ["Run-and-gun docs where environment is found truth"],
    bestPractices: ["Design for camera paths", "Control color palette", "Plan power/light access"],
    commonMistakes: ["Pretty sets that block coverage", "Palette fighting product"],
    workflow: ["Mood references", "Floor plan", "Dress layers", "Tech scout"],
    professionalExamples: ["Modular kitchen set with clean sightlines for cooking demo"],
    relatedTopics: ["background-selection", "props-selection", "scene-composition", "lifestyle-scene"],
    relatedDomains: [
      "scene-knowledge",
      "branding-knowledge",
      "lighting-knowledge",
      "video-production-knowledge",
      "rendering-knowledge",
    ],
    keywords: ["environment", "set design", "location design", "world building"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
];

export const STORYTELLING_SCENE_DOMAIN_BRIDGES: StorytellingSceneDomainBridge[] = [
  {
    domainId: "storytelling-knowledge",
    knowledgeId: "ss-bridge-storytelling-knowledge",
    title: "Storytelling Knowledge Domain",
    description: "Hub for professional storytelling expansion Step 4.",
    relationshipEvidence: "Primary domain for storytelling technique topics.",
  },
  {
    domainId: "scene-knowledge",
    knowledgeId: "ss-bridge-scene-knowledge",
    title: "Scene Knowledge Domain",
    description: "Hub for professional scene design expansion Step 4.",
    relationshipEvidence: "Primary domain for scene design technique topics.",
  },
  {
    domainId: "camera-knowledge",
    knowledgeId: "ss-bridge-camera-knowledge",
    title: "Camera Knowledge (related)",
    description: "Story and scenes are executed through camera framing and exposure.",
    relationshipEvidence: "Camera settings realize visual storytelling choices.",
  },
  {
    domainId: "camera-movement-knowledge",
    knowledgeId: "ss-bridge-camera-movement-knowledge",
    title: "Camera Movement Knowledge (related)",
    description: "Scene energy and reveals depend on motivated camera movement.",
    relationshipEvidence: "Moves support scene purpose and emotional journey.",
  },
  {
    domainId: "lighting-knowledge",
    knowledgeId: "ss-bridge-lighting-knowledge",
    title: "Lighting Knowledge (related)",
    description: "Mood and readability of scenes depend on lighting craft.",
    relationshipEvidence: "Lighting shapes emotional journey and hero scenes.",
  },
  {
    domainId: "composition-knowledge",
    knowledgeId: "ss-bridge-composition-knowledge",
    title: "Composition Knowledge (related)",
    description: "Scene layouts inherit composition principles.",
    relationshipEvidence: "Framing and hierarchy make scene purpose readable.",
  },
  {
    domainId: "video-production-knowledge",
    knowledgeId: "ss-bridge-video-production-knowledge",
    title: "Video Production Knowledge (related)",
    description: "Story and scenes sit inside end-to-end production workflows.",
    relationshipEvidence: "Production planning schedules story beats as scenes.",
  },
  {
    domainId: "marketing-knowledge",
    knowledgeId: "ss-bridge-marketing-knowledge",
    title: "Marketing Knowledge (related)",
    description: "Commercial stories serve marketing goals and funnel stages.",
    relationshipEvidence: "CTA and customer journey align story to marketing.",
  },
  {
    domainId: "branding-knowledge",
    knowledgeId: "ss-bridge-branding-knowledge",
    title: "Branding Knowledge (related)",
    description: "Brand storytelling and environments must match brand systems.",
    relationshipEvidence: "Brand pillars constrain tone, world, and end cards.",
  },
  {
    domainId: "product-knowledge",
    knowledgeId: "ss-bridge-product-knowledge",
    title: "Product Photography / Product Knowledge (related)",
    description: "Product storytelling and reveal/demo scenes depend on product truth.",
    relationshipEvidence: "Product capabilities define demo and reveal content.",
  },
  {
    domainId: "rendering-knowledge",
    knowledgeId: "ss-bridge-rendering-knowledge",
    title: "Rendering Knowledge (related)",
    description: "Finishing preserves story timing, titles, and delivery of scenes.",
    relationshipEvidence: "Grade and delivery protect scene intent and CTA clarity.",
  },
];

export const REQUIRED_STORYTELLING_TOPIC_IDS: StorytellingTopicId[] = PROFESSIONAL_STORYTELLING_TOPICS.map(
  (t) => t.topicId as StorytellingTopicId
);
export const REQUIRED_SCENE_DESIGN_TOPIC_IDS: SceneDesignTopicId[] = PROFESSIONAL_SCENE_DESIGN_TOPICS.map(
  (t) => t.topicId as SceneDesignTopicId
);

export const REQUIRED_STORY_STRUCTURE_CONCEPTS = [
  "storytelling-fundamentals",
  "story-structure",
  "three-act-structure",
  "beginning",
  "middle",
  "ending",
  "conflict",
  "resolution",
  "emotional-journey",
  "call-to-action-placement",
];

export function getStorytellingTopic(id: string): ProfessionalStorytellingSceneTopic | null {
  return (
    PROFESSIONAL_STORYTELLING_TOPICS.find(
      (t) => t.topicId === id || t.knowledgeId === id || t.name.toLowerCase() === id.toLowerCase()
    ) ?? null
  );
}

export function getSceneDesignTopic(id: string): ProfessionalStorytellingSceneTopic | null {
  return (
    PROFESSIONAL_SCENE_DESIGN_TOPICS.find(
      (t) => t.topicId === id || t.knowledgeId === id || t.name.toLowerCase() === id.toLowerCase()
    ) ?? null
  );
}

export function getStorytellingSceneTopic(id: string): ProfessionalStorytellingSceneTopic | null {
  return getStorytellingTopic(id) ?? getSceneDesignTopic(id);
}

export function findStorytellingTopics(query: string): ProfessionalStorytellingSceneTopic[] {
  return rankTopics(query, PROFESSIONAL_STORYTELLING_TOPICS, (t) => identityHay(t), (t) => [t.topicId, t.name, t.title]);
}

export function findSceneDesignTopics(query: string): ProfessionalStorytellingSceneTopic[] {
  return rankTopics(query, PROFESSIONAL_SCENE_DESIGN_TOPICS, (t) => identityHay(t), (t) => [t.topicId, t.name, t.title]);
}

function identityHay(t: ProfessionalStorytellingSceneTopic): string[] {
  return [
    t.topicId,
    t.name,
    t.title,
    t.description,
    t.purpose,
    t.professionalDefinition,
    ...t.keywords,
    ...t.whenToUse,
    ...t.bestPractices,
    ...t.workflow,
  ];
}

function rankTopics<T>(
  query: string,
  items: T[],
  haystackOf: (item: T) => string[],
  identityOf: (item: T) => string[]
): T[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return [...items];
  const stop = new Set([
    "what", "is", "are", "how", "should", "i", "the", "a", "an", "do", "does", "can", "to", "for",
    "of", "in", "on", "and", "or", "about", "explain", "recommend", "compare", "best", "story",
    "storytelling", "scene", "scenes", "design", "technique", "techniques", "use", "when", "why",
    "build", "structure", "sequence", "flow",
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
      const aIds = identityOf(a).map((v) => v.toLowerCase());
      const bIds = identityOf(b).map((v) => v.toLowerCase());
      const score = (ids: string[]) => (ids.some((id) => id === lower || id.replace(/-/g, " ") === lower) ? 1 : 0);
      return score(bIds) - score(aIds);
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
