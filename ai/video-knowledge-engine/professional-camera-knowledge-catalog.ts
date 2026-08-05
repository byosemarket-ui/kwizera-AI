/**
 * Curated Professional Camera & Camera Movement Knowledge catalog (Expansion Step 2).
 */

import {
  CAMERA_DOMAIN_ID,
  CAMERA_MOVEMENT_DOMAIN_ID,
  PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
  type CameraDomainBridge,
  type CameraMovementTopicId,
  type CameraSettingTopicId,
  type ProfessionalCameraMovementTopic,
  type ProfessionalCameraSettingTopic,
} from "./professional-camera-knowledge-types.js";

function setting(
  partial: Omit<ProfessionalCameraSettingTopic, "knowledgeId" | "metadata"> & { knowledgeId?: string }
): ProfessionalCameraSettingTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `cam-${partial.topicId}`,
    metadata: {
      domainId: CAMERA_DOMAIN_ID,
      category: "professional-camera-settings",
      difficulty: partial.confidenceScore >= 90 ? "advanced" : partial.confidenceScore >= 84 ? "intermediate" : "foundation",
      expansionStep: 2,
      version: PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
      learningOnly: true,
      generatesVideo: false,
    },
  };
}

function movement(
  partial: Omit<ProfessionalCameraMovementTopic, "knowledgeId" | "title" | "metadata"> & {
    knowledgeId?: string;
    title?: string;
  }
): ProfessionalCameraMovementTopic {
  return {
    ...partial,
    knowledgeId: partial.knowledgeId ?? `cmov-${partial.topicId}`,
    title: partial.title ?? partial.name,
    metadata: {
      domainId: CAMERA_MOVEMENT_DOMAIN_ID,
      category: "professional-camera-movement",
      difficulty: partial.confidenceScore >= 90 ? "advanced" : partial.confidenceScore >= 84 ? "intermediate" : "foundation",
      expansionStep: 2,
      version: PROFESSIONAL_CAMERA_KNOWLEDGE_VERSION,
      learningOnly: true,
      generatesVideo: false,
    },
  };
}

export const PROFESSIONAL_CAMERA_SETTING_TOPICS: ProfessionalCameraSettingTopic[] = [
  setting({
    topicId: "camera-fundamentals",
    title: "Camera Fundamentals",
    description: "Core principles of how a camera captures light, forms an image, and supports storytelling intent.",
    professionalDefinition:
      "Camera fundamentals cover the imaging chain—optics, sensor, exposure triangle, framing, and capture settings—so every technical choice serves story, brand, and delivery.",
    bestPractices: [
      "Decide look and deliverable specs before locking camera body and lens kit.",
      "Treat exposure, focus, and white balance as a linked system, not isolated dials.",
      "Match camera setup to movement plan and lighting plan.",
      "Document camera notes for continuity across setups.",
    ],
    commonMistakes: [
      "Choosing gear before defining story and delivery.",
      "Changing too many settings between takes without a reason.",
      "Ignoring how settings constrain later movement and edit options.",
    ],
    professionalWorkflow: [
      "Confirm deliverable resolution, frame rate, and aspect ratio.",
      "Select body, lens, and support for the planned moves.",
      "Set baseline exposure and white balance under production lighting.",
      "Verify focus and framing with a rehearsal take.",
    ],
    examples: [
      "Product tabletop: locked camera, controlled light, manual exposure.",
      "Interview: medium framing, shallow DOF, stable support, consistent WB.",
    ],
    decisionRules: [
      "If story intent is unclear, do not finalize camera package.",
      "Always lock delivery specs before creative camera experiments.",
      "When lighting changes, re-check exposure and white balance together.",
      "Never leave critical focus to chance on hero product or talent eyes.",
    ],
    relatedTopics: ["exposure", "lens-types", "focus", "camera-types"],
    relatedDomains: ["camera-knowledge", "video-production-knowledge", "lighting-knowledge", "composition-knowledge"],
    keywords: ["camera", "fundamentals", "exposure triangle", "framing", "capture"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  setting({
    topicId: "camera-types",
    title: "Camera Types",
    description: "Professional camera classes and when each class fits commercial and narrative production.",
    professionalDefinition:
      "Camera types are body classes—cinema, mirrorless/hybrid, camcorder, smartphone, specialty—selected by image quality needs, lens ecosystem, form factor, and production constraints.",
    bestPractices: [
      "Match body class to lens needs, codec, and operator mobility.",
      "Prefer a known color/codec pipeline over novelty features.",
      "Plan media, power, and monitoring for the chosen body.",
      "Keep a backup body with compatible media when schedule is critical.",
    ],
    commonMistakes: [
      "Overbuying cinema bodies for simple social content.",
      "Using phones for hero product without lighting/lens control.",
      "Mixing incompatible codec families across a campaign without a grade plan.",
    ],
    professionalWorkflow: [
      "List image and mobility requirements.",
      "Shortlist body classes that meet codec and lens needs.",
      "Validate support gear and monitoring.",
      "Lock primary and backup body package.",
    ],
    examples: [
      "Cinema camera for controlled commercial with anamorphic look.",
      "Hybrid mirrorless for run-and-gun corporate B-roll with gimbals.",
    ],
    decisionRules: [
      "If mobility dominates, prefer lighter hybrid or gimbal-ready bodies.",
      "Always confirm lens coverage for the sensor format.",
      "When brand color consistency is critical, standardize one pipeline.",
      "Never choose a camera type that cannot meet delivery resolution.",
    ],
    relatedTopics: ["camera-sensors", "camera-resolution", "lens-types", "camera-fundamentals"],
    relatedDomains: ["camera-knowledge", "video-production-knowledge", "rendering-knowledge"],
    keywords: ["camera types", "cinema camera", "mirrorless", "hybrid", "camcorder"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  setting({
    topicId: "camera-sensors",
    title: "Camera Sensors",
    description: "How sensor size, crop factor, and sensitivity affect field of view, depth of field, and low-light performance.",
    professionalDefinition:
      "A camera sensor converts optical image to digital signal; its size and design control field of view, depth of field behavior, dynamic range, and noise characteristics.",
    bestPractices: [
      "Account for crop factor when planning focal length and framing.",
      "Use sensor strengths (DR, low light) to support lighting strategy.",
      "Keep ISO within the sensor's clean range for hero shots.",
      "Match sensor format across multi-cam when possible.",
    ],
    commonMistakes: [
      "Assuming full-frame depth of field on a smaller sensor with the same f-number and framing.",
      "Pushing ISO past usable noise for close-up product texture.",
      "Ignoring rolling shutter limits for fast pans.",
    ],
    professionalWorkflow: [
      "Identify sensor format and crop.",
      "Translate desired FOV into real focal lengths.",
      "Set base ISO strategy for lighting.",
      "Test motion artifacts if fast moves are planned.",
    ],
    examples: [
      "Super 35 commercial package with cinema primes.",
      "Full-frame interview for shallower background separation.",
    ],
    decisionRules: [
      "If FOV must match a reference, convert focal length for sensor crop.",
      "Always keep hero product texture within clean ISO limits.",
      "When fast lateral moves are required, evaluate rolling shutter risk.",
      "Never mix sensor formats in multi-cam without framing and grade checks.",
    ],
    relatedTopics: ["focal-length", "depth-of-field", "iso", "camera-types"],
    relatedDomains: ["camera-knowledge", "lighting-knowledge", "composition-knowledge"],
    keywords: ["sensor", "full frame", "super 35", "crop factor", "dynamic range"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  setting({
    topicId: "camera-resolution",
    title: "Camera Resolution",
    description: "Capture resolution choices relative to delivery, reframing, and finishing quality.",
    professionalDefinition:
      "Camera resolution is the pixel count captured; professionals select it to protect delivery specs, allow reframing, and balance data rate with finishing needs.",
    bestPractices: [
      "Capture at or above delivery resolution with headroom for reframing when useful.",
      "Do not oversample blindly if storage, heat, or rolling shutter suffer.",
      "Align resolution with intended crop for vertical cutdowns.",
      "Confirm monitoring resolution matches critical focus needs.",
    ],
    commonMistakes: [
      "Shooting 4K for a 1080 delivery without a reframing plan and paying unnecessary cost.",
      "Undersampling and trying to invent detail in post.",
      "Ignoring pixel pitch/noise tradeoffs at high resolution + high ISO.",
    ],
    professionalWorkflow: [
      "List master and cutdown delivery resolutions.",
      "Choose capture resolution with intentional oversample margin.",
      "Validate codec bitrate for that resolution.",
      "Plan vertical/safe crops if needed.",
    ],
    examples: [
      "4K capture for 1080 master plus vertical social crop.",
      "6K open-gate for anamorphic-style reframing in a commercial.",
    ],
    decisionRules: [
      "If vertical cutdowns are required, capture with crop margin or dual framing.",
      "Always meet the highest contracted delivery resolution.",
      "When heat or media limits threaten the day, reduce resolution before reducing story coverage.",
      "Never deliver upscaled soft footage as a substitute for planned resolution.",
    ],
    relatedTopics: ["aspect-ratio", "frame-rate", "camera-types", "camera-sensors"],
    relatedDomains: ["camera-knowledge", "rendering-knowledge", "video-production-knowledge"],
    keywords: ["resolution", "4K", "1080", "oversample", "reframe"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  setting({
    topicId: "frame-rate",
    title: "Frame Rate",
    description: "Selecting and maintaining frame rates for natural motion, slow motion, and platform norms.",
    professionalDefinition:
      "Frame rate is the number of frames captured per second; it governs motion cadence, slow-motion capability, and compatibility with editing and delivery standards.",
    bestPractices: [
      "Lock project frame rate early and keep camera timebase consistent.",
      "Shoot higher rates only when slow motion is planned and lit for it.",
      "Match shutter relative to frame rate for natural motion blur.",
      "Document any mixed-rate shots for editorial.",
    ],
    commonMistakes: [
      "Mixing 24 and 30 fps without a conversion plan.",
      "Shooting slow-mo underexposed because light was set for 24 fps.",
      "Ignoring platform expectations (e.g., social vs cinematic cadence).",
    ],
    professionalWorkflow: [
      "Choose story cadence (cinematic vs broadcast/social).",
      "Set camera and project frame rate.",
      "Plan high-speed shots and lighting compensation.",
      "Confirm editorial conform path.",
    ],
    examples: [
      "24 fps commercial with 120 fps product pour slow-mo inserts.",
      "30 fps corporate explainer for web delivery.",
    ],
    decisionRules: [
      "If slow motion is required, increase light or ISO budget before rolling high frame rate.",
      "Always keep primary dialogue scenes at one consistent rate.",
      "When platforms differ, prefer separate masters over awkward speed changes.",
      "Never change frame rate mid-scene without editorial approval.",
    ],
    relatedTopics: ["shutter-speed", "exposure", "camera-resolution", "camera-fundamentals"],
    relatedDomains: ["camera-knowledge", "video-editing-knowledge", "video-production-knowledge"],
    keywords: ["frame rate", "fps", "24fps", "slow motion", "timebase"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  setting({
    topicId: "aspect-ratio",
    title: "Aspect Ratio",
    description: "Framing proportions for cinematic, social, and multi-platform delivery.",
    professionalDefinition:
      "Aspect ratio is the width-to-height proportion of the image; it shapes composition, safe areas, and how content adapts across screens.",
    bestPractices: [
      "Design composition for the primary aspect ratio first.",
      "Protect title-safe and UI-safe areas for social overlays.",
      "Plan dual-aspect coverage when both horizontal and vertical deliverables are required.",
      "Keep product and faces inside common crop zones.",
    ],
    commonMistakes: [
      "Composing only for 16:9 then crushing into 9:16.",
      "Placing CTAs in unsafe edges.",
      "Changing aspect mid-campaign without re-composition.",
    ],
    professionalWorkflow: [
      "Confirm primary and secondary aspect ratios.",
      "Mark safe frames on monitor.",
      "Compose and shoot to protected zones.",
      "Validate crops in editorial proxies.",
    ],
    examples: [
      "16:9 brand film with 9:16 cutdown framed on set.",
      "1:1 product loop for feed placements.",
    ],
    decisionRules: [
      "If dual delivery is required, compose to the intersection of safe areas.",
      "Always keep logos and faces inside the strictest crop.",
      "When aspect conflicts with style, redesign framing rather than letterbox as a fix-all.",
      "Never discover vertical crop problems only at export.",
    ],
    relatedTopics: ["camera-resolution", "composition-knowledge" as CameraSettingTopicId, "camera-fundamentals", "lens-types"],
    relatedDomains: ["camera-knowledge", "composition-knowledge", "video-production-knowledge", "rendering-knowledge"],
    keywords: ["aspect ratio", "16:9", "9:16", "safe frame", "crop"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  setting({
    topicId: "lens-types",
    title: "Lens Types",
    description: "Prime, zoom, macro, anamorphic, and specialty lenses for professional production.",
    professionalDefinition:
      "Lens types define optical behavior—focal length range, distortion, bokeh, and close-focus—selected to match story distance, movement, and product detail needs.",
    bestPractices: [
      "Prefer primes for critical product sharpness and consistent look.",
      "Use zooms when reframing speed matters more than absolute optical purity.",
      "Match lens character across a scene for continuity.",
      "Test close-focus and breathing before hero macro work.",
    ],
    commonMistakes: [
      "Zooming during a take when a dolly was intended.",
      "Mixing wildly different lens coatings in one dialogue scene.",
      "Using wide lenses too close to faces without intention.",
    ],
    professionalWorkflow: [
      "Map scene distances to required focal lengths.",
      "Select primes/zooms/macros for coverage.",
      "Check focus throw and breathing for moves.",
      "Lock filtration and look consistency.",
    ],
    examples: [
      "85mm-class interview lens for flattering separation.",
      "Macro lens for texture inserts on packaging.",
    ],
    decisionRules: [
      "If subject distance is fixed and look must be consistent, prefer a prime.",
      "Always test facial distortion before committing to ultra-wide close-ups.",
      "When product detail is the story, prioritize macro capability over zoom convenience.",
      "Never change lens mid-setup without checking exposure and framing continuity.",
    ],
    relatedTopics: ["focal-length", "aperture", "depth-of-field", "focus"],
    relatedDomains: ["camera-knowledge", "composition-knowledge", "video-production-knowledge"],
    keywords: ["lens", "prime", "zoom", "macro", "anamorphic"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  setting({
    topicId: "focal-length",
    title: "Focal Length",
    description: "How focal length controls field of view, perspective compression, and storytelling distance.",
    professionalDefinition:
      "Focal length is the optical distance that determines field of view and perspective; professionals choose it to control subject size, background compression, and viewer intimacy.",
    bestPractices: [
      "Choose focal length for perspective, not only for framing tightness.",
      "Keep dialogue coverage on complementary focal lengths for continuity.",
      "Use longer lenses to isolate product heroes; wider lenses to establish space.",
      "Account for sensor crop when translating reference looks.",
    ],
    commonMistakes: [
      "Walking into a wide lens instead of changing focal length intentionally.",
      "Jumping focal lengths between matching angles without motivation.",
      "Ignoring how long lenses affect camera move feel.",
    ],
    professionalWorkflow: [
      "Define desired perspective and subject size.",
      "Select focal length for master and coverage.",
      "Confirm background compression and distortion.",
      "Note focal lengths on the shot list.",
    ],
    examples: [
      "24–35mm establishing environment; 85–135mm product isolation.",
      "50mm-class conversational coverage for natural perspective.",
    ],
    decisionRules: [
      "If intimacy is the goal, prefer longer or closer framing with controlled perspective.",
      "Always keep matching shots within a coherent focal-length family.",
      "When space is tight, change lens before distorting talent with extreme wide close-ups.",
      "Never treat focal length as interchangeable with digital zoom.",
    ],
    relatedTopics: ["lens-types", "camera-sensors", "depth-of-field", "composition-knowledge" as CameraSettingTopicId],
    relatedDomains: ["camera-knowledge", "composition-knowledge", "storytelling-knowledge"],
    keywords: ["focal length", "FOV", "perspective", "compression", "mm"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  setting({
    topicId: "aperture",
    title: "Aperture",
    description: "Controlling light intake and depth of field with iris/f-stop choices.",
    professionalDefinition:
      "Aperture is the iris opening that regulates light and depth of field; it is a primary creative and exposure control in professional camera operation.",
    bestPractices: [
      "Choose aperture for depth-of-field intent, then balance ISO/shutter.",
      "Avoid the extremes of a lens unless the look is intentional and sharp enough.",
      "Keep dialogue coverage apertures consistent when matching eye focus.",
      "Watch diffraction softness at very small apertures.",
    ],
    commonMistakes: [
      "Opening wide for 'cinematic' look then missing focus on eyes.",
      "Stopping down without adjusting lighting/ISO plan.",
      "Inconsistent T-stops across multi-cam.",
    ],
    professionalWorkflow: [
      "Decide DOF target for the scene.",
      "Set aperture (T-stop) accordingly.",
      "Balance exposure with ISO and shutter.",
      "Confirm critical focus at that aperture.",
    ],
    examples: [
      "Wide aperture product hero with soft background.",
      "Stopped-down tabletop for edge-to-edge packaging sharpness.",
    ],
    decisionRules: [
      "If focus reliability is at risk, deepen DOF before blaming the operator.",
      "Always match apertures on intercut coverage unless motivated.",
      "When lighting is limited, open aperture before dirtying ISO past limits.",
      "Never chase bokeh at the expense of readable product text.",
    ],
    relatedTopics: ["depth-of-field", "exposure", "iso", "focus"],
    relatedDomains: ["camera-knowledge", "lighting-knowledge", "composition-knowledge"],
    keywords: ["aperture", "f-stop", "t-stop", "iris", "bokeh"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  setting({
    topicId: "iso",
    title: "ISO",
    description: "Sensor sensitivity management for clean images and controlled noise.",
    professionalDefinition:
      "ISO sets the camera's sensitivity to light; professionals use it to finish exposure after aperture and shutter priorities while staying inside clean native ranges.",
    bestPractices: [
      "Prefer native/base ISO ranges for hero imagery.",
      "Raise ISO only after aperture and lighting options are exhausted (or intentionally).",
      "Keep ISO consistent across a scene when possible.",
      "Evaluate noise on the actual delivery size, not only the monitor.",
    ],
    commonMistakes: [
      "Riding ISO shot-to-shot creating flicker in grade.",
      "Crushing shadows in camera then lifting noisy ISO in post.",
      "Ignoring dual-native ISO switch points.",
    ],
    professionalWorkflow: [
      "Identify native ISO and dual-native points.",
      "Set lighting and aperture/shutter first.",
      "Dial ISO to finish exposure.",
      "Spot-check noise on critical textures.",
    ],
    examples: [
      "Base ISO for lit commercial tabletop.",
      "Second native ISO for dim interview with controlled noise.",
    ],
    decisionRules: [
      "If noise threatens product texture, add light before raising ISO.",
      "Always note ISO on camera reports for continuity.",
      "When dual-native exists, jump intentionally—do not linger in noisy midpoints.",
      "Never 'fix exposure with ISO' as a substitute for lighting design.",
    ],
    relatedTopics: ["exposure", "aperture", "shutter-speed", "camera-sensors"],
    relatedDomains: ["camera-knowledge", "lighting-knowledge", "rendering-knowledge"],
    keywords: ["ISO", "sensitivity", "noise", "native ISO", "exposure"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  setting({
    topicId: "shutter-speed",
    title: "Shutter Speed",
    description: "Motion blur control via shutter angle/speed relative to frame rate.",
    professionalDefinition:
      "Shutter speed (or shutter angle) determines how long each frame is exposed, controlling motion blur and contributing to overall exposure.",
    bestPractices: [
      "Start from a 180-degree shutter rule for natural motion (e.g., 1/48 at 24 fps).",
      "Tighten shutter for crisp sports-like action only when stylistically intended.",
      "Loosen shutter for dreamy blur only with purpose.",
      "Recalculate shutter whenever frame rate changes.",
    ],
    commonMistakes: [
      "Leaving shutter at still-photo defaults that stutter motion.",
      "Changing shutter for exposure instead of adjusting light/ISO/ND.",
      "Ignoring flicker from lights at certain shutter/frequency combinations.",
    ],
    professionalWorkflow: [
      "Set frame rate.",
      "Choose shutter for desired motion blur.",
      "Balance exposure with ND, aperture, ISO, and light.",
      "Check flicker under practicals/LEDs.",
    ],
    examples: [
      "1/48–1/50 at 24 fps for cinematic commercial motion.",
      "Higher shutter for sharp water splash inserts with intentional staccato.",
    ],
    decisionRules: [
      "If motion looks strobey, lengthen shutter toward 180-degree equivalent.",
      "Always adjust ND/light before breaking shutter intent for exposure.",
      "When lights flicker, change shutter or light frequency relationship.",
      "Never forget to update shutter after a frame-rate change.",
    ],
    relatedTopics: ["frame-rate", "exposure", "iso", "aperture"],
    relatedDomains: ["camera-knowledge", "lighting-knowledge", "video-editing-knowledge"],
    keywords: ["shutter speed", "shutter angle", "motion blur", "180 degree", "flicker"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  setting({
    topicId: "white-balance",
    title: "White Balance",
    description: "Color temperature and tint control for accurate, consistent skin and product color.",
    professionalDefinition:
      "White balance aligns the camera's interpretation of white to the lighting color temperature so colors remain accurate and consistent across shots.",
    bestPractices: [
      "Set white balance for the dominant light source and keep it locked per setup.",
      "Use custom WB or known Kelvin when brand colors matter.",
      "Avoid auto white balance for intercut professional coverage.",
      "Match WB across cameras before rolling multi-cam.",
    ],
    commonMistakes: [
      "Auto WB drifting between takes.",
      "Correcting mixed lighting only in grade instead of on set.",
      "Mismatched Kelvin between A and B cameras.",
    ],
    professionalWorkflow: [
      "Identify key light color temperature.",
      "Set Kelvin/tint or custom WB.",
      "Lock WB for the setup.",
      "Verify product and skin on calibrated monitor.",
    ],
    examples: [
      "5600K daylight kit for clean product whites.",
      "Custom WB under mixed practicals for interview consistency.",
    ],
    decisionRules: [
      "If brand color accuracy is required, prefer custom/manual WB over auto.",
      "Always match multi-cam white balance before coverage.",
      "When lights change color, re-balance before continuing.",
      "Never rely on aggressive grade to fix preventable WB mismatch.",
    ],
    relatedTopics: ["exposure", "camera-fundamentals", "iso", "camera-types"],
    relatedDomains: ["camera-knowledge", "lighting-knowledge", "rendering-knowledge"],
    keywords: ["white balance", "Kelvin", "color temperature", "tint", "AWB"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  setting({
    topicId: "focus",
    title: "Focus",
    description: "Critical focus technique for talent, product, and moving subjects.",
    professionalDefinition:
      "Focus is the optical plane of sharpness; professional focus practice keeps story-critical subjects sharp through marks, peaking, monitors, and planned rack focus.",
    bestPractices: [
      "Focus on eyes for interviews and faces; on logo/detail for products.",
      "Use marks and measured distances for rehearsed moves.",
      "Confirm critical focus on a large monitor, not only peaking.",
      "Plan rack focuses as storytelling beats, not accidents.",
    ],
    commonMistakes: [
      "Trusting autofocus blindly in shallow DOF commercials.",
      "Missing focus after a camera move without a follow-focus plan.",
      "Rack focusing without narrative motivation.",
    ],
    professionalWorkflow: [
      "Identify critical focus subject per shot.",
      "Set marks and focus strategy (manual/AF/hybrid).",
      "Rehearse move with focus pull.",
      "Verify takes on playback for soft frames.",
    ],
    examples: [
      "Follow-focus pull from packaging to talent smile.",
      "Locked product focus with stopped-down aperture for text readability.",
    ],
    decisionRules: [
      "If DOF is razor thin, assign a focus puller or deepen aperture.",
      "Always prioritize eyes/logos over background highlights.",
      "When subjects move toward camera, pre-plan focus travel.",
      "Never call a take good without checking critical focus on playback.",
    ],
    relatedTopics: ["depth-of-field", "aperture", "lens-types", "focal-length"],
    relatedDomains: ["camera-knowledge", "camera-movement-knowledge", "storytelling-knowledge"],
    keywords: ["focus", "follow focus", "rack focus", "peaking", "critical focus"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  setting({
    topicId: "depth-of-field",
    title: "Depth of Field",
    description: "Controlling the sharp range through aperture, distance, focal length, and sensor size.",
    professionalDefinition:
      "Depth of field is the distance range that appears acceptably sharp; it is shaped by aperture, subject distance, focal length, and sensor format.",
    bestPractices: [
      "Choose DOF to direct attention, not as a default style filter.",
      "Deepen DOF for readable packaging and multi-subject sharpness.",
      "Use shallow DOF to isolate heroes after geography is established.",
      "Coordinate DOF with lighting so exposure remains clean.",
    ],
    commonMistakes: [
      "Ultra-shallow DOF making product text illegible.",
      "Inconsistent DOF across matching coverage.",
      "Ignoring how longer lenses and closer distances thin DOF.",
    ],
    professionalWorkflow: [
      "Decide attention target and required sharp range.",
      "Set aperture, distance, and focal length accordingly.",
      "Confirm with focus chart or real subject detail.",
      "Balance exposure with light/ISO/ND.",
    ],
    examples: [
      "Shallow DOF beauty hero; deep DOF instructional demo of buttons.",
      "Group interview stopped down for multiple faces sharp.",
    ],
    decisionRules: [
      "If text or UI must be read, prioritize deeper DOF.",
      "Always establish space before relying on extreme isolation.",
      "When focus misses increase, deepen DOF before adding takes.",
      "Never treat shallow DOF as a substitute for composition and lighting.",
    ],
    relatedTopics: ["aperture", "focal-length", "focus", "camera-sensors"],
    relatedDomains: ["camera-knowledge", "composition-knowledge", "lighting-knowledge"],
    keywords: ["depth of field", "DOF", "bokeh", "sharp range", "isolation"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  setting({
    topicId: "exposure",
    title: "Exposure",
    description: "Balancing aperture, shutter, ISO, and lighting/ND for correct, intentional brightness.",
    professionalDefinition:
      "Exposure is the total light recorded per frame; professionals balance aperture, shutter, ISO, ND, and lighting to protect highlights, shadows, and skin/product detail.",
    bestPractices: [
      "Expose for the most important highlight/skin/product detail.",
      "Use false color/waveform when available; do not trust uncalibrated LCDs alone.",
      "Prefer lighting and ND changes over breaking shutter or dirty ISO.",
      "Keep exposure continuity across coverage.",
    ],
    commonMistakes: [
      "Clipping brand whites or specular product highlights.",
      "Underexposing and lifting noise in post.",
      "Changing brightness between matching angles.",
    ],
    professionalWorkflow: [
      "Set shutter for motion, aperture for DOF.",
      "Shape light and ND for target brightness.",
      "Finish with ISO in clean range.",
      "Verify on scopes and lock for the setup.",
    ],
    examples: [
      "Product chrome controlled with flags and precise key exposure.",
      "Interview exposed for faces with protected window highlights.",
    ],
    decisionRules: [
      "If highlights that matter clip, reduce light/exposure before grading hopes.",
      "Always maintain exposure continuity for intercut shots.",
      "When DOF and shutter are locked, use light/ND/ISO to finish exposure.",
      "Never call exposure 'fixable' if critical detail is gone.",
    ],
    relatedTopics: ["aperture", "shutter-speed", "iso", "white-balance"],
    relatedDomains: ["camera-knowledge", "lighting-knowledge", "rendering-knowledge"],
    keywords: ["exposure", "waveform", "false color", "ND", "highlights"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
];

// Fix invalid relatedTopics that incorrectly cast composition-knowledge
for (const topic of PROFESSIONAL_CAMERA_SETTING_TOPICS) {
  topic.relatedTopics = topic.relatedTopics.filter(
    (id) => id !== ("composition-knowledge" as CameraSettingTopicId)
  ) as Array<CameraSettingTopicId | CameraMovementTopicId>;
}

export const PROFESSIONAL_CAMERA_MOVEMENT_TOPICS: ProfessionalCameraMovementTopic[] = [
  movement({
    topicId: "static-shot",
    name: "Static Shot",
    description: "A locked-off camera with no intentional movement during the take.",
    purpose: "Provide stable, readable framing that emphasizes performance, product, or composition without motion distraction.",
    whenToUse: ["Interviews and testimonials", "Product hero beauty with controlled lighting", "Graphic/text-safe compositions", "When edit will supply rhythm"],
    whenNotToUse: ["When energy or spatial discovery is required", "When revealing geography depends on camera travel"],
    advantages: ["Maximum stability", "Easier focus and lighting control", "Clean plates for VFX/graphics"],
    limitations: ["Can feel static if overused", "Relies on subject/action for energy"],
    bestPractices: ["Level and lock the head; kill vibrations", "Compose with intention; movement absence is a choice", "Combine with motivated subject motion"],
    commonMistakes: ["Accidental micro-moves from unstable support", "Static framing without compositional interest"],
    exampleUseCases: ["Locked product pack shot", "CEO interview medium shot"],
    relatedCameraSettings: ["focus", "aperture", "exposure", "aspect-ratio"],
    relatedStorytellingTechniques: ["observational stillness", "emphasis through contrast with later moves"],
    relatedTopics: ["push-in", "eye-level", "pan"],
    relatedDomains: ["camera-movement-knowledge", "composition-knowledge", "storytelling-knowledge", "video-editing-knowledge"],
    keywords: ["static", "locked off", "tripod", "stable"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  movement({
    topicId: "pan",
    name: "Pan",
    description: "Horizontal rotation of the camera about its vertical axis.",
    purpose: "Reveal horizontal space, follow lateral action, or connect two subjects in frame over time.",
    whenToUse: ["Following a subject crossing frame", "Revealing a product line or environment", "Connecting speaker to visual evidence"],
    whenNotToUse: ["When a trucking move would better change perspective", "On uneven fluid heads causing jerks"],
    advantages: ["Simple to execute", "Preserves camera position while changing view"],
    limitations: ["Does not change parallax/perspective like a dolly/truck", "Fast pans risk rolling shutter and blur"],
    bestPractices: ["Ease in/out; avoid abrupt starts", "Lead the subject slightly", "Set drag appropriately on the head"],
    commonMistakes: ["Whip pans without intention", "Tilting accidentally during a pan"],
    exampleUseCases: ["Pan across a product lineup", "Pan from talent to demo screen"],
    relatedCameraSettings: ["shutter-speed", "frame-rate", "focal-length", "focus"],
    relatedStorytellingTechniques: ["spatial reveal", "cause-effect connection"],
    relatedTopics: ["tilt", "truck", "tracking-shot", "reveal-shot"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "composition-knowledge", "camera-knowledge"],
    keywords: ["pan", "horizontal", "fluid head", "reveal"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  movement({
    topicId: "tilt",
    name: "Tilt",
    description: "Vertical rotation of the camera about its horizontal axis.",
    purpose: "Reveal vertical relationships, emphasize scale, or travel from detail to context (or reverse).",
    whenToUse: ["Product-to-environment reveals", "Showing height/scale", "Starting on detail then revealing talent"],
    whenNotToUse: ["When a pedestal better keeps perspective parallel", "Unmotivated up/down scanning"],
    advantages: ["Strong scale storytelling", "Works well for packaging vertical reads"],
    limitations: ["Can induce distortion with wide lenses near subjects", "Horizon management needed"],
    bestPractices: ["Start/stop on composed frames", "Control speed for readability of text", "Keep horizon intentional"],
    commonMistakes: ["Over-tilting past useful composition", "Tilting too fast for on-screen text"],
    exampleUseCases: ["Tilt up a bottle hero", "Tilt from shoes to face for character intro"],
    relatedCameraSettings: ["focal-length", "focus", "aperture", "aspect-ratio"],
    relatedStorytellingTechniques: ["scale emphasis", "detail-to-context reveal"],
    relatedTopics: ["pan", "pedestal", "reveal-shot", "low-angle"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "composition-knowledge"],
    keywords: ["tilt", "vertical", "reveal", "scale"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  movement({
    topicId: "zoom",
    name: "Zoom",
    description: "Optical (or controlled digital) change of focal length during a shot.",
    purpose: "Punch in/out on a subject without moving the camera body; create stylistic emphasis or snap zooms.",
    whenToUse: ["Emphasis punches", "Live/event reframing", "Stylized snap zooms"],
    whenNotToUse: ["When dolly push is needed for true perspective change", "Unmotivated slow zooms that feel dated without style intent"],
    advantages: ["Fast reframing", "No track space required"],
    limitations: ["Lacks parallax of a dolly", "Zoom breathing and quality loss on poor lenses"],
    bestPractices: ["Prefer optical zoom; avoid heavy digital crop", "Motorize for smooth speed", "Combine with focus pulls intentionally"],
    commonMistakes: ["Confusing zoom with dolly", "Uneven manual zoom speed"],
    exampleUseCases: ["Snap zoom to product reaction", "Slow zoom into interview eyes for intensity"],
    relatedCameraSettings: ["focal-length", "focus", "aperture", "camera-resolution"],
    relatedStorytellingTechniques: ["emphasis", "tension build"],
    relatedTopics: ["dolly", "push-in", "pull-out"],
    relatedDomains: ["camera-movement-knowledge", "camera-knowledge", "storytelling-knowledge", "video-editing-knowledge"],
    keywords: ["zoom", "punch in", "optical zoom", "snap zoom"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  movement({
    topicId: "dolly",
    name: "Dolly",
    description: "Camera moves toward or away from the subject on a path (track, wheels, or equivalent).",
    purpose: "Change subject size with true perspective/parallax for immersion, intimacy, or reveal.",
    whenToUse: ["Emotional push toward talent/product", "Discovering space with parallax", "Premium commercial production value"],
    whenNotToUse: ["No path space or uneven floor without proper support", "When a zoom is explicitly the desired stylistic language"],
    advantages: ["Natural parallax", "Strong cinematic presence"],
    limitations: ["Needs space, time, and often crew", "Focus more complex"],
    bestPractices: ["Lay level track; mark start/end", "Coordinate focus pull with distance change", "Ease movement; avoid bumps"],
    commonMistakes: ["Dolly zoom confusion", "Pushing through soft focus"],
    exampleUseCases: ["Dolly in on testimonial peak emotion", "Dolly out to reveal full product setup"],
    relatedCameraSettings: ["focus", "focal-length", "aperture", "depth-of-field"],
    relatedStorytellingTechniques: ["intimacy increase", "world reveal"],
    relatedTopics: ["push-in", "pull-out", "zoom", "tracking-shot"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "camera-knowledge", "composition-knowledge"],
    keywords: ["dolly", "track", "parallax", "push", "pull"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  movement({
    topicId: "truck",
    name: "Truck",
    description: "Lateral camera move left or right, typically keeping orientation relative to the scene.",
    purpose: "Travel beside action, reveal along a line, or create dynamic product profiling.",
    whenToUse: ["Following walking talent", "Profiling a product row", "Parallax past foreground elements"],
    whenNotToUse: ["When a pan from a fixed point is enough", "Unsafe/uneven lateral path"],
    advantages: ["Strong depth parallax", "Energetic storytelling"],
    limitations: ["Requires clear lateral path", "Background pacing must be managed"],
    bestPractices: ["Match speed to subject", "Use foreground layers for depth", "Keep horizon level"],
    commonMistakes: ["Speed mismatches causing subject drift", "Rolling shutter from overly fast trucks"],
    exampleUseCases: ["Truck along a fashion look", "Lateral move past product hero with foreground blur"],
    relatedCameraSettings: ["shutter-speed", "focus", "focal-length", "frame-rate"],
    relatedStorytellingTechniques: ["journey beside character", "layered depth"],
    relatedTopics: ["tracking-shot", "pan", "dolly", "gimbal"],
    relatedDomains: ["camera-movement-knowledge", "composition-knowledge", "storytelling-knowledge"],
    keywords: ["truck", "lateral", "track left", "track right"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  movement({
    topicId: "pedestal",
    name: "Pedestal",
    description: "Vertical camera move up or down without tilting, changing height while keeping level.",
    purpose: "Shift vantage height to change power dynamics or reveal vertical layers cleanly.",
    whenToUse: ["Rising to reveal a wider scene", "Descending to product table height", "Power/status shifts"],
    whenNotToUse: ["When a tilt better reads a single vertical subject", "No vertical support available"],
    advantages: ["Keeps verticals cleaner than tilting", "Elegant height storytelling"],
    limitations: ["Needs pedestal/crane/jib capability", "Slower to set"],
    bestPractices: ["Keep horizon level", "Coordinate with focus and lighting flags", "Motivate the height change"],
    commonMistakes: ["Accidental tilt during pedestal", "Unmotivated bobbing"],
    exampleUseCases: ["Pedestal down to a watch on a table", "Rise from detail to full set"],
    relatedCameraSettings: ["focus", "exposure", "focal-length", "aspect-ratio"],
    relatedStorytellingTechniques: ["status shift", "layered reveal"],
    relatedTopics: ["tilt", "crane", "jib", "high-angle"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "composition-knowledge"],
    keywords: ["pedestal", "camera height", "rise", "descend"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  movement({
    topicId: "crane",
    name: "Crane",
    description: "Large sweeping vertical/horizontal camera move using a crane arm for expansive motion.",
    purpose: "Deliver dramatic scale, establishing energy, and spectacular reveals.",
    whenToUse: ["Opening establishers", "Epic product or location reveals", "High-end commercial moments"],
    whenNotToUse: ["Tight interiors without clearance", "When subtle intimacy is required"],
    advantages: ["High production value", "Unique high viewpoints"],
    limitations: ["Cost, safety, setup time", "Weather/wind sensitivity outdoors"],
    bestPractices: ["Safety brief and certified operation", "Rehearse path and end frame", "Combine with motivated story beat"],
    commonMistakes: ["Crane move with no story payoff", "End frame poorly composed"],
    exampleUseCases: ["Crane up from product to skyline", "Sweeping arrival into a storefront"],
    relatedCameraSettings: ["focus", "shutter-speed", "frame-rate", "exposure"],
    relatedStorytellingTechniques: ["spectacle establish", "god's-eye transition"],
    relatedTopics: ["jib", "pedestal", "overhead-shot", "reveal-shot"],
    relatedDomains: ["camera-movement-knowledge", "video-production-knowledge", "storytelling-knowledge"],
    keywords: ["crane", "sweep", "establish", "high move"],
    confidenceScore: 89,
    qualityScore: 88,
  }),
  movement({
    topicId: "jib",
    name: "Jib",
    description: "Shorter-arm boom move offering crane-like arcs with smaller footprint.",
    purpose: "Add elegant vertical/arcing motion for product and interview accents without a full crane.",
    whenToUse: ["Tabletop beauty arcs", "Interview accent rises", "Small-location elevating reveals"],
    whenNotToUse: ["Long-distance sweeping needs better served by crane/drone", "Unstable mounts"],
    advantages: ["More portable than crane", "Graceful product motion"],
    limitations: ["Limited reach vs crane", "Counterweight and balance critical"],
    bestPractices: ["Balance carefully; fluid drag set", "Start/end on hero frames", "Watch for jib shadow in lighting"],
    commonMistakes: ["Unbalanced arm causing dips", "Casting shadows on product"],
    exampleUseCases: ["Jib up from logo to talent face", "Arc over a food hero"],
    relatedCameraSettings: ["focus", "aperture", "exposure", "white-balance"],
    relatedStorytellingTechniques: ["elegant accent", "mini-establish"],
    relatedTopics: ["crane", "pedestal", "orbit-shot", "reveal-shot"],
    relatedDomains: ["camera-movement-knowledge", "lighting-knowledge", "composition-knowledge"],
    keywords: ["jib", "boom arm", "arc", "tabletop"],
    confidenceScore: 88,
    qualityScore: 87,
  }),
  movement({
    topicId: "gimbal",
    name: "Gimbal",
    description: "Stabilized handheld or motorized gimbal movement for smooth traveling shots.",
    purpose: "Achieve fluid motion through spaces where track is impractical while keeping cinematic stability.",
    whenToUse: ["Walkthroughs", "Following talent in tight spaces", "Smooth social/commercial B-roll"],
    whenNotToUse: ["When locked tripod precision is better", "Without proper balance/calibration"],
    advantages: ["Portable smooth motion", "Fast setup vs full dolly"],
    limitations: ["Battery/calibration needs", "Can look 'floaty' if overused", "Horizon/mode discipline required"],
    bestPractices: ["Balance and calibrate before rolling", "Walk with bent knees; move from core", "Choose mode (pan follow etc.) intentionally"],
    commonMistakes: ["Unbalanced gimbal drift", "Over-gimbaling every shot"],
    exampleUseCases: ["Gimbal walk into a boutique", "Smooth follow of a product handheld demo"],
    relatedCameraSettings: ["shutter-speed", "focus", "frame-rate", "focal-length"],
    relatedStorytellingTechniques: ["immersive walkthrough", "continuous geography"],
    relatedTopics: ["handheld", "tracking-shot", "follow-shot", "dolly"],
    relatedDomains: ["camera-movement-knowledge", "video-production-knowledge", "camera-knowledge"],
    keywords: ["gimbal", "stabilizer", "smooth", "walkthrough"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  movement({
    topicId: "handheld",
    name: "Handheld",
    description: "Camera operated by hand with intentional human micro-movement and energy.",
    purpose: "Create immediacy, documentary realism, or controlled energy that polished lock-offs cannot.",
    whenToUse: ["Documentary feel", "High-energy social content", "Intimate behind-the-scenes"],
    whenNotToUse: ["When brand requires ultra-clean commercial stillness", "Long lens without support causing chaos"],
    advantages: ["Speed and intimacy", "Responsive to unpredictable action"],
    limitations: ["Fatigue", "Can look amateur if uncontrolled", "Harder critical focus"],
    bestPractices: ["Brace body; control breathing", "Use wider lenses for forgiveness", "Motivate shake—don't add chaos randomly"],
    commonMistakes: ["Unmotivated shaky cam", "Horizon rolls unintentionally"],
    exampleUseCases: ["Handmade craft process coverage", "Founder walk-and-talk"],
    relatedCameraSettings: ["focal-length", "shutter-speed", "focus", "frame-rate"],
    relatedStorytellingTechniques: ["verite energy", "presence"],
    relatedTopics: ["gimbal", "follow-shot", "pov-shot"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "video-production-knowledge"],
    keywords: ["handheld", "documentary", "energy", "immediacy"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  movement({
    topicId: "tracking-shot",
    name: "Tracking Shot",
    description: "Camera travels to follow a subject or path, maintaining framing relationship over distance.",
    purpose: "Keep viewers attached to a moving subject or journey through space continuously.",
    whenToUse: ["Following talent through a location", "Product journey sequences", "Process storytelling"],
    whenNotToUse: ["No clear path or subject motion", "When coverage cuts would tell clearer"],
    advantages: ["Continuous geography", "Strong narrative propulsion"],
    limitations: ["Complex choreography", "Hidden obstacles/reflections"],
    bestPractices: ["Rehearse subject and camera speeds together", "Clear the path", "Plan lighting along the track"],
    commonMistakes: ["Losing framing on turns", "Inconsistent distance to subject"],
    exampleUseCases: ["Track a chef plating", "Follow customer journey in-store"],
    relatedCameraSettings: ["focus", "exposure", "shutter-speed", "focal-length"],
    relatedStorytellingTechniques: ["journey", "process continuity"],
    relatedTopics: ["follow-shot", "truck", "gimbal", "dolly"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "lighting-knowledge", "video-editing-knowledge"],
    keywords: ["tracking", "follow path", "traveling shot"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  movement({
    topicId: "follow-shot",
    name: "Follow Shot",
    description: "Camera follows behind, beside, or ahead of a subject to maintain pursuit framing.",
    purpose: "Put the audience in pursuit or companionship with the subject.",
    whenToUse: ["Character walks", "Athlete motion", "Unboxing hands leading into frame"],
    whenNotToUse: ["Subject static", "Safety risks trailing talent"],
    advantages: ["Empathy and momentum", "Dynamic backgrounds"],
    limitations: ["Back-of-head fatigue if overused", "Focus challenging"],
    bestPractices: ["Vary angles (behind/side/lead)", "Keep horizon intentional", "Protect talent safety"],
    commonMistakes: ["Only shooting backs of heads", "Erratic distance changes"],
    exampleUseCases: ["Follow founder into office open", "Side-follow of runner for apparel"],
    relatedCameraSettings: ["focus", "focal-length", "shutter-speed", "frame-rate"],
    relatedStorytellingTechniques: ["companionship", "pursuit"],
    relatedTopics: ["tracking-shot", "handheld", "gimbal", "pov-shot"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "composition-knowledge"],
    keywords: ["follow shot", "pursuit", "trailing", "lead camera"],
    confidenceScore: 90,
    qualityScore: 89,
  }),
  movement({
    topicId: "orbit-shot",
    name: "Orbit Shot",
    description: "Camera circles a subject, keeping it as the rotational center.",
    purpose: "Showcase a product or person in three dimensions and create premium attention.",
    whenToUse: ["360 product beauty", "Hero talent moments", "Highlighting form and finish"],
    whenNotToUse: ["Cluttered backgrounds that spin distractingly", "Talent dizziness/safety issues"],
    advantages: ["Dimensional product understanding", "High perceived production value"],
    limitations: ["Lighting continuity around circle is hard", "Reflections/crew in chrome"],
    bestPractices: ["Light for the full orbit", "Keep subject center locked", "Control background simplicity"],
    commonMistakes: ["Uneven speed", "Visible crew/reflections"],
    exampleUseCases: ["Orbit a sneaker on a turntable-equivalent move", "Circle a speaker at key statement"],
    relatedCameraSettings: ["focus", "exposure", "white-balance", "aperture"],
    relatedStorytellingTechniques: ["hero showcase", "dimensional proof"],
    relatedTopics: ["dolly", "gimbal", "truck", "static-shot"],
    relatedDomains: ["camera-movement-knowledge", "lighting-knowledge", "composition-knowledge", "video-production-knowledge"],
    keywords: ["orbit", "circle", "360", "arc around"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  movement({
    topicId: "push-in",
    name: "Push In",
    description: "Camera moves closer to the subject (dolly/gimbal equivalent), increasing intimacy.",
    purpose: "Intensify emotion, emphasize a detail, or land on a CTA/product moment.",
    whenToUse: ["Emotional peaks", "Product detail emphasis", "Landing on logo/CTA"],
    whenNotToUse: ["When space cannot support a true push and a zoom would fight style", "Unmotivated constant pushing"],
    advantages: ["Powerful emphasis", "Parallax authenticity vs zoom"],
    limitations: ["Needs path and focus discipline"],
    bestPractices: ["Motivate with story beat", "End on a strong composition", "Match focus travel"],
    commonMistakes: ["Pushing past usable framing", "Soft end frame"],
    exampleUseCases: ["Push into eyes on testimonial line", "Push to product seal/logo"],
    relatedCameraSettings: ["focus", "aperture", "depth-of-field", "focal-length"],
    relatedStorytellingTechniques: ["intensification", "punctuation"],
    relatedTopics: ["dolly", "pull-out", "zoom", "static-shot"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "marketing-knowledge" as CameraRelatedDomainId, "composition-knowledge"].filter(Boolean) as ProfessionalCameraMovementTopic["relatedDomains"],
    keywords: ["push in", "dolly in", "intensify", "emphasis"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  movement({
    topicId: "pull-out",
    name: "Pull Out",
    description: "Camera moves away from the subject, revealing context or ending a beat.",
    purpose: "Reveal environment, reduce intimacy, or transition from detail to world.",
    whenToUse: ["Ending scenes", "Context reveals", "Showing scale after a detail"],
    whenNotToUse: ["When information in the wide is empty", "Unmotivated retreat"],
    advantages: ["Natural scene punctuation", "Strong geography teaching"],
    limitations: ["Can lose subject energy if too fast"],
    bestPractices: ["Reveal meaningful new information", "Keep subject readable as you widen", "Coordinate lighting falloff"],
    commonMistakes: ["Pulling out to nothing", "Exposing crew/gear"],
    exampleUseCases: ["Pull out from product to full lifestyle set", "End interview beat by revealing office"],
    relatedCameraSettings: ["focus", "exposure", "focal-length", "aspect-ratio"],
    relatedStorytellingTechniques: ["context reveal", "scene button"],
    relatedTopics: ["dolly", "push-in", "reveal-shot", "zoom"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "composition-knowledge"],
    keywords: ["pull out", "dolly out", "reveal context", "widen"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  movement({
    topicId: "reveal-shot",
    name: "Reveal Shot",
    description: "A move (pan, tilt, dolly, pull-out, etc.) structured to disclose new visual information.",
    purpose: "Control information timing—hide then show—for surprise, clarity, or persuasion.",
    whenToUse: ["Product unveils", "Punchline visuals", "Before/after transitions"],
    whenNotToUse: ["When clarity demands showing information immediately", "Cheap surprise without payoff"],
    advantages: ["Strong attention control", "Memorable structure"],
    limitations: ["Fails if reveal content is weak", "Timing must match edit/music"],
    bestPractices: ["Hide intentionally; reveal cleanly", "Land on a composed hero frame", "Sync with sound/VO cue"],
    commonMistakes: ["Telegraphing the reveal", "Messy end frame"],
    exampleUseCases: ["Pan off blur to sharp product", "Pull out from hands to full gift box"],
    relatedCameraSettings: ["focus", "exposure", "shutter-speed", "aspect-ratio"],
    relatedStorytellingTechniques: ["information control", "surprise", "payoff"],
    relatedTopics: ["pull-out", "pan", "tilt", "push-in"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "video-editing-knowledge", "video-production-knowledge"],
    keywords: ["reveal", "unveil", "payoff", "hide and show"],
    confidenceScore: 93,
    qualityScore: 92,
  }),
  movement({
    topicId: "overhead-shot",
    name: "Overhead Shot",
    description: "Camera looks straight down (or near top-down) onto the subject plane.",
    purpose: "Clarify layout, process, and graphic compositions; create patterned beauty.",
    whenToUse: ["Food/tabletop layouts", "Assembly process", "Flat-lay product stories"],
    whenNotToUse: ["When height cues and faces matter most", "Unsafe rigging"],
    advantages: ["Diagrammatic clarity", "Strong graphic design feel"],
    limitations: ["Can feel detached", "Lighting shadows challenging"],
    bestPractices: ["Keep camera parallel to plane", "Light evenly; control shadows", "Use for instructional clarity"],
    commonMistakes: ["Keystoned 'almost overhead'", "Hands exiting unpredictably"],
    exampleUseCases: ["Overhead recipe steps", "Flat-lay unboxing arrangement"],
    relatedCameraSettings: ["aspect-ratio", "exposure", "focus", "lens-types"],
    relatedStorytellingTechniques: ["diagrammatic clarity", "pattern beauty"],
    relatedTopics: ["high-angle", "static-shot", "crane", "jib"],
    relatedDomains: ["camera-movement-knowledge", "composition-knowledge", "lighting-knowledge"],
    keywords: ["overhead", "top down", "bird's eye", "flat lay"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  movement({
    topicId: "low-angle",
    name: "Low Angle",
    description: "Camera looks up at the subject from below eye level.",
    purpose: "Increase power, monumentality, or product heroism.",
    whenToUse: ["Hero products", "Empowering talent moments", "Architecture/scale"],
    whenNotToUse: ["Unflattering for some faces/products", "When neutrality is required"],
    advantages: ["Strong status signal", "Dramatic skies/ceilings"],
    limitations: ["Distortion risk with wide lenses", "Can feel aggressive"],
    bestPractices: ["Control background clutter above subject", "Watch nostril/chin distortion", "Motivate the power shift"],
    commonMistakes: ["Accidental low angle without story reason", "Ugly ceiling backgrounds"],
    exampleUseCases: ["Low-angle sneaker hero", "Leader walking toward camera"],
    relatedCameraSettings: ["focal-length", "aperture", "exposure", "aspect-ratio"],
    relatedStorytellingTechniques: ["empowerment", "monumentality"],
    relatedTopics: ["high-angle", "eye-level", "tilt", "pedestal"],
    relatedDomains: ["camera-movement-knowledge", "composition-knowledge", "storytelling-knowledge"],
    keywords: ["low angle", "hero angle", "looking up", "power"],
    confidenceScore: 92,
    qualityScore: 91,
  }),
  movement({
    topicId: "high-angle",
    name: "High Angle",
    description: "Camera looks down at the subject from above eye level (not necessarily full overhead).",
    purpose: "Show vulnerability, overview, or readable action geography.",
    whenToUse: ["Explanatory geography", "Diminishing or observational tone", "Crowd/process overview"],
    whenNotToUse: ["When subject needs maximum empowerment", "Unmotivated high angle on beauty heroes"],
    advantages: ["Clear spatial reading", "Emotional distancing tool"],
    limitations: ["Can flatten faces", "May reduce product prestige if misused"],
    bestPractices: ["Decide emotional intent first", "Combine with purposeful staging", "Avoid accidental 'CCTV' feel"],
    commonMistakes: ["High angle by default because of tall tripod", "Mixed angles without continuity"],
    exampleUseCases: ["High angle of workspace process", "Observational shot of customer using app"],
    relatedCameraSettings: ["focal-length", "exposure", "focus", "aspect-ratio"],
    relatedStorytellingTechniques: ["vulnerability", "overview", "observation"],
    relatedTopics: ["low-angle", "overhead-shot", "eye-level", "pedestal"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "composition-knowledge"],
    keywords: ["high angle", "looking down", "overview", "observational"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
  movement({
    topicId: "eye-level",
    name: "Eye Level",
    description: "Camera height near the subject's eye line for neutral, relatable perspective.",
    purpose: "Create natural connection and unbiased observational framing.",
    whenToUse: ["Interviews", "Conversational scenes", "Relatable product demos"],
    whenNotToUse: ["When power dynamics should be skewed intentionally"],
    advantages: ["Neutral and trustworthy", "Flattering default for faces"],
    limitations: ["Less dramatic than motivated high/low angles"],
    bestPractices: ["Match eye line across coverage", "Seat camera to talent height", "Keep consistent across multi-cam"],
    commonMistakes: ["Camera too high creating unnoticed high angle", "Mismatched eye lines between shots"],
    exampleUseCases: ["Standard testimonial framing", "Demo to camera at standing eye height"],
    relatedCameraSettings: ["focal-length", "aperture", "focus", "white-balance"],
    relatedStorytellingTechniques: ["neutrality", "empathy", "direct address"],
    relatedTopics: ["low-angle", "high-angle", "static-shot", "pov-shot"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "composition-knowledge", "camera-knowledge"],
    keywords: ["eye level", "neutral angle", "eye line", "interview height"],
    confidenceScore: 94,
    qualityScore: 93,
  }),
  movement({
    topicId: "pov-shot",
    name: "POV Shot",
    description: "Camera represents a character's or user's point of view.",
    purpose: "Immerse the audience in subjective experience—what the character sees.",
    whenToUse: ["User experience demos", "Subjective story moments", "First-person product interaction"],
    whenNotToUse: ["When clarity of third-person geography is required", "Overuse causing confusion of whose eyes"],
    advantages: ["High immersion", "Strong UX storytelling"],
    limitations: ["Can disorient", "Performance/acting to lens required"],
    bestPractices: ["Establish whose POV before cutting in", "Motivate head/camera motion", "Keep interactions readable"],
    commonMistakes: ["Unannounced POV", "Shaky unreadable hands"],
    exampleUseCases: ["POV unboxing hands", "Character looking at a notification"],
    relatedCameraSettings: ["focal-length", "focus", "shutter-speed", "aspect-ratio"],
    relatedStorytellingTechniques: ["subjectivity", "immersion", "UX empathy"],
    relatedTopics: ["handheld", "follow-shot", "eye-level", "static-shot"],
    relatedDomains: ["camera-movement-knowledge", "storytelling-knowledge", "video-production-knowledge"],
    keywords: ["POV", "point of view", "subjective", "first person"],
    confidenceScore: 91,
    qualityScore: 90,
  }),
];

// Clean any accidental invalid domain ids on push-in
{
  const push = PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.find((m) => m.topicId === "push-in");
  if (push) {
    push.relatedDomains = [
      "camera-movement-knowledge",
      "storytelling-knowledge",
      "composition-knowledge",
      "video-production-knowledge",
    ];
  }
}

export const CAMERA_DOMAIN_BRIDGES: CameraDomainBridge[] = [
  {
    domainId: "camera-knowledge",
    knowledgeId: "cam-bridge-camera-knowledge",
    title: "Camera Knowledge Domain",
    description: "Hub for professional camera settings knowledge (Expansion Step 2).",
    relationshipEvidence: "Primary domain for camera operation and settings topics.",
  },
  {
    domainId: "camera-movement-knowledge",
    knowledgeId: "cam-bridge-camera-movement-knowledge",
    title: "Camera Movement Knowledge Domain",
    description: "Hub for professional camera movement and angle vocabulary.",
    relationshipEvidence: "Child domain of camera-knowledge for moves and angles.",
  },
  {
    domainId: "video-production-knowledge",
    knowledgeId: "cam-bridge-video-production-knowledge",
    title: "Video Production Knowledge (related)",
    description: "Camera craft supports end-to-end video production planning and coverage.",
    relationshipEvidence: "Camera settings and moves execute video production plans.",
  },
  {
    domainId: "lighting-knowledge",
    knowledgeId: "cam-bridge-lighting-knowledge",
    title: "Lighting Knowledge (related)",
    description: "Exposure and look depend on lighting; camera settings respond to light.",
    relationshipEvidence: "Exposure triangle and white balance require lighting coordination.",
  },
  {
    domainId: "composition-knowledge",
    knowledgeId: "cam-bridge-composition-knowledge",
    title: "Composition Knowledge (related)",
    description: "Framing, aspect ratio, and angles serve composition goals.",
    relationshipEvidence: "Camera framing and angles implement composition.",
  },
  {
    domainId: "storytelling-knowledge",
    knowledgeId: "cam-bridge-storytelling-knowledge",
    title: "Storytelling Knowledge (related)",
    description: "Camera movement and perspective choices express narrative intent.",
    relationshipEvidence: "Moves and angles are storytelling tools.",
  },
  {
    domainId: "video-editing-knowledge",
    knowledgeId: "cam-bridge-video-editing-knowledge",
    title: "Editing Knowledge (related)",
    description: "Coverage and move motivation must cut cleanly in editorial.",
    relationshipEvidence: "Camera coverage exists to serve the edit.",
  },
  {
    domainId: "rendering-knowledge",
    knowledgeId: "cam-bridge-rendering-knowledge",
    title: "Rendering Knowledge (related)",
    description: "Capture resolution, frame rate, and color affect finishing and delivery.",
    relationshipEvidence: "Camera capture specs constrain rendering/export.",
  },
];

export const REQUIRED_CAMERA_SETTING_TOPIC_IDS: CameraSettingTopicId[] =
  PROFESSIONAL_CAMERA_SETTING_TOPICS.map((t) => t.topicId);
export const REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS: CameraMovementTopicId[] =
  PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.map((t) => t.topicId);

export const REQUIRED_CAMERA_TERMINOLOGY = [
  ...REQUIRED_CAMERA_SETTING_TOPIC_IDS,
  ...REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS,
  "exposure triangle",
  "parallax",
  "shutter angle",
  "depth of field",
  "white balance",
];

export function getCameraSettingTopic(id: string): ProfessionalCameraSettingTopic | null {
  return (
    PROFESSIONAL_CAMERA_SETTING_TOPICS.find((t) => t.topicId === id || t.knowledgeId === id) ?? null
  );
}

export function getCameraMovementTopic(id: string): ProfessionalCameraMovementTopic | null {
  return (
    PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.find(
      (t) => t.topicId === id || t.knowledgeId === id || t.name.toLowerCase() === id.toLowerCase()
    ) ?? null
  );
}

export function findCameraSettingTopics(query: string): ProfessionalCameraSettingTopic[] {
  return rankTopics(query, PROFESSIONAL_CAMERA_SETTING_TOPICS, (t) => [
    t.topicId,
    t.title,
    t.description,
    t.professionalDefinition,
    ...t.keywords,
    ...t.bestPractices,
    ...t.decisionRules,
  ], (t) => [t.topicId, t.title]);
}

export function findCameraMovementTopics(query: string): ProfessionalCameraMovementTopic[] {
  return rankTopics(query, PROFESSIONAL_CAMERA_MOVEMENT_TOPICS, (t) => [
    t.topicId,
    t.name,
    t.title,
    t.description,
    t.purpose,
    ...t.keywords,
    ...t.whenToUse,
    ...t.bestPractices,
    ...t.relatedStorytellingTechniques,
  ], (t) => [t.topicId, t.name, t.title]);
}

function rankTopics<T>(
  query: string,
  items: T[],
  haystackOf: (item: T) => string[],
  identityOf?: (item: T) => string[]
): T[] {
  const lower = query.trim().toLowerCase();
  if (!lower) return [...items];
  const stop = new Set([
    "what", "is", "are", "how", "should", "i", "the", "a", "an", "do", "does", "can", "to", "for",
    "of", "in", "on", "and", "or", "about", "explain", "recommend", "compare", "best", "camera",
    "movement", "settings", "setting", "shot", "use", "when", "why", "difference", "between",
  ]);
  const tokens = lower
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !stop.has(t));

  const exact = items.filter((item) => {
    const ids = (identityOf?.(item) ?? []).map((v) => v.toLowerCase());
    return ids.some(
      (id) =>
        id === lower ||
        id.replace(/-/g, " ") === lower ||
        lower === id ||
        lower.includes(id) ||
        id.includes(lower)
    );
  });
  if (exact.length) {
    return exact.sort((a, b) => {
      const aIds = (identityOf?.(a) ?? []).map((v) => v.toLowerCase());
      const bIds = (identityOf?.(b) ?? []).map((v) => v.toLowerCase());
      const aExact = aIds.some((id) => id === lower || id.replace(/-/g, " ") === lower) ? 1 : 0;
      const bExact = bIds.some((id) => id === lower || id.replace(/-/g, " ") === lower) ? 1 : 0;
      return bExact - aExact;
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
