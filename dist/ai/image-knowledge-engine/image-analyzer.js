import { CreativeStyle, ImageType, } from "./types.js";
export class ImageAnalyzer {
    analyze(input) {
        const width = input.width ?? 1920;
        const height = input.height ?? 1080;
        const aspectRatio = this.computeAspectRatio(width, height);
        const visual = {
            products: input.visual?.products ?? (input.product ? [input.product] : []),
            objects: input.visual?.objects ?? [],
            logos: input.visual?.logos ?? (input.brandName ? [`${input.brandName}-logo`] : []),
            textInImage: input.visual?.textInImage ?? [],
            colors: input.visual?.colors ?? ["#1a1a2e", "#e94560", "#ffffff"],
            dominantColors: input.visual?.dominantColors ?? ["#1a1a2e", "#e94560"],
            background: input.visual?.background ?? "studio-gradient",
            lighting: input.visual?.lighting ?? "soft-studio",
            composition: input.visual?.composition ?? "rule-of-thirds",
            cameraAngle: input.visual?.cameraAngle ?? "eye-level",
            perspective: input.visual?.perspective ?? "front-facing",
            depth: input.visual?.depth ?? "shallow-depth-of-field",
            texture: input.visual?.texture ?? "smooth",
            shadows: input.visual?.shadows ?? "soft-shadows",
            reflections: input.visual?.reflections ?? "subtle",
            visualHierarchy: input.visual?.visualHierarchy ?? "product-primary",
        };
        const metrics = {
            sharpness: input.metrics?.sharpness ?? 85,
            brightness: input.metrics?.brightness ?? 72,
            contrast: input.metrics?.contrast ?? 78,
            saturation: input.metrics?.saturation ?? 70,
            colorBalance: input.metrics?.colorBalance ?? 80,
            whiteBalance: input.metrics?.whiteBalance ?? 82,
            noise: input.metrics?.noise ?? 12,
            resolution: input.metrics?.resolution ?? `${width}x${height}`,
            aspectRatio: input.metrics?.aspectRatio ?? aspectRatio,
            compositionQuality: input.metrics?.compositionQuality ?? 75,
        };
        const productPresentation = {
            position: input.productPresentation?.position ?? "center",
            visibility: input.productPresentation?.visibility ?? 88,
            focus: input.productPresentation?.focus ?? 90,
            size: input.productPresentation?.size ?? "hero",
            angle: input.productPresentation?.angle ?? "three-quarter",
            background: input.productPresentation?.background ?? visual.background,
            category: input.productPresentation?.category ?? input.category ?? "general",
            branding: input.productPresentation?.branding ?? input.brandName ?? "unknown",
            packaging: input.productPresentation?.packaging ?? "visible",
        };
        const design = {
            layout: input.design?.layout ?? "centered-hero",
            typography: input.design?.typography ?? "sans-serif-modern",
            colorHarmony: input.design?.colorHarmony ?? "complementary",
            iconPlacement: input.design?.iconPlacement ?? "top-right",
            visualBalance: input.design?.visualBalance ?? 80,
            creativeStyle: input.design?.creativeStyle ?? CreativeStyle.Modern,
        };
        const brand = {
            logoPosition: input.brandInfo?.logoPosition ?? "top-left",
            brandColors: input.brandInfo?.brandColors ?? visual.dominantColors,
            brandTypography: input.brandInfo?.brandTypography ?? design.typography,
            brandIdentity: input.brandInfo?.brandIdentity ?? input.brandName ?? "unbranded",
            brandConsistency: input.brandInfo?.brandConsistency ?? 75,
        };
        return {
            visual,
            metrics,
            productPresentation,
            design,
            brand,
            imageType: input.imageType ?? ImageType.Product,
        };
    }
    computeAspectRatio(width, height) {
        const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
        const divisor = gcd(width, height);
        return `${width / divisor}:${height / divisor}`;
    }
}
//# sourceMappingURL=image-analyzer.js.map