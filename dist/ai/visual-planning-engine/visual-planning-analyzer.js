const PURPOSE_CAMERA = {
    hook: { angle: "eye-level", distance: "medium shot", movement: "quick push-in" },
    "product-introduction": { angle: "hero angle", distance: "close-up", movement: "slow orbit" },
    "feature-presentation": { angle: "side view", distance: "medium shot", movement: "pan right" },
    "benefit-demonstration": { angle: "eye-level", distance: "wide shot", movement: "tilt up" },
    "customer-value": { angle: "eye-level", distance: "medium shot", movement: "static" },
    "social-proof": { angle: "eye-level", distance: "medium shot", movement: "static" },
    "offer-presentation": { angle: "top view", distance: "close-up", movement: "zoom in" },
    "call-to-action": { angle: "hero angle", distance: "hero shot", movement: "zoom in" },
    ending: { angle: "eye-level", distance: "wide shot", movement: "pull back" },
};
const PRODUCT_PURPOSES = new Set([
    "product-introduction",
    "feature-presentation",
    "benefit-demonstration",
    "offer-presentation",
]);
export class VisualPlanningAnalyzer {
    buildProfile(input, storyboard, scriptPlan, understanding, version) {
        const visualPlanId = input.visualPlanId ?? `visual-plan-${input.productId}-${storyboard.profile.platform}`;
        return {
            visualPlanId,
            projectId: input.projectId ?? storyboard.projectId,
            storyboardId: storyboard.storyboardId,
            scriptPlanId: scriptPlan.scriptPlanId,
            product: storyboard.profile.product,
            brand: storyboard.profile.brand,
            campaignGoal: storyboard.profile.campaignGoal,
            platform: storyboard.profile.platform,
            visualVersion: version,
            creativeStyle: storyboard.profile.creativeStyle,
            industry: understanding.customer.targetIndustry ?? "general",
        };
    }
    buildScenePlans(storyboard, scriptPlan, creative, understanding) {
        return storyboard.scenes.map((scene, index) => {
            const scriptScene = scriptPlan.scenePlans[index];
            return this.buildSceneVisualPlan(scene, scriptScene, creative, understanding);
        });
    }
    buildBackgroundPlanning(creative, storyboard) {
        const brand = creative.profile.brand;
        const palette = creative.visualDirection.colorPalette.join(", ");
        return {
            studioBackground: `Plan studio background — neutral backdrop with ${palette} accent lighting`,
            lifestyleBackground: `Plan lifestyle background — contextual environment for ${storyboard.profile.targetAudience}`,
            transparentBackground: "Plan transparent background — product isolation for overlays and compositing",
            gradientBackground: `Plan gradient background — ${palette} brand gradient fade`,
            environmentBackground: `Plan environment background — ${creative.visualDirection.backgroundStyle} setting`,
            brandedBackground: `Plan branded background — ${brand} identity elements and brand colors`,
            customBackground: `Plan custom background — ${storyboard.profile.creativeStyle} style for ${storyboard.profile.platform}`,
        };
    }
    buildCameraPlanning(creative, storyboard) {
        const cinematic = creative.cinematicDirection;
        return {
            closeUp: `Plan close-up — product detail and texture emphasis (${cinematic.framingStyle})`,
            mediumShot: `Plan medium shot — subject and context balance for ${storyboard.profile.platform}`,
            wideShot: `Plan wide shot — full scene establishment and environment reveal`,
            topView: "Plan top view — flat-lay product arrangement and feature layout",
            sideView: "Plan side view — profile and dimensional product presentation",
            heroShot: `Plan hero shot — flagship product framing with ${cinematic.cameraStyle}`,
            orbit: `Plan orbit movement — 360° product reveal (${cinematic.cameraMovement})`,
            zoom: `Plan zoom — ${cinematic.motionStyle} emphasis on key visual elements`,
            pan: `Plan pan — horizontal scene traversal (${cinematic.sceneRhythm})`,
            tilt: `Plan tilt — vertical reveal following ${cinematic.transitionStyle}`,
        };
    }
    buildVisualStyle(creative, understanding) {
        const design = creative.visualDirection.designStyle;
        const industry = understanding.customer.targetIndustry ?? "general";
        return {
            modern: `Plan modern style — ${design} with clean lines and contemporary palette`,
            luxury: `Plan luxury style — premium materials, refined lighting, elevated composition`,
            minimal: `Plan minimal style — negative space, restrained palette, focused product`,
            corporate: `Plan corporate style — professional tone, structured layout, trust signals`,
            cinematic: `Plan cinematic style — ${creative.cinematicDirection.cameraStyle} with dramatic depth`,
            commercial: `Plan commercial style — conversion-focused hierarchy and clear product focus`,
            fashion: `Plan fashion style — editorial framing and aspirational lifestyle context`,
            technology: `Plan technology style — sleek UI overlays, product-in-use demonstrations`,
            food: `Plan food style — appetizing lighting, texture emphasis, warm palette`,
            realEstate: `Plan real estate style — spatial depth, wide angles, lifestyle staging`,
        };
    }
    buildBrandConsistency(creative, scenePlans) {
        const issues = [];
        const recommendations = [];
        const logoOk = scenePlans.some((s) => s.logoPlacement !== "none" && s.logoPlacement.length > 5);
        const colorsOk = scenePlans.every((s) => s.colorPalette.includes(creative.profile.brand) || s.colorPalette.length > 10);
        const typographyOk = scenePlans.every((s) => s.typography.length > 5);
        const identityOk = scenePlans.some((s) => s.visualGoal.toLowerCase().includes(creative.profile.brand.toLowerCase()) || s.logoPlacement !== "none");
        const visualOk = scenePlans.every((s) => s.composition.length > 5);
        if (!logoOk) {
            issues.push("Logo placement not planned in any scene");
            recommendations.push("Add logo placement to CTA and closing scenes");
        }
        if (!colorsOk) {
            issues.push("Brand color palette not reflected in all scene plans");
            recommendations.push("Apply brand colors from creative direction to every scene");
        }
        return {
            logoPlacement: logoOk,
            brandColors: colorsOk,
            typography: typographyOk,
            brandIdentity: identityOk,
            visualConsistency: visualOk,
            issues,
            recommendations,
        };
    }
    buildGraphicElements(creative, understanding) {
        return {
            titles: `Plan title placement — ${creative.visualDirection.visualHierarchy} hierarchy`,
            captions: `Plan caption zones — bottom safe area per ${creative.profile.platform}`,
            priceTags: `Plan price tag — promotional pricing overlay for ${understanding.identity.productName}`,
            productFeatures: `Plan feature callouts — ${understanding.uniqueValue.uniqueSellingPoints.slice(0, 3).join(", ")}`,
            icons: `Plan icon placement — ${creative.visualDirection.iconStyle} style icons`,
            ctaButtons: `Plan CTA buttons — ${creative.marketingDirection.callToActionPlacement}`,
            qrCodes: "Plan QR code — bottom-right corner for mobile scan conversion",
            contactInformation: `Plan contact info — ${creative.profile.brand} brand contact zone`,
        };
    }
    validateSceneAlignment(scenePlans, storyboard, scriptPlan) {
        const issues = [];
        if (scenePlans.length !== storyboard.scenes.length) {
            issues.push(`Scene count mismatch: visual ${scenePlans.length} vs storyboard ${storyboard.scenes.length}`);
        }
        if (scenePlans.length !== scriptPlan.scenePlans.length) {
            issues.push(`Scene count mismatch: visual ${scenePlans.length} vs script ${scriptPlan.scenePlans.length}`);
        }
        for (let i = 0; i < Math.min(scenePlans.length, storyboard.scenes.length); i++) {
            if (scenePlans[i].sceneNumber !== storyboard.scenes[i].sceneNumber) {
                issues.push(`Scene ${i + 1} numbering misaligned with storyboard`);
            }
            if (scenePlans[i].visualGoal !== storyboard.scenes[i].visualObjective) {
                issues.push(`Scene ${scenePlans[i].sceneNumber} visual goal does not match storyboard objective`);
            }
            if (scriptPlan.scenePlans[i] && scenePlans[i].sceneNumber !== scriptPlan.scenePlans[i].sceneNumber) {
                issues.push(`Scene ${scenePlans[i].sceneNumber} misaligned with script plan`);
            }
        }
        return { aligned: issues.length === 0, issues };
    }
    buildSceneVisualPlan(scene, scriptScene, creative, understanding) {
        const camera = PURPOSE_CAMERA[scene.scenePurpose] ?? {
            angle: "eye-level",
            distance: "medium shot",
            movement: scene.cameraDirection || "static",
        };
        const isProductScene = PRODUCT_PURPOSES.has(scene.scenePurpose);
        const productPlacement = isProductScene
            ? `Plan product placement — ${creative.visualDirection.productPlacement} (${scene.productFocus})`
            : scene.productFocus.toLowerCase().includes("no product")
                ? "Plan no product — environment and message focus"
                : `Plan supporting product — ${scene.productFocus}`;
        const palette = creative.visualDirection.colorPalette.join(" / ");
        const logoPlacement = scene.ctaPlacement !== "none" || scene.scenePurpose === "ending"
            ? `Plan logo — ${creative.brandDirection.logoPlacement}`
            : scene.scenePurpose === "hook"
                ? `Plan logo watermark — subtle ${creative.profile.brand} mark`
                : "none";
        return {
            sceneNumber: scene.sceneNumber,
            visualGoal: scene.visualObjective,
            productPlacement,
            backgroundStyle: `Plan background — ${scene.backgroundStyle} (${creative.visualDirection.backgroundStyle})`,
            lightingDirection: `Plan lighting — ${scene.lightingDirection} (${creative.visualDirection.lightingStyle})`,
            cameraAngle: `Plan camera angle — ${camera.angle}`,
            cameraDistance: `Plan camera distance — ${camera.distance}`,
            cameraMovement: `Plan camera movement — ${scene.motionDirection || camera.movement}`,
            composition: `Plan composition — ${scene.composition} (${creative.visualDirection.compositionStyle})`,
            depth: `Plan depth — foreground/midground/background layering for ${scene.scenePurpose}`,
            colorPalette: `Plan palette — ${palette}`,
            typography: `Plan typography — ${creative.visualDirection.typographyStyle} for ${scriptScene?.plannedOnScreenText ?? scene.textPlacement}`,
            iconPlacement: scene.textPlacement !== "none" ? `Plan icons — ${creative.visualDirection.iconStyle}` : "none",
            logoPlacement,
            visualEffectsPlan: `Plan VFX — subtle ${creative.visualDirection.graphicStyle} enhancements`,
            motionDirection: `Plan motion — ${scene.motionDirection} (${creative.cinematicDirection.motionStyle})`,
            transitionDirection: `Plan transition — ${scene.transitionOut} (${creative.cinematicDirection.transitionStyle})`,
        };
    }
}
//# sourceMappingURL=visual-planning-analyzer.js.map