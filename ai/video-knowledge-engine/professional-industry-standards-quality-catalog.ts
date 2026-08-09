/**
 * Curated Industry Best Practices, Professional Standards & Quality Rules catalog (Expansion Step 9).
 * Complements runtime quality validators with explainable professional guidance; it does not certify work.
 */

import {
  INDUSTRY_STANDARDS_DOMAIN_ID,
  PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION,
  type IsqCategory,
  type IsqDomainBridge,
  type IsqRelatedDomainId,
  type IsqTopicId,
  type ProfessionalBestPracticesTopicId,
  type ProfessionalChecklistTopicId,
  type ProfessionalIsqTopic,
  type ProfessionalStandardsTopicId,
  type QualityEvaluationTopicId,
  type QualityRulesTopicId,
} from "./professional-industry-standards-quality-types.js";

type PartialTopic = Omit<
  ProfessionalIsqTopic,
  "knowledgeId" | "title" | "metadata" | "workflow" | "professionalExamples" | "qualityRules"
> & {
  knowledgeId?: string;
  title?: string;
  workflow?: string[];
  professionalExamples?: string[];
  qualityRules?: string[];
};

function metaFor(category: IsqCategory, confidenceScore: number): ProfessionalIsqTopic["metadata"] {
  return {
    domainId: INDUSTRY_STANDARDS_DOMAIN_ID,
    category,
    difficulty: confidenceScore >= 91 ? "advanced" : confidenceScore >= 86 ? "intermediate" : "foundation",
    expansionStep: 9,
    version: PROFESSIONAL_INDUSTRY_STANDARDS_QUALITY_VERSION,
    learningOnly: true,
    generatesMedia: false,
    certifiesKnowledge: false,
  };
}

function finish(
  topic: PartialTopic,
  prefix: string,
  category: IsqCategory,
  defaultWorkflow: string[]
): ProfessionalIsqTopic {
  return {
    ...topic,
    knowledgeId: topic.knowledgeId ?? `${prefix}-${topic.topicId}`,
    title: topic.title ?? topic.name,
    qualityRules:
      topic.qualityRules ??
      [
        "Define observable acceptance criteria before review.",
        "Evaluate the work against its intended audience, channel, and delivery context.",
        "Document material exceptions and corrective actions.",
      ],
    workflow: topic.workflow ?? defaultWorkflow,
    professionalExamples: topic.professionalExamples ?? [`Professional application of ${topic.name} in a studio review.`],
    metadata: metaFor(category, topic.confidenceScore),
  };
}

function standard(topic: PartialTopic): ProfessionalIsqTopic {
  return finish(
    topic,
    "std",
    "professional-industry-standards",
    ["Define scope and acceptance criteria", "Apply the standard during work", "Review evidence", "Record exceptions", "Approve or improve"]
  );
}

function qualityRule(topic: PartialTopic): ProfessionalIsqTopic {
  return finish(
    topic,
    "qrule",
    "professional-quality-rules",
    ["Inspect against the rule set", "Identify material defects", "Prioritize remediation", "Re-review after correction"]
  );
}

function practice(topic: PartialTopic): ProfessionalIsqTopic {
  return finish(
    topic,
    "bp",
    "professional-best-practices",
    ["Set the objective", "Select proven practice", "Execute consistently", "Measure result", "Improve the next iteration"]
  );
}

function evaluation(topic: PartialTopic): ProfessionalIsqTopic {
  return finish(
    topic,
    "qeval",
    "professional-quality-evaluation",
    ["Set evaluation context", "Inspect objective evidence", "Score criteria", "List material gaps", "Recommend improvements"]
  );
}

function checklist(topic: PartialTopic): ProfessionalIsqTopic {
  return finish(
    topic,
    "check",
    "professional-checklists",
    ["Confirm owner and scope", "Complete each control", "Log exceptions", "Resolve blockers", "Capture approval evidence"]
  );
}

const REL_FOUNDATION: IsqRelatedDomainId[] = [
  "industry-standards-knowledge",
  "video-production-knowledge",
  "marketing-knowledge",
  "branding-knowledge",
  "social-media-knowledge",
];

const REL_PRODUCTION: IsqRelatedDomainId[] = [
  "industry-standards-knowledge",
  "video-production-knowledge",
  "camera-knowledge",
  "lighting-knowledge",
  "storytelling-knowledge",
  "video-editing-knowledge",
];

const REL_FINISHING: IsqRelatedDomainId[] = [
  "industry-standards-knowledge",
  "animation-knowledge",
  "rendering-knowledge",
  "video-editing-knowledge",
  "video-production-knowledge",
];

const REL_COMMERCIAL: IsqRelatedDomainId[] = [
  "industry-standards-knowledge",
  "marketing-knowledge",
  "social-media-knowledge",
  "branding-knowledge",
  "product-knowledge",
];

export const PROFESSIONAL_STANDARDS_TOPICS: ProfessionalIsqTopic[] = [
  standard({
    topicId: "industry-standards",
    name: "Industry Standards",
    description: "Shared professional expectations for reliable, safe, audience-appropriate creative work.",
    professionalDefinition:
      "Industry standards are documented, repeatable expectations that define acceptable quality, delivery, review, and accountability for a professional output.",
    purpose: "Give AI Me a cross-discipline baseline for high-quality recommendations.",
    bestPractices: ["Match the standard to the medium and channel", "Use observable acceptance criteria", "Escalate material exceptions before delivery"],
    commonMistakes: ["Treating taste as the only standard", "Applying one platform's rule to every output"],
    qualityRules: ["Requirements must be explicit and reviewable", "Delivery must satisfy agreed technical and creative criteria", "Exceptions require a recorded decision"],
    relatedTopics: ["production-standards", "quality-assurance", "technical-standards", "review-process"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["industry standards", "professional standard", "acceptance criteria", "quality baseline"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  standard({
    topicId: "production-standards",
    name: "Production Standards",
    description: "Professional controls for planning, capture, continuity, safety, and asset management.",
    professionalDefinition:
      "Production standards define the minimum process and craft controls that make a shoot or creative production repeatable, safe, and fit for post-production.",
    purpose: "Help AI Me recommend a dependable production baseline.",
    bestPractices: ["Use a signed brief and shot plan", "Confirm rights, releases, and safety controls", "Back up media before wrap"],
    commonMistakes: ["Starting without a technical plan", "Relying on a single copy of production media"],
    qualityRules: ["Capture must meet planned resolution, exposure, and audio requirements", "Continuity notes must accompany complex scenes", "Media must be verified before handoff"],
    relatedTopics: ["pre-production-checklist", "production-checklist", "video-quality-rules", "camera-quality-rules"],
    relatedDomains: REL_PRODUCTION,
    keywords: ["production standards", "shoot day", "continuity", "media backup", "call sheet"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  standard({
    topicId: "quality-assurance",
    name: "Quality Assurance",
    description: "Preventive controls that catch defects before a deliverable reaches its audience.",
    professionalDefinition:
      "Quality assurance is the planned process of defining criteria, applying controls, and verifying outputs so defects are prevented rather than discovered after release.",
    purpose: "Teach AI Me to recommend structured quality controls instead of subjective last-minute review.",
    bestPractices: ["Build checks into every stage", "Assign review ownership", "Separate creator review from final approval"],
    commonMistakes: ["Only reviewing at the end", "No documented acceptance criteria"],
    qualityRules: ["Every critical deliverable needs a review gate", "Defects require an owner and resolution status", "Approval evidence must be retained"],
    relatedTopics: ["quality-review-checklist", "review-process", "final-approval-checklist", "technical-quality-evaluation"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["quality assurance", "QA", "review gate", "defect prevention", "acceptance"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  standard({
    topicId: "professional-workflows",
    name: "Professional Workflows",
    description: "Repeatable handoffs, ownership, and review sequences for dependable studio work.",
    professionalDefinition:
      "Professional workflows coordinate roles, inputs, decisions, versioning, and handoffs so quality does not depend on memory or informal assumptions.",
    purpose: "Recommend reliable end-to-end work patterns.",
    bestPractices: ["Define owner and acceptance at each handoff", "Version assets and decisions", "Use explicit gates for irreversible steps"],
    commonMistakes: ["Ambiguous ownership", "Untracked changes between review rounds"],
    qualityRules: ["Each stage has a named owner", "Inputs and outputs are documented", "Approval gates occur before costly downstream work"],
    relatedTopics: ["creative-workflows", "review-process", "approval-process", "delivery-standards"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["professional workflow", "handoff", "ownership", "versioning", "approval gate"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  standard({
    topicId: "creative-workflows",
    name: "Creative Workflows",
    description: "A structured path from brief through concepts, production, review, and refinement.",
    professionalDefinition:
      "Creative workflows preserve strategic intent while allowing exploration through constrained ideation, critique, iteration, and approved production execution.",
    purpose: "Help AI Me explain how professionals improve creative work systematically.",
    bestPractices: ["Start from audience and objective", "Separate exploration from approval", "Critique against the brief, not personal preference"],
    commonMistakes: ["Skipping the brief", "Changing direction after production without change control"],
    qualityRules: ["Concepts must trace to the brief", "Feedback must be actionable", "Approved direction is recorded before production"],
    relatedTopics: ["planning-best-practices", "review-process", "story-quality-evaluation", "brand-consistency-evaluation"],
    relatedDomains: ["industry-standards-knowledge", "storytelling-knowledge", "marketing-knowledge", "branding-knowledge", "video-production-knowledge"],
    keywords: ["creative workflow", "brief", "ideation", "critique", "iteration"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  standard({
    topicId: "technical-standards",
    name: "Technical Standards",
    description: "Objective technical requirements for formats, fidelity, interoperability, and accessibility.",
    professionalDefinition:
      "Technical standards define measurable constraints—such as format, resolution, levels, color, accessibility, and compatibility—that protect a deliverable from avoidable defects.",
    purpose: "Let AI Me explain technical readiness without claiming to inspect an actual file.",
    bestPractices: ["Define target platform specifications early", "Validate on representative devices", "Include accessibility requirements in the brief"],
    commonMistakes: ["Choosing export settings at the end", "Ignoring captions, loudness, or color handling"],
    qualityRules: ["Deliverables must meet platform specifications", "Accessibility controls are verified where applicable", "Technical acceptance is tested before final approval"],
    relatedTopics: ["delivery-standards", "technical-quality-evaluation", "rendering-quality-rules", "audio-quality-rules"],
    relatedDomains: ["industry-standards-knowledge", "rendering-knowledge", "video-editing-knowledge", "video-production-knowledge", "social-media-knowledge"],
    keywords: ["technical standards", "specification", "accessibility", "compatibility", "format"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  standard({
    topicId: "delivery-standards",
    name: "Delivery Standards",
    description: "Packaging, naming, verification, and handoff requirements for final assets.",
    professionalDefinition:
      "Delivery standards govern the final package: correct exports, file names, metadata, rights, documentation, and verified transfer to the intended destination.",
    purpose: "Recommend professional delivery readiness checks.",
    bestPractices: ["Use agreed naming and folder conventions", "Include master and platform derivatives", "Verify the delivered files after transfer"],
    commonMistakes: ["Sending unverified exports", "Missing source files or documentation"],
    qualityRules: ["Files are named and versioned consistently", "Required masters and derivatives are present", "Delivery is verified by the receiving context"],
    relatedTopics: ["publishing-checklist", "final-approval-checklist", "rendering-quality-rules", "technical-standards"],
    relatedDomains: ["industry-standards-knowledge", "rendering-knowledge", "video-editing-knowledge", "marketing-knowledge", "social-media-knowledge"],
    keywords: ["delivery standards", "handoff", "file naming", "master", "platform export"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  standard({
    topicId: "review-process",
    name: "Review Process",
    description: "A disciplined critique and revision process tied to approved criteria.",
    professionalDefinition:
      "A review process is a sequenced evaluation of creative, technical, and commercial criteria that produces actionable feedback and controlled revisions.",
    purpose: "Help AI Me recommend useful review sessions and feedback.",
    bestPractices: ["Review against agreed criteria", "Consolidate feedback by owner", "Distinguish blockers from preferences"],
    commonMistakes: ["Unstructured group feedback", "Contradictory requests without priority"],
    qualityRules: ["Feedback states the criterion and evidence", "Critical defects have priority", "Approval status is unambiguous"],
    relatedTopics: ["quality-review-checklist", "approval-process", "quality-assurance", "content-consistency-evaluation"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["review process", "creative review", "feedback", "revision", "criteria"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  standard({
    topicId: "approval-process",
    name: "Approval Process",
    description: "Formal acceptance of work once quality, rights, and delivery criteria are satisfied.",
    professionalDefinition:
      "An approval process records the accountable decision to accept, revise, or reject a deliverable after evidence-based review of its defined acceptance criteria.",
    purpose: "Guide AI Me on final acceptance and accountability.",
    bestPractices: ["Name the final approver", "Capture decision and version", "Resolve open risks before sign-off"],
    commonMistakes: ["Verbal approval with no record", "Approving before technical verification"],
    qualityRules: ["Approval identifies the exact version", "Open critical issues block final acceptance", "Approval records are retained with delivery evidence"],
    relatedTopics: ["final-approval-checklist", "review-process", "quality-assurance", "delivery-standards"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["approval process", "sign-off", "acceptance", "accountability", "final review"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
];

export const PROFESSIONAL_QUALITY_RULES_TOPICS: ProfessionalIsqTopic[] = [
  qualityRule({
    topicId: "video-quality-rules",
    name: "Video Quality Rules",
    description: "Rules for intelligible, stable, correctly framed, and platform-appropriate video.",
    professionalDefinition:
      "Video quality rules assess image stability, exposure, focus, composition, motion, continuity, legibility, and platform suitability against the creative brief.",
    purpose: "Give AI Me explainable criteria for professional video quality guidance.",
    bestPractices: ["Review at target resolution", "Check focus and exposure on critical shots", "Validate captions and graphics on mobile"],
    commonMistakes: ["Accepting soft focus on key product shots", "Reviewing only in the edit timeline"],
    qualityRules: ["Critical subject is intentionally focused and exposed", "Frame and movement support the message", "Graphics remain readable on the target display"],
    relatedTopics: ["visual-quality-evaluation", "camera-quality-rules", "editing-quality-rules", "production-checklist"],
    relatedDomains: REL_PRODUCTION,
    keywords: ["video quality", "focus", "exposure", "framing", "continuity"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  qualityRule({
    topicId: "image-quality-rules",
    name: "Image Quality Rules",
    description: "Rules for sharp, color-correct, purposeful, and artifact-free still images.",
    professionalDefinition:
      "Image quality rules evaluate resolution, sharpness, lighting, color, composition, retouching integrity, and correct preparation for the intended output.",
    purpose: "Recommend professional still-image quality controls.",
    bestPractices: ["Inspect at 100% and final output size", "Protect natural product color", "Check edges and retouching artifacts"],
    commonMistakes: ["Over-smoothing detail", "Exporting without checking crop variants"],
    qualityRules: ["Subject detail is appropriate for the output size", "Color and retouching preserve product truth", "No visible artifacts, unintended halos, or clipped critical detail"],
    relatedTopics: ["visual-quality-evaluation", "lighting-quality-rules", "product-photography-best-practices", "content-consistency-evaluation"],
    relatedDomains: ["industry-standards-knowledge", "lighting-knowledge", "product-knowledge", "branding-knowledge", "marketing-knowledge"],
    keywords: ["image quality", "sharpness", "retouching", "color accuracy", "resolution"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  qualityRule({
    topicId: "audio-quality-rules",
    name: "Audio Quality Rules",
    description: "Rules for clear dialogue, controlled levels, intelligibility, and clean mixes.",
    professionalDefinition:
      "Audio quality rules evaluate intelligibility, noise, distortion, loudness, balance, synchronization, and accessibility so sound supports rather than distracts from the message.",
    purpose: "Explain audio readiness standards for professional content.",
    bestPractices: ["Monitor with headphones and speakers", "Check dialogue against noise and music", "Verify loudness against delivery needs"],
    commonMistakes: ["Relying on laptop speakers only", "Masking speech with music"],
    qualityRules: ["Dialogue is intelligible in the target context", "No unintended clipping, hum, or distracting noise", "Levels are consistent and synchronized"],
    relatedTopics: ["audio-quality-evaluation", "technical-quality-evaluation", "post-production-checklist", "delivery-standards"],
    relatedDomains: ["industry-standards-knowledge", "video-production-knowledge", "video-editing-knowledge", "rendering-knowledge", "social-media-knowledge"],
    keywords: ["audio quality", "dialogue", "loudness", "noise", "mix"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  qualityRule({
    topicId: "lighting-quality-rules",
    name: "Lighting Quality Rules",
    description: "Rules for motivated, controlled, consistent, and subject-supporting light.",
    professionalDefinition:
      "Lighting quality rules judge whether light reveals the intended subject, supports mood, protects highlight and shadow detail, and remains consistent across a sequence.",
    purpose: "Recommend lighting review criteria.",
    bestPractices: ["Check skin or product tone against reference", "Control spill and unwanted reflections", "Match continuity between angles"],
    commonMistakes: ["Blown highlights on reflective products", "Inconsistent color temperature across cuts"],
    qualityRules: ["Light supports the intended subject and mood", "Critical highlights and shadows retain useful detail", "Color temperature and direction remain coherent"],
    relatedTopics: ["visual-quality-evaluation", "camera-quality-rules", "production-checklist", "product-photography-best-practices"],
    relatedDomains: ["industry-standards-knowledge", "lighting-knowledge", "camera-knowledge", "video-production-knowledge", "product-knowledge"],
    keywords: ["lighting quality", "highlight", "shadow", "color temperature", "continuity"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  qualityRule({
    topicId: "camera-quality-rules",
    name: "Camera Quality Rules",
    description: "Rules for exposure, focus, framing, lens choice, and controlled motion.",
    professionalDefinition:
      "Camera quality rules assess whether capture choices preserve technical integrity while using framing, lens, focus, and movement intentionally for the story.",
    purpose: "Give AI Me professional capture-quality checks.",
    bestPractices: ["Set exposure and white balance deliberately", "Confirm critical focus before each take", "Use support appropriate to intended motion"],
    commonMistakes: ["Auto settings changing mid-shot", "Unmotivated camera movement"],
    qualityRules: ["Focus, exposure, and color are deliberate", "Framing serves the story or product", "Motion is stable or intentionally expressive"],
    relatedTopics: ["video-quality-rules", "lighting-quality-rules", "production-standards", "production-checklist"],
    relatedDomains: ["industry-standards-knowledge", "camera-knowledge", "lighting-knowledge", "video-production-knowledge", "storytelling-knowledge"],
    keywords: ["camera quality", "focus", "white balance", "exposure", "stability"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  qualityRule({
    topicId: "editing-quality-rules",
    name: "Editing Quality Rules",
    description: "Rules for purposeful pacing, continuity, legibility, and clean editorial decisions.",
    professionalDefinition:
      "Editing quality rules evaluate whether shot selection, pacing, transitions, sound sync, graphics, and continuity help the audience understand and feel the intended message.",
    purpose: "Provide clear quality criteria for post-production decisions.",
    bestPractices: ["Cut for meaning before decoration", "Check continuity and audio transitions", "Review graphics at delivery size"],
    commonMistakes: ["Using transitions to hide weak structure", "Leaving dead time before value"],
    qualityRules: ["Every cut serves clarity, emotion, or pace", "Continuity defects are resolved or intentional", "Text and graphics are legible and timed for comprehension"],
    relatedTopics: ["video-quality-rules", "storytelling-quality-rules", "editing-best-practices", "post-production-checklist"],
    relatedDomains: ["industry-standards-knowledge", "video-editing-knowledge", "storytelling-knowledge", "video-production-knowledge", "social-media-knowledge"],
    keywords: ["editing quality", "pacing", "continuity", "transitions", "graphics"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  qualityRule({
    topicId: "rendering-quality-rules",
    name: "Rendering Quality Rules",
    description: "Rules for final export fidelity, codec suitability, color, and artifact-free delivery.",
    professionalDefinition:
      "Rendering quality rules verify that the final encode preserves intended visual and audio quality within the correct format, frame rate, color handling, and bitrate constraints.",
    purpose: "Explain professional render and export readiness.",
    bestPractices: ["Export platform-specific versions", "Inspect a full encoded file", "Retain a high-quality master"],
    commonMistakes: ["Only checking the timeline preview", "Using one codec and bitrate for every destination"],
    qualityRules: ["Master and delivery settings match the target specification", "No encoding artifacts compromise important detail", "Audio, captions, and color survive the final encode"],
    relatedTopics: ["technical-standards", "delivery-standards", "technical-quality-evaluation", "publishing-checklist"],
    relatedDomains: REL_FINISHING,
    keywords: ["rendering quality", "codec", "bitrate", "export", "encoding artifacts"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  qualityRule({
    topicId: "storytelling-quality-rules",
    name: "Storytelling Quality Rules",
    description: "Rules for clear stakes, coherent structure, audience relevance, and earned payoff.",
    professionalDefinition:
      "Storytelling quality rules evaluate whether a narrative establishes context, advances an understandable change, maintains emotional or informational momentum, and resolves with value.",
    purpose: "Help AI Me evaluate story quality through transparent criteria.",
    bestPractices: ["Clarify audience, promise, and payoff", "Give each scene a purpose", "Use conflict or tension proportionate to the message"],
    commonMistakes: ["A beautiful sequence with no message", "Introducing a CTA before value is established"],
    qualityRules: ["The audience can understand the central message", "Each beat advances the intended journey", "The ending delivers or directs toward the promised value"],
    relatedTopics: ["story-quality-evaluation", "editing-quality-rules", "creative-workflows", "content-optimization-best-practices"],
    relatedDomains: ["industry-standards-knowledge", "storytelling-knowledge", "video-editing-knowledge", "video-production-knowledge", "marketing-knowledge"],
    keywords: ["storytelling quality", "narrative", "stakes", "payoff", "story arc"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  qualityRule({
    topicId: "marketing-quality-rules",
    name: "Marketing Quality Rules",
    description: "Rules for audience fit, truthful value communication, clear CTA, and measurable relevance.",
    professionalDefinition:
      "Marketing quality rules assess whether content communicates a defensible value proposition to the intended audience through an appropriate message, proof, and action.",
    purpose: "Guide quality review of commercial and social content without generating advertisements.",
    bestPractices: ["Align one message to one audience need", "Substantiate claims", "Make the next action clear and proportionate"],
    commonMistakes: ["Feature lists without customer benefit", "Unverifiable claims or hidden conditions"],
    qualityRules: ["Claims are truthful and supportable", "Value is clear to the intended audience", "CTA and destination match the funnel stage"],
    relatedTopics: ["marketing-effectiveness-evaluation", "content-optimization-best-practices", "brand-consistency-evaluation", "social-media-best-practices"],
    relatedDomains: REL_COMMERCIAL,
    keywords: ["marketing quality", "value proposition", "claim substantiation", "CTA", "audience fit"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
];

export const PROFESSIONAL_BEST_PRACTICES_TOPICS: ProfessionalIsqTopic[] = [
  practice({
    topicId: "planning-best-practices",
    name: "Planning Best Practices",
    description: "Upfront practices that reduce ambiguity, rework, and avoidable production risk.",
    professionalDefinition:
      "Planning best practices turn a broad request into a documented objective, audience, scope, constraints, quality criteria, schedule, and decision path before production begins.",
    purpose: "Recommend professional preparation for any creative initiative.",
    bestPractices: ["Write a measurable brief", "Identify risks and dependencies early", "Define success before selecting tactics"],
    commonMistakes: ["Starting with execution before objectives", "No allowance for review or revisions"],
    qualityRules: ["Brief, audience, and acceptance criteria are documented", "Dependencies and rights are known", "Review gates are scheduled before work starts"],
    relatedTopics: ["pre-production-checklist", "professional-workflows", "production-standards", "quality-assurance"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["planning best practices", "brief", "scope", "risk", "success criteria"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  practice({
    topicId: "production-best-practices",
    name: "Production Best Practices",
    description: "Disciplined on-set and production habits that protect creative and technical quality.",
    professionalDefinition:
      "Production best practices combine preparation, capture verification, collaboration, safety, continuity, and media protection into dependable daily execution.",
    purpose: "Recommend practical habits for professional production.",
    bestPractices: ["Run technical checks before critical takes", "Maintain continuity notes", "Back up verified media on the production day"],
    commonMistakes: ["Assuming the first take is technically usable", "Deferring media management until after travel"],
    qualityRules: ["Critical takes are reviewed before moving on", "Assets are backed up and labeled", "Safety and rights controls are respected"],
    relatedTopics: ["production-checklist", "production-standards", "camera-quality-rules", "lighting-quality-rules"],
    relatedDomains: REL_PRODUCTION,
    keywords: ["production best practices", "on set", "backup", "continuity", "technical check"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  practice({
    topicId: "editing-best-practices",
    name: "Editing Best Practices",
    description: "Editorial habits that improve clarity, rhythm, continuity, and reviewability.",
    professionalDefinition:
      "Editing best practices organize media, prioritize story and audience comprehension, use disciplined versioning, and verify every change against the brief.",
    purpose: "Recommend dependable post-production behavior.",
    bestPractices: ["Build selects before fine cut", "Use named versions for review", "Watch from the audience perspective before approval"],
    commonMistakes: ["Polishing before story is solved", "Sending unclear review versions"],
    qualityRules: ["Story and clarity are solved before cosmetic work", "Versions are traceable", "Changes are verified against feedback and acceptance criteria"],
    relatedTopics: ["editing-quality-rules", "post-production-checklist", "review-process", "story-quality-evaluation"],
    relatedDomains: ["industry-standards-knowledge", "video-editing-knowledge", "storytelling-knowledge", "video-production-knowledge", "rendering-knowledge"],
    keywords: ["editing best practices", "rough cut", "versioning", "review cut", "post production"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  practice({
    topicId: "rendering-best-practices",
    name: "Rendering Best Practices",
    description: "Export planning and validation practices for dependable delivery.",
    professionalDefinition:
      "Rendering best practices produce the correct master and channel derivatives through controlled export presets, encoded-file inspection, and documented delivery checks.",
    purpose: "Recommend professional rendering and export workflows.",
    bestPractices: ["Use approved export presets", "Render a short test when settings change", "Inspect final encodes rather than source timeline only"],
    commonMistakes: ["Overwriting the master", "Shipping an untested platform derivative"],
    qualityRules: ["Master is preserved", "Each export meets its platform profile", "Final delivered file is inspected end-to-end"],
    relatedTopics: ["rendering-quality-rules", "delivery-standards", "publishing-checklist", "technical-standards"],
    relatedDomains: REL_FINISHING,
    keywords: ["rendering best practices", "export preset", "master", "delivery", "QC"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  practice({
    topicId: "branding-best-practices",
    name: "Branding Best Practices",
    description: "Practices for coherent identity, voice, visual system, and truthful differentiation.",
    professionalDefinition:
      "Branding best practices keep every touchpoint aligned to a documented identity, audience promise, visual system, and verbal voice while allowing intentional adaptation by channel.",
    purpose: "Recommend professional consistency practices across content.",
    bestPractices: ["Use approved visual and voice guidelines", "Review new formats for recognizability", "Protect truthful product and brand claims"],
    commonMistakes: ["Treating guidelines as decoration", "Over-standardizing until platform content feels inauthentic"],
    qualityRules: ["Identity is recognizable across touchpoints", "Voice and claims match the brand promise", "Channel adaptations preserve core brand cues"],
    relatedTopics: ["brand-consistency-evaluation", "content-consistency-evaluation", "marketing-quality-rules", "social-media-best-practices"],
    relatedDomains: REL_COMMERCIAL,
    keywords: ["branding best practices", "brand consistency", "brand voice", "guidelines", "identity"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  practice({
    topicId: "product-photography-best-practices",
    name: "Product Photography Best Practices",
    description: "Practices for truthful, useful, visually coherent product images.",
    professionalDefinition:
      "Product photography best practices show products accurately and attractively through controlled lighting, clear hierarchy, appropriate angles, consistent retouching, and output-specific crops.",
    purpose: "Recommend professional product-presentation practices.",
    bestPractices: ["Match lighting to material and use case", "Show scale and key details", "Maintain consistent crops across a range"],
    commonMistakes: ["Retouching away functional product detail", "Misrepresenting color or scale"],
    qualityRules: ["Product representation is truthful", "Key details remain visible", "Image system is consistent across the collection"],
    relatedTopics: ["image-quality-rules", "lighting-quality-rules", "visual-quality-evaluation", "content-consistency-evaluation"],
    relatedDomains: ["industry-standards-knowledge", "product-knowledge", "lighting-knowledge", "branding-knowledge", "marketing-knowledge"],
    keywords: ["product photography best practices", "packshot", "product truth", "retouching", "scale"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  practice({
    topicId: "social-media-best-practices",
    name: "Social Media Best Practices",
    description: "Practices for platform-native, useful, consistent, audience-aware social content.",
    professionalDefinition:
      "Social media best practices adapt the message, format, cadence, and community response to the platform while retaining brand and commercial integrity.",
    purpose: "Connect quality guidance to Step 8 platform knowledge without duplicating it.",
    bestPractices: ["Adapt rather than blindly cross-post", "Lead with audience value", "Review responses and performance for learning"],
    commonMistakes: ["Posting without a platform-specific format check", "Using trends that conflict with brand or audience"],
    qualityRules: ["Content is fit for the target platform", "Audience value appears before a disproportionate ask", "Brand and accessibility cues survive the format"],
    relatedTopics: ["marketing-quality-rules", "content-optimization-best-practices", "content-consistency-evaluation", "brand-consistency-evaluation"],
    relatedDomains: REL_COMMERCIAL,
    keywords: ["social media best practices", "platform native", "audience value", "content quality", "community"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  practice({
    topicId: "content-optimization-best-practices",
    name: "Content Optimization Best Practices",
    description: "Evidence-led iteration that improves clarity, discoverability, retention, and conversion ethically.",
    professionalDefinition:
      "Content optimization best practices use measured audience response and quality criteria to improve packaging, structure, accessibility, and relevance without resorting to deceptive tactics.",
    purpose: "Recommend iterative improvements to content performance and quality.",
    bestPractices: ["Test one meaningful variable at a time", "Optimize for audience outcome not vanity metrics", "Preserve truthful claims while improving clarity"],
    commonMistakes: ["Changing everything at once", "Optimizing click-through while destroying retention or trust"],
    qualityRules: ["Optimization changes are measurable", "Audience trust is not traded for short-term metrics", "Winning changes are documented and reused"],
    relatedTopics: ["marketing-effectiveness-evaluation", "social-media-best-practices", "storytelling-quality-rules", "marketing-quality-rules"],
    relatedDomains: REL_COMMERCIAL,
    keywords: ["content optimization", "iteration", "retention", "performance", "testing"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
];

export const PROFESSIONAL_QUALITY_EVALUATION_TOPICS: ProfessionalIsqTopic[] = [
  evaluation({
    topicId: "visual-quality-evaluation",
    name: "Visual Quality Evaluation",
    description: "A structured evaluation of visual clarity, craft, consistency, and audience fitness.",
    professionalDefinition:
      "Visual quality evaluation reviews composition, focus, exposure, color, lighting, detail, hierarchy, and artifacts against the intended output and brand context.",
    purpose: "Let AI Me explain visual review criteria without claiming automated pixel inspection.",
    bestPractices: ["Review at target size and device", "Use side-by-side references", "Separate material defects from stylistic preference"],
    commonMistakes: ["Reviewing only on one display", "Ignoring visual hierarchy"],
    qualityRules: ["Critical subject is clear", "Color and contrast support comprehension", "No material artifacts distract from the message"],
    relatedTopics: ["video-quality-rules", "image-quality-rules", "lighting-quality-rules", "content-consistency-evaluation"],
    relatedDomains: ["industry-standards-knowledge", "lighting-knowledge", "camera-knowledge", "video-production-knowledge", "branding-knowledge"],
    keywords: ["visual quality evaluation", "composition", "color", "contrast", "artifacts"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  evaluation({
    topicId: "audio-quality-evaluation",
    name: "Audio Quality Evaluation",
    description: "A structured evaluation of intelligibility, noise, balance, synchronization, and loudness.",
    professionalDefinition:
      "Audio quality evaluation compares dialogue, music, effects, noise, levels, and synchronization against audience comprehension and delivery requirements.",
    purpose: "Explain professional audio review criteria.",
    bestPractices: ["Listen in more than one playback context", "Check speech under realistic background conditions", "Review transitions and fades"],
    commonMistakes: ["Checking meters but not listening", "Ignoring localized pronunciation or clarity issues"],
    qualityRules: ["Speech is intelligible", "Levels are balanced and stable", "No unintended technical noise or sync error remains"],
    relatedTopics: ["audio-quality-rules", "technical-quality-evaluation", "post-production-checklist", "quality-review-checklist"],
    relatedDomains: ["industry-standards-knowledge", "video-production-knowledge", "video-editing-knowledge", "rendering-knowledge", "social-media-knowledge"],
    keywords: ["audio quality evaluation", "intelligibility", "levels", "sync", "noise"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  evaluation({
    topicId: "story-quality-evaluation",
    name: "Story Quality Evaluation",
    description: "A structured evaluation of message clarity, audience relevance, pacing, and payoff.",
    professionalDefinition:
      "Story quality evaluation assesses whether an audience can follow the premise, progression, stakes, evidence, and intended ending with appropriate pace and emotional logic.",
    purpose: "Help AI Me diagnose narrative quality through professional criteria.",
    bestPractices: ["Test the message in one sentence", "Check each scene or beat has a job", "Validate payoff against the opening promise"],
    commonMistakes: ["Confusing complexity with depth", "Evaluating story only after visual polish"],
    qualityRules: ["Central message is comprehensible", "Structure maintains relevant momentum", "Ending resolves or directs the intended action honestly"],
    relatedTopics: ["storytelling-quality-rules", "editing-quality-rules", "creative-workflows", "quality-review-checklist"],
    relatedDomains: ["industry-standards-knowledge", "storytelling-knowledge", "video-editing-knowledge", "video-production-knowledge", "marketing-knowledge"],
    keywords: ["story quality", "narrative evaluation", "message", "pacing", "payoff"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  evaluation({
    topicId: "technical-quality-evaluation",
    name: "Technical Quality Evaluation",
    description: "A review of format compliance, accessibility, fidelity, integrity, and compatibility.",
    professionalDefinition:
      "Technical quality evaluation verifies whether a finished asset meets agreed specifications and remains usable across the intended platforms, devices, and delivery workflow.",
    purpose: "Give AI Me a technical quality framework rather than a claim of file-level validation.",
    bestPractices: ["Use a delivery specification checklist", "Test representative target environments", "Record exact version and export settings"],
    commonMistakes: ["Assuming source quality equals delivered quality", "Skipping accessibility checks"],
    qualityRules: ["Format, resolution, frame rate, and codec match specification", "Accessibility requirements are addressed", "Final file opens and plays as intended"],
    relatedTopics: ["technical-standards", "rendering-quality-rules", "delivery-standards", "publishing-checklist"],
    relatedDomains: REL_FINISHING,
    keywords: ["technical quality", "specification", "compatibility", "accessibility", "validation"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  evaluation({
    topicId: "marketing-effectiveness-evaluation",
    name: "Marketing Effectiveness Evaluation",
    description: "A review of audience fit, message clarity, proof, action, and meaningful performance signals.",
    professionalDefinition:
      "Marketing effectiveness evaluation checks whether content reaches an appropriate audience with a credible message, relevant proof, and a measurable next action.",
    purpose: "Explain how professionals assess commercial effectiveness without creating advertising automatically.",
    bestPractices: ["Link metrics to funnel objective", "Check claims and proof together", "Evaluate conversion quality, not just volume"],
    commonMistakes: ["Treating impressions as success", "Ignoring audience mismatch"],
    qualityRules: ["Message aligns with an audience need", "Claims are supported by evidence", "CTA is appropriate to audience readiness"],
    relatedTopics: ["marketing-quality-rules", "content-optimization-best-practices", "brand-consistency-evaluation", "social-media-best-practices"],
    relatedDomains: REL_COMMERCIAL,
    keywords: ["marketing effectiveness", "funnel", "audience fit", "conversion", "proof"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  evaluation({
    topicId: "user-experience-evaluation",
    name: "User Experience Evaluation",
    description: "A review of clarity, friction, accessibility, and the audience path through content.",
    professionalDefinition:
      "User experience evaluation considers how a person discovers, understands, navigates, acts on, and recovers from friction in a content or creative experience.",
    purpose: "Connect professional quality to audience usability and comprehension.",
    bestPractices: ["Test first-time understanding", "Make actions and next steps obvious", "Include accessibility and mobile constraints"],
    commonMistakes: ["Optimizing visuals while ignoring task completion", "Hiding essential information in dense copy"],
    qualityRules: ["Primary action and value are understandable", "Critical information is accessible", "Friction is identified before release"],
    relatedTopics: ["content-consistency-evaluation", "marketing-effectiveness-evaluation", "technical-quality-evaluation", "quality-review-checklist"],
    relatedDomains: ["industry-standards-knowledge", "marketing-knowledge", "social-media-knowledge", "branding-knowledge", "product-knowledge"],
    keywords: ["user experience", "usability", "accessibility", "friction", "clarity"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  evaluation({
    topicId: "content-consistency-evaluation",
    name: "Content Consistency Evaluation",
    description: "A review of message, quality, terminology, and craft consistency across assets.",
    professionalDefinition:
      "Content consistency evaluation verifies that a set of outputs tells the same truthful story with coherent terminology, visual quality, quality controls, and delivery standards.",
    purpose: "Recommend cross-asset consistency checks.",
    bestPractices: ["Audit representative assets together", "Use shared terminology and templates", "Track exceptions intentionally"],
    commonMistakes: ["Reviewing assets in isolation", "Allowing outdated claims to survive in old derivatives"],
    qualityRules: ["Core message is consistent across assets", "Quality baseline remains stable", "Exceptions are intentional and documented"],
    relatedTopics: ["brand-consistency-evaluation", "visual-quality-evaluation", "social-media-best-practices", "review-process"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["content consistency", "asset audit", "message consistency", "templates", "governance"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  evaluation({
    topicId: "brand-consistency-evaluation",
    name: "Brand Consistency Evaluation",
    description: "A review of identity, voice, claims, visual cues, and recognizable brand expression.",
    professionalDefinition:
      "Brand consistency evaluation verifies that work follows the documented brand system while adapting intentionally to audience, channel, and format.",
    purpose: "Recommend evidence-based brand quality review.",
    bestPractices: ["Compare against approved brand cues", "Check voice and claims together", "Review platform adaptations, not only master assets"],
    commonMistakes: ["Applying logos without brand meaning", "Treating every channel adaptation as a brand violation"],
    qualityRules: ["Core visual and verbal cues are recognizable", "Claims and tone align with brand promise", "Adaptations are appropriate and intentional"],
    relatedTopics: ["branding-best-practices", "content-consistency-evaluation", "marketing-quality-rules", "quality-review-checklist"],
    relatedDomains: REL_COMMERCIAL,
    keywords: ["brand consistency", "brand evaluation", "voice", "identity", "guidelines"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
];

export const PROFESSIONAL_CHECKLIST_TOPICS: ProfessionalIsqTopic[] = [
  checklist({
    topicId: "pre-production-checklist",
    name: "Pre-production Checklist",
    description: "A checklist for brief, audience, scope, rights, logistics, risk, and technical readiness before production.",
    professionalDefinition:
      "A pre-production checklist is a controlled readiness review ensuring creative intent, people, assets, permissions, schedule, risks, and technical plan are confirmed before execution.",
    purpose: "Give AI Me an actionable pre-production quality-control sequence.",
    bestPractices: ["Confirm objectives and audience", "Lock essential logistics and releases", "Review technical and safety plan"],
    commonMistakes: ["Assuming verbal agreement is enough", "Skipping contingency planning"],
    qualityRules: ["Brief and acceptance criteria are approved", "Rights, permissions, and dependencies are verified", "Technical and safety risks have an owner"],
    workflow: ["Confirm brief and audience", "Confirm assets, talent, permissions", "Confirm schedule and contingency", "Confirm technical plan", "Approve production readiness"],
    professionalExamples: ["Shoot-ready package: approved brief, call sheet, release list, shot plan, backup plan."],
    relatedTopics: ["planning-best-practices", "production-standards", "production-checklist", "quality-assurance"],
    relatedDomains: REL_PRODUCTION,
    keywords: ["pre-production checklist", "brief", "call sheet", "release", "risk"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  checklist({
    topicId: "production-checklist",
    name: "Production Checklist",
    description: "A checklist for on-set technical checks, continuity, safety, capture, and media protection.",
    professionalDefinition:
      "A production checklist is an operational control that verifies capture quality, continuity, safety, communication, and backups throughout a production day.",
    purpose: "Help AI Me recommend production quality controls.",
    bestPractices: ["Run camera, lighting, and audio checks", "Log good takes and continuity", "Verify backups before wrap"],
    commonMistakes: ["Only checking equipment at day start", "Forgetting audio or media verification"],
    qualityRules: ["Critical takes pass technical checks", "Continuity and safety are monitored", "Media backup is verified before wrap"],
    workflow: ["Check equipment and settings", "Confirm scene readiness", "Capture and review critical takes", "Log continuity and media", "Back up and verify before wrap"],
    professionalExamples: ["On-set report including exposure, audio check, take status, continuity notes, and two verified backups."],
    relatedTopics: ["production-best-practices", "camera-quality-rules", "lighting-quality-rules", "audio-quality-rules"],
    relatedDomains: REL_PRODUCTION,
    keywords: ["production checklist", "shoot day", "continuity", "media backup", "technical check"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  checklist({
    topicId: "post-production-checklist",
    name: "Post-production Checklist",
    description: "A checklist for editorial, sound, graphics, color, review versions, and final QC.",
    professionalDefinition:
      "A post-production checklist verifies that an edit is structurally clear, technically clean, legally safe, accessible where required, and ready for final export.",
    purpose: "Provide AI Me a disciplined post-production review route.",
    bestPractices: ["Validate story before finishing", "Check graphics, captions, and sound in context", "Track changes by version"],
    commonMistakes: ["Exporting before approved edit", "Skipping full-playback QC"],
    qualityRules: ["Story, sound, graphics, and continuity pass review", "Final version is traceable", "No critical defects remain before render"],
    workflow: ["Organize and select", "Solve story and pacing", "Finish sound/color/graphics", "Run QC", "Produce approved export"],
    professionalExamples: ["Editorial QC pass: story notes, audio mix check, graphic legibility, caption review, full playback."],
    relatedTopics: ["editing-best-practices", "editing-quality-rules", "audio-quality-rules", "quality-review-checklist"],
    relatedDomains: ["industry-standards-knowledge", "video-editing-knowledge", "rendering-knowledge", "storytelling-knowledge", "video-production-knowledge"],
    keywords: ["post-production checklist", "edit QC", "color", "graphics", "full playback"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  checklist({
    topicId: "publishing-checklist",
    name: "Publishing Checklist",
    description: "A checklist for packaging, platform format, metadata, rights, accessibility, and final playback verification.",
    professionalDefinition:
      "A publishing checklist ensures that a release-ready asset has correct platform derivatives, metadata, accessibility features, rights clearance, and approval before manual publication.",
    purpose: "Teach publishing readiness without publishing content automatically.",
    bestPractices: ["Verify channel-specific dimensions and metadata", "Check captions and links", "Confirm approved final version and publish owner"],
    commonMistakes: ["Using master metadata for every channel", "Publishing an unapproved last-minute export"],
    qualityRules: ["Platform package meets current requirements", "Metadata and links are accurate", "Accessibility and approval controls are complete"],
    workflow: ["Select approved master", "Prepare channel derivative", "Validate metadata and accessibility", "Run playback check", "Hand off for approved manual publication"],
    professionalExamples: ["Release package: approved export, thumbnail, title/description, captions, UTM links, publishing owner."],
    relatedTopics: ["delivery-standards", "rendering-quality-rules", "technical-quality-evaluation", "final-approval-checklist"],
    relatedDomains: ["industry-standards-knowledge", "social-media-knowledge", "marketing-knowledge", "rendering-knowledge", "branding-knowledge"],
    keywords: ["publishing checklist", "metadata", "captions", "platform export", "manual publication"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  checklist({
    topicId: "quality-review-checklist",
    name: "Quality Review Checklist",
    description: "A cross-discipline checklist for creative, technical, brand, audience, and delivery quality.",
    professionalDefinition:
      "A quality review checklist is a consolidated control list that checks the material quality criteria of a deliverable before it advances to final approval.",
    purpose: "Give AI Me a universal professional review guide.",
    bestPractices: ["Review in the intended context", "Use specialist checks for high-risk areas", "Record pass, fail, and exception evidence"],
    commonMistakes: ["One person reviewing everything without criteria", "Treating minor preferences as blocking defects"],
    qualityRules: ["Creative, technical, and commercial criteria are checked", "Critical defects are resolved or formally accepted", "Review outcome is recorded"],
    workflow: ["Set review scope", "Check creative and audience criteria", "Check technical and delivery criteria", "Record defects", "Confirm resolution or escalation"],
    professionalExamples: ["Final QC grid covering visual, audio, story, brand, claims, platform, and file integrity."],
    relatedTopics: ["quality-assurance", "review-process", "visual-quality-evaluation", "final-approval-checklist"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["quality review checklist", "QC", "acceptance criteria", "defects", "review gate"],
    confidenceScore: 95,
    qualityScore: 94,
  }),
  checklist({
    topicId: "final-approval-checklist",
    name: "Final Approval Checklist",
    description: "A checklist proving a specific final version has cleared required quality, rights, and delivery gates.",
    professionalDefinition:
      "A final approval checklist records that the accountable approver has reviewed the exact final version against agreed quality, legal, brand, and delivery requirements.",
    purpose: "Guide controlled sign-off without performing certification.",
    bestPractices: ["Identify exact version and destination", "Attach review evidence", "List accepted exceptions explicitly"],
    commonMistakes: ["Approving a file name rather than an exact version", "Sign-off before final encode verification"],
    qualityRules: ["Final version is uniquely identified", "All blocking criteria pass or are formally accepted", "Approval and delivery evidence are retained"],
    workflow: ["Confirm final version", "Confirm review results", "Confirm technical/delivery verification", "Record approver decision", "Archive approval evidence"],
    professionalExamples: ["Sign-off record with final checksum/version, approver, review date, exceptions, and destination."],
    relatedTopics: ["approval-process", "quality-review-checklist", "delivery-standards", "publishing-checklist"],
    relatedDomains: REL_FOUNDATION,
    keywords: ["final approval checklist", "sign-off", "approval evidence", "version", "delivery"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
];

export const ISQ_DOMAIN_BRIDGES: IsqDomainBridge[] = [
  {
    domainId: "industry-standards-knowledge",
    knowledgeId: "isq-bridge-industry-standards-knowledge",
    title: "Industry Standards & Quality Domain",
    description: "Hub for Step 9 industry standards, quality rules, best practices, evaluations, and checklists.",
    relationshipEvidence: "Primary domain for professional quality guidance.",
  },
  {
    domainId: "video-production-knowledge",
    knowledgeId: "isq-bridge-video-production-knowledge",
    title: "Video Production Knowledge (related)",
    description: "Production standards apply quality controls to video work.",
    relationshipEvidence: "Professional standards govern production planning and delivery.",
  },
  {
    domainId: "camera-knowledge",
    knowledgeId: "isq-bridge-camera-knowledge",
    title: "Camera Knowledge (related)",
    description: "Camera quality rules govern capture readiness.",
    relationshipEvidence: "Focus, exposure, and framing are measurable quality controls.",
  },
  {
    domainId: "lighting-knowledge",
    knowledgeId: "isq-bridge-lighting-knowledge",
    title: "Lighting Knowledge (related)",
    description: "Lighting quality rules protect subject visibility and continuity.",
    relationshipEvidence: "Lighting controls affect visual quality and product truth.",
  },
  {
    domainId: "storytelling-knowledge",
    knowledgeId: "isq-bridge-storytelling-knowledge",
    title: "Storytelling Knowledge (related)",
    description: "Story quality rules evaluate narrative clarity and payoff.",
    relationshipEvidence: "Narrative structure is reviewed against audience comprehension.",
  },
  {
    domainId: "animation-knowledge",
    knowledgeId: "isq-bridge-animation-knowledge",
    title: "Animation Knowledge (related)",
    description: "Motion and animation are reviewed for clarity and consistency.",
    relationshipEvidence: "Animation quality contributes to visual and technical readiness.",
  },
  {
    domainId: "rendering-knowledge",
    knowledgeId: "isq-bridge-rendering-knowledge",
    title: "Rendering Knowledge (related)",
    description: "Render quality rules govern final encoded output.",
    relationshipEvidence: "Technical delivery quality depends on correct rendering.",
  },
  {
    domainId: "video-editing-knowledge",
    knowledgeId: "isq-bridge-video-editing-knowledge",
    title: "Video Editing Knowledge (related)",
    description: "Editing quality rules cover pace, continuity, audio, and graphics.",
    relationshipEvidence: "Editorial craft is evaluated before delivery.",
  },
  {
    domainId: "marketing-knowledge",
    knowledgeId: "isq-bridge-marketing-knowledge",
    title: "Marketing Knowledge (related)",
    description: "Marketing quality rules ensure credible, audience-relevant communication.",
    relationshipEvidence: "Commercial effectiveness is a professional quality criterion.",
  },
  {
    domainId: "social-media-knowledge",
    knowledgeId: "isq-bridge-social-media-knowledge",
    title: "Social Media Knowledge (related)",
    description: "Social content quality adapts standards to platform context.",
    relationshipEvidence: "Platform formats require professional quality checks.",
  },
  {
    domainId: "branding-knowledge",
    knowledgeId: "isq-bridge-branding-knowledge",
    title: "Branding Knowledge (related)",
    description: "Brand consistency is an explicit professional quality criterion.",
    relationshipEvidence: "Identity, voice, and claims are reviewed across assets.",
  },
  {
    domainId: "product-knowledge",
    knowledgeId: "isq-bridge-product-knowledge",
    title: "Product Photography / Product Knowledge (related)",
    description: "Product quality guidance requires truthful product representation.",
    relationshipEvidence: "Professional product presentation preserves product truth.",
  },
];

export const REQUIRED_PROFESSIONAL_STANDARDS_TOPIC_IDS: ProfessionalStandardsTopicId[] =
  PROFESSIONAL_STANDARDS_TOPICS.map((topic) => topic.topicId as ProfessionalStandardsTopicId);
export const REQUIRED_QUALITY_RULES_TOPIC_IDS: QualityRulesTopicId[] = PROFESSIONAL_QUALITY_RULES_TOPICS.map(
  (topic) => topic.topicId as QualityRulesTopicId
);
export const REQUIRED_BEST_PRACTICES_TOPIC_IDS: ProfessionalBestPracticesTopicId[] =
  PROFESSIONAL_BEST_PRACTICES_TOPICS.map((topic) => topic.topicId as ProfessionalBestPracticesTopicId);
export const REQUIRED_QUALITY_EVALUATION_TOPIC_IDS: QualityEvaluationTopicId[] = PROFESSIONAL_QUALITY_EVALUATION_TOPICS.map(
  (topic) => topic.topicId as QualityEvaluationTopicId
);
export const REQUIRED_PROFESSIONAL_CHECKLIST_TOPIC_IDS: ProfessionalChecklistTopicId[] =
  PROFESSIONAL_CHECKLIST_TOPICS.map((topic) => topic.topicId as ProfessionalChecklistTopicId);

export function getAllIsqTopics(): ProfessionalIsqTopic[] {
  return [
    ...PROFESSIONAL_STANDARDS_TOPICS,
    ...PROFESSIONAL_QUALITY_RULES_TOPICS,
    ...PROFESSIONAL_BEST_PRACTICES_TOPICS,
    ...PROFESSIONAL_QUALITY_EVALUATION_TOPICS,
    ...PROFESSIONAL_CHECKLIST_TOPICS,
  ];
}

export function getIsqTopic(topicId: string): ProfessionalIsqTopic | undefined {
  return getAllIsqTopics().find((topic) => topic.topicId === topicId || topic.knowledgeId === topicId);
}

export function findIsqTopics(query: string, pool: ProfessionalIsqTopic[] = getAllIsqTopics()): ProfessionalIsqTopic[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((token) => token.length > 1);
  if (!tokens.length) return [];

  return pool
    .map((topic) => {
      const haystack = `${topic.name} ${topic.description} ${topic.keywords.join(" ")} ${topic.topicId}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 2;
        if (topic.topicId.includes(token)) score += 3;
        if (topic.name.toLowerCase().includes(token)) score += 2;
      }
      return { topic, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.topic.confidenceScore - a.topic.confidenceScore)
    .map((result) => result.topic);
}

/** Catalog self-check for incomplete relationships before the installer persists anything. */
export function checkIsqCatalogRelationships(): { topicCount: number; broken: string[] } {
  const all = getAllIsqTopics();
  const topicIds = new Set(all.map((topic) => topic.topicId));
  const bridgeDomains = new Set(ISQ_DOMAIN_BRIDGES.map((bridge) => bridge.domainId));
  const broken: string[] = [];

  for (const topic of all) {
    for (const related of topic.relatedTopics) {
      if (related === topic.topicId || !topicIds.has(related)) broken.push(`${topic.topicId}→${related}`);
    }
    for (const domainId of topic.relatedDomains) {
      if (!bridgeDomains.has(domainId)) broken.push(`${topic.topicId}→bridge:${domainId}`);
    }
  }
  return { topicCount: all.length, broken };
}
