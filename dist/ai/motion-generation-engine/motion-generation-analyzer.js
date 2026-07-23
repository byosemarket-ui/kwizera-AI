import { CharacterMotionAction, EnvironmentMotionType, MOTION_PLATFORM_TARGETS, MotionType, ObjectMotionAction, PLATFORM_MOTION_CONFIG, ProductMotionAction, } from "./types.js";
export class MotionGenerationAnalyzer {
    buildMotionPlan(scene, cameraPlan, version) {
        const profile = this.buildProfile(scene, cameraPlan, version);
        const purpose = scene.structure.scenePurpose;
        const isProduct = ["product-showcase", "benefits", "solution"].includes(purpose);
        const isCharacter = !["product-showcase", "ending"].includes(purpose);
        return {
            motionPlanId: profile.motionPlanId,
            profile,
            motionType: isProduct ? MotionType.Product : isCharacter ? MotionType.Combined : MotionType.Object,
            characterMotion: this.buildCharacterMotion(scene, isCharacter),
            productMotion: this.buildProductMotion(scene, isProduct),
            objectMotion: this.buildObjectMotion(scene),
            cameraSynchronization: this.buildCameraSync(scene, cameraPlan),
            environmentMotion: this.buildEnvironmentMotion(scene),
            motionTiming: this.buildMotionTiming(scene),
            continuity: this.buildContinuity(scene, cameraPlan),
            platformOptimizations: this.buildPlatformOptimizations(scene.profile.platform),
            storytellingOptimization: this.buildStorytellingOptimization(scene),
        };
    }
    buildProfile(scene, cameraPlan, version) {
        return {
            motionPlanId: `motion-plan-${scene.sceneId}-v${version}`,
            sceneId: scene.sceneId,
            storyboardId: scene.profile.storyboardId,
            projectId: scene.profile.projectId,
            productId: scene.profile.productId,
            brandId: scene.profile.brandId,
            platform: scene.profile.platform,
            motionVersion: version,
            cameraPlanId: cameraPlan.cameraPlanId,
        };
    }
    buildCharacterMotion(scene, active) {
        const mood = scene.structure.sceneMood;
        return {
            primaryAction: active ? CharacterMotionAction.Gestures : CharacterMotionAction.BodyLanguage,
            walking: active ? `Natural walk — ${mood} pace toward camera` : "N/A — product focus scene",
            running: active ? "Energetic run for hook moments only" : "N/A",
            turning: active ? `Smooth 45° turn revealing ${scene.structure.scenePurpose}` : "N/A",
            looking: active ? "Direct camera eye contact — engagement focus" : "N/A",
            gestures: active ? scene.characterPlanning.characterActions : "Minimal gesture — product hero",
            facialExpressions: scene.characterPlanning.facialExpression,
            bodyLanguage: scene.characterPlanning.bodyLanguage,
            interaction: scene.characterPlanning.interactionPlanning,
        };
    }
    buildProductMotion(scene, isHero) {
        return {
            primaryAction: isHero ? ProductMotionAction.ShowcaseMotion : ProductMotionAction.Placement,
            rotation: isHero ? "Slow 360° hero rotation — 8s arc" : "Subtle 15° tilt for visibility",
            reveal: isHero ? "Dramatic reveal from shadow to spotlight" : "Gradual fade-in placement",
            zoomPresentation: isHero ? "Push-in zoom highlighting key feature" : "Static product hold",
            showcaseMotion: isHero
                ? scene.objectPlanning.productPosition
                : "Supporting product presence in frame",
            floating: isHero ? "Gentle floating hover — premium presentation" : "Grounded placement",
            placement: scene.objectPlanning.productPosition,
            highlightMotion: isHero ? "Pulse highlight on hero feature zone" : "Ambient subtle glow",
        };
    }
    buildObjectMotion(scene) {
        return {
            primaryAction: ObjectMotionAction.Interaction,
            entry: `Objects enter frame aligned to scene ${scene.structure.sceneOrder} beat`,
            exit: "Smooth exit on transition cut — motion vector preserved",
            interaction: scene.objectPlanning.objectInteraction,
            physicsBasedMotion: "Gravity-consistent object behavior — no floating unless hero product",
            collisionPlanning: "Safe collision zones — product path unobstructed",
            environmentalInteraction: scene.objectPlanning.environmentObjects.join(", ") || "Ambient props",
        };
    }
    buildCameraSync(scene, cameraPlan) {
        const cameraMoves = cameraPlan.shotPlans.map((s) => s.cameraMovement).join(", ");
        return {
            cameraMovement: cameraMoves || scene.motionPlanning.cameraMotion,
            characterMovement: scene.motionPlanning.subjectMotion,
            productMovement: scene.objectPlanning.productPosition,
            objectMovement: scene.objectPlanning.objectInteraction,
            sceneTiming: scene.structure.sceneDuration,
            syncPoints: cameraPlan.shotPlans.map((s, i) => `T${i * 2}s: ${s.cameraMovement} synced with ${s.shotType} beat`),
        };
    }
    buildEnvironmentMotion(scene) {
        const mood = scene.structure.sceneMood;
        const hasParticles = mood.includes("showcase") || mood.includes("attention");
        return {
            activeEffects: hasParticles
                ? [EnvironmentMotionType.Particles, EnvironmentMotionType.LightRays, EnvironmentMotionType.BackgroundMotion]
                : [EnvironmentMotionType.BackgroundMotion],
            wind: mood.includes("dynamic") ? "Subtle wind ripple in background fabric" : "Calm — no wind",
            rain: "N/A unless weather narrative",
            smoke: "N/A — clean studio environment",
            fire: "N/A",
            water: "N/A",
            lightRays: hasParticles ? "Volumetric light rays through particle haze" : "Soft studio key light only",
            particles: hasParticles ? "Floating brand-color particles — subtle depth" : "Minimal ambient dust",
            backgroundMotion: scene.motionPlanning.environmentMotion,
        };
    }
    buildMotionTiming(scene) {
        const seconds = parseInt(scene.structure.sceneDuration, 10) || 8;
        return {
            motionStart: "0s",
            motionEnd: `${seconds}s`,
            motionDuration: `${seconds}s`,
            motionSpeed: seconds <= 6 ? "fast" : seconds <= 10 ? "moderate" : "slow-cinematic",
            motionAcceleration: "Ease-in 0.3s at scene start",
            motionDeceleration: "Ease-out 0.5s before transition",
        };
    }
    buildContinuity(scene, cameraPlan) {
        const issues = [];
        if (!scene.motionPlanning.subjectMotion)
            issues.push("Subject motion undefined");
        return {
            sceneContinuity: scene.structure.sceneOrder > 0,
            characterContinuity: scene.characterPlanning.bodyLanguage.length > 5,
            productContinuity: scene.objectPlanning.productPosition.length > 5,
            cameraContinuity: cameraPlan.continuity.motionContinuity,
            storyContinuity: scene.structure.sceneObjectives.length >= 1,
            notes: [
                `Scene ${scene.structure.sceneOrder} motion aligned to ${scene.structure.scenePurpose}`,
                `Camera plan ${cameraPlan.cameraPlanId} synchronized`,
            ],
            issues,
        };
    }
    buildPlatformOptimizations(platform) {
        return MOTION_PLATFORM_TARGETS.map((p) => {
            const config = PLATFORM_MOTION_CONFIG[p];
            return {
                platform: p,
                pacingStyle: config.pacingStyle,
                movementIntensity: config.movementIntensity,
                syncNotes: p === platform
                    ? ["Primary platform — native motion pacing"]
                    : [`Adapt ${config.pacingStyle} from ${platform}`],
            };
        });
    }
    buildStorytellingOptimization(scene) {
        return {
            narrativeBeat: scene.structure.sceneObjective,
            emotionalArc: scene.structure.sceneMood,
            marketingMoment: scene.structure.scenePurpose === "call-to-action"
                ? "Peak conversion motion — urgency pacing"
                : scene.structure.scenePurpose === "product-showcase"
                    ? "Hero product motion — desire building"
                    : "Narrative support motion",
        };
    }
    buildRecommendations(draft) {
        const recs = [];
        if (draft.continuity.issues.length > 0)
            recs.push("Review motion continuity issues before animation planning");
        if (draft.motionType === MotionType.Product)
            recs.push("Verify product motion against brand motion guidelines");
        recs.push("Review platform motion optimizations before render preparation");
        return recs;
    }
}
//# sourceMappingURL=motion-generation-analyzer.js.map