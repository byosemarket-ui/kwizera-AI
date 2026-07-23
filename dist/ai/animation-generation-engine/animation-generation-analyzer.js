import { ANIMATION_PLATFORM_TARGETS, AnimationPlanType, PLATFORM_ANIMATION_CONFIG, } from "./types.js";
export class AnimationGenerationAnalyzer {
    buildAnimationPlan(scene, cameraPlan, motionPlan, version) {
        const profile = this.buildProfile(scene, cameraPlan, motionPlan, version);
        const purpose = scene.structure.scenePurpose;
        const isProduct = ["product-showcase", "benefits", "solution"].includes(purpose);
        const isCharacter = !["product-showcase", "ending"].includes(purpose);
        return {
            animationPlanId: profile.animationPlanId,
            profile,
            planType: isProduct ? AnimationPlanType.Product : isCharacter ? AnimationPlanType.Combined : AnimationPlanType.Object,
            characterAnimation: this.buildCharacterAnimation(scene, motionPlan, isCharacter),
            productAnimation: this.buildProductAnimation(scene, motionPlan, isProduct),
            objectAnimation: this.buildObjectAnimation(scene, motionPlan),
            textAnimation: this.buildTextAnimation(scene, purpose),
            logoAnimation: this.buildLogoAnimation(scene),
            environmentAnimation: this.buildEnvironmentAnimation(motionPlan),
            transitionAnimation: this.buildTransitionAnimation(scene),
            timeline: this.buildTimeline(scene, motionPlan),
            synchronization: this.buildSynchronization(motionPlan, cameraPlan, scene),
            platformOptimizations: this.buildPlatformOptimizations(scene.profile.platform),
        };
    }
    buildProfile(scene, cameraPlan, motionPlan, version) {
        return {
            animationPlanId: `animation-plan-${scene.sceneId}-v${version}`,
            sceneId: scene.sceneId,
            storyboardId: scene.profile.storyboardId,
            projectId: scene.profile.projectId,
            productId: scene.profile.productId,
            brandId: scene.profile.brandId,
            platform: scene.profile.platform,
            animationVersion: version,
            motionPlanId: motionPlan.motionPlanId,
            cameraPlanId: cameraPlan.cameraPlanId,
        };
    }
    buildCharacterAnimation(scene, motionPlan, active) {
        const cm = motionPlan.characterMotion;
        return {
            idle: active ? "Subtle breathing idle — natural micro-movements" : "Static product-focus hold",
            walk: active ? cm.walking : "N/A",
            run: active ? cm.running : "N/A",
            jump: active ? "Optional jump accent for hook moments" : "N/A",
            gesture: active ? cm.gestures : "Minimal supporting gesture",
            facialAnimation: active ? cm.facialExpressions : "N/A",
            lipMovementPlan: active ? "Lip sync to voice-over timing — viseme mapping" : "N/A",
            eyeMovement: active ? "Natural saccades with camera eye-line" : "N/A",
            handMovement: active ? cm.interaction : "Product interaction hands only",
        };
    }
    buildProductAnimation(scene, motionPlan, isHero) {
        const pm = motionPlan.productMotion;
        return {
            rotation: pm.rotation,
            scale: isHero ? "Scale 1.0→1.15 hero pulse on feature beat" : "Subtle 1.0→1.05 scale",
            reveal: pm.reveal,
            showcase: pm.showcaseMotion,
            highlight: pm.highlightMotion,
            floating: pm.floating,
            assembly: isHero ? "Component assembly animation — feature breakdown" : "N/A",
            explodedView: isHero ? "Exploded view reveal for technical showcase" : "N/A",
        };
    }
    buildObjectAnimation(scene, motionPlan) {
        const om = motionPlan.objectMotion;
        return {
            movement: om.entry,
            rotation: "Natural object rotation on interaction axis",
            physicsMotion: om.physicsBasedMotion,
            interaction: om.interaction,
            environmentalAnimation: om.environmentalInteraction,
        };
    }
    buildTextAnimation(scene, purpose) {
        const isCta = purpose === "call-to-action";
        return {
            fade: "Text fade-in 0.3s ease-out",
            slide: isCta ? "CTA slide-up from lower-third" : "Subtitle slide-in from left",
            scale: isCta ? "CTA pop scale 0.9→1.0" : "Minimal scale on emphasis words",
            typewriter: purpose === "opening-hook" ? "Hook text typewriter reveal — 1.5s" : "N/A",
            bounce: isCta ? "CTA bounce on appearance" : "N/A",
            pop: isCta ? "CTA pop animation with brand color flash" : "N/A",
            reveal: scene.visualPlan.typographyPlacement,
            kineticTypography: "Kinetic typography synced to voice-over beats",
        };
    }
    buildLogoAnimation(scene) {
        const isEnding = scene.structure.scenePurpose === "ending";
        return {
            logoReveal: isEnding ? "Brand logo fade-in with glow reveal" : scene.visualPlan.logoPlacement,
            logoRotation: isEnding ? "Subtle 5° logo rotation settle" : "Static logo watermark",
            logoGlow: isEnding ? "Brand color glow pulse on lockup" : "Subtle ambient glow",
            logoScale: isEnding ? "Logo scale 0→1.0 over 1s ease-out" : "Fixed watermark scale",
            logoTransition: isEnding ? "Logo hold 2s before fade-out" : "Persistent brand mark",
        };
    }
    buildEnvironmentAnimation(motionPlan) {
        const em = motionPlan.environmentMotion;
        const hasParticles = em.activeEffects.includes("particles");
        return {
            rain: em.rain,
            snow: "N/A unless seasonal narrative",
            wind: em.wind,
            smoke: em.smoke,
            fire: em.fire,
            water: em.water,
            dust: hasParticles ? "Ambient dust particles in light rays" : "Minimal",
            particles: em.particles,
            lightRays: em.lightRays,
        };
    }
    buildTransitionAnimation(scene) {
        const tp = scene.transitionPlanning;
        return {
            fade: tp.sceneTransition.includes("fade") ? tp.sceneTransition : "Cross-fade 0.5s",
            cut: "Hard cut on action beat when pacing demands",
            dissolve: tp.visualTransition,
            wipe: "Directional wipe matching motion vector",
            zoom: scene.structure.scenePurpose === "call-to-action" ? "Zoom transition into CTA" : "N/A",
            morph: "Shape morph between scene elements",
            motionBlur: "Motion blur on fast camera moves",
            customTransition: tp.motionTransition,
        };
    }
    buildTimeline(scene, motionPlan) {
        const mt = motionPlan.motionTiming;
        return {
            animationStart: mt.motionStart,
            animationEnd: mt.motionEnd,
            animationDuration: mt.motionDuration,
            easing: `${mt.motionAcceleration}; ${mt.motionDeceleration}`,
            synchronization: "All layers synced to scene duration and motion beats",
            layerPriority: [
                "character/product hero",
                "object props",
                "text/typography",
                "logo/brand",
                "environment effects",
                "transitions",
            ],
        };
    }
    buildSynchronization(motionPlan, cameraPlan, scene) {
        return {
            motionSync: motionPlan.cameraSynchronization.syncPoints,
            cameraSync: cameraPlan.shotPlans.map((s) => `Shot ${s.shotOrder}: ${s.cameraMovement}`),
            audioSync: [scene.audioPlanning.voiceTiming, scene.audioPlanning.audioSynchronization],
            transitionSync: [scene.transitionPlanning.sceneTransition, scene.transitionPlanning.shotTransition],
        };
    }
    buildPlatformOptimizations(platform) {
        return ANIMATION_PLATFORM_TARGETS.map((p) => {
            const config = PLATFORM_ANIMATION_CONFIG[p];
            return {
                platform: p,
                pacingStyle: config.pacingStyle,
                animationIntensity: config.animationIntensity,
                notes: p === platform ? ["Primary platform animation pacing"] : [`Adapt ${config.pacingStyle} for ${p}`],
            };
        });
    }
    buildRecommendations(draft) {
        const recs = [];
        if (draft.planType === AnimationPlanType.Product) {
            recs.push("Verify product animation against brand motion guidelines");
        }
        recs.push("Review animation timeline synchronization before render preparation");
        return recs;
    }
}
//# sourceMappingURL=animation-generation-analyzer.js.map