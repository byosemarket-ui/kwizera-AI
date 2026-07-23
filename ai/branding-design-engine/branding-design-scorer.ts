import {
  BrandConsistencyPlan,
  BrandingDesignRecord,
  BrandingDesignScores,
  ColorManagementPlan,
  DesignPlanningPlan,
  LogoPlanningPlan,
  MarketingMaterialsPlan,
  PrintDesignPlan,
  SocialMediaDesignPlan,
} from "./types.js";
import type { BrandingDesignContext } from "./branding-design-analyzer.js";

export class BrandingDesignScorer {
  computeScores(
    designPlanning: DesignPlanningPlan,
    logoPlanning: LogoPlanningPlan,
    marketingMaterials: MarketingMaterialsPlan,
    socialMediaDesign: SocialMediaDesignPlan,
    printDesign: PrintDesignPlan,
    brandConsistency: BrandConsistencyPlan,
    colorManagement: ColorManagementPlan,
    platformOptimizations: BrandingDesignRecord["platformOptimizations"],
    context: BrandingDesignContext
  ): BrandingDesignScores {
    const brandingScore = this.computeBrandingScore(designPlanning, logoPlanning, brandConsistency, context);
    const graphicDesignScore = this.computeGraphicDesignScore(designPlanning, marketingMaterials, socialMediaDesign);
    const layoutScore = this.computeLayoutScore(designPlanning);
    const typographyScore = this.computeTypographyScore(designPlanning, brandConsistency);
    const brandConsistencyScore = this.computeBrandConsistencyScore(brandConsistency, context);
    const printReadinessScore = this.computePrintReadiness(printDesign, colorManagement, platformOptimizations);
    const aiConfidenceScore = Math.round(
      (brandingScore +
        graphicDesignScore +
        layoutScore +
        typographyScore +
        brandConsistencyScore +
        printReadinessScore) /
        6
    );

    return {
      brandingScore,
      graphicDesignScore,
      layoutScore,
      typographyScore,
      brandConsistencyScore,
      printReadinessScore,
      aiConfidenceScore,
    };
  }

  isBrandingPlanValid(
    scores: BrandingDesignScores,
    record: Pick<
      BrandingDesignRecord,
      "designPlanning" | "logoPlanning" | "brandConsistency" | "colorManagement" | "printDesign" | "socialMediaDesign"
    >
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (scores.brandingScore < 55) diagnostics.push(`Branding score ${scores.brandingScore} below threshold (55)`);
    if (scores.graphicDesignScore < 55) diagnostics.push(`Graphic design score ${scores.graphicDesignScore} below threshold (55)`);
    if (scores.layoutScore < 55) diagnostics.push(`Layout score ${scores.layoutScore} below threshold (55)`);
    if (scores.typographyScore < 55) diagnostics.push(`Typography score ${scores.typographyScore} below threshold (55)`);
    if (scores.brandConsistencyScore < 50) diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    if (scores.printReadinessScore < 55) diagnostics.push(`Print readiness score ${scores.printReadinessScore} below threshold (55)`);
    if (scores.aiConfidenceScore < 55) diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);

    if (!record.designPlanning.layoutStructure || record.designPlanning.layoutStructure.length < 10) {
      diagnostics.push("Design planning layout structure incomplete");
    }
    if (record.logoPlanning.variants.length < 4) {
      diagnostics.push("Insufficient logo variants planned (minimum 4)");
    }
    if (record.brandConsistency.elements.length < 6) {
      diagnostics.push("Insufficient brand consistency elements (minimum 6)");
    }
    if (record.colorManagement.rgbPalette.length < 2) {
      diagnostics.push("Color management palette incomplete");
    }
    if (record.printDesign.formats.length < 1) {
      diagnostics.push("Print design formats not planned");
    }
    if (record.socialMediaDesign.formats.length < 1) {
      diagnostics.push("Social media design formats not planned");
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(scores: BrandingDesignScores, record: BrandingDesignRecord): boolean {
    return (
      scores.brandingScore >= 55 &&
      scores.graphicDesignScore >= 55 &&
      scores.brandConsistencyScore >= 50 &&
      record.productionInstructions.renderNotes.length >= 1 &&
      record.platformOptimizations.length >= 1
    );
  }

  isPrintReady(scores: BrandingDesignScores, record: BrandingDesignRecord): boolean {
    return (
      scores.printReadinessScore >= 55 &&
      record.printDesign.formats.length >= 1 &&
      record.colorManagement.cmykPalette.length >= 2
    );
  }

  isBrandConsistent(context: BrandingDesignContext, brandConsistency: BrandConsistencyPlan): boolean {
    if (!context.brandName) return brandConsistency.elements.length >= 4;
    return (
      brandConsistency.logoUsageRules.length >= 1 &&
      brandConsistency.colorPaletteRules.some((r) => r.toLowerCase().includes(context.brandName!.toLowerCase()) || r.includes("Brand"))
    );
  }

  private computeBrandingScore(
    design: DesignPlanningPlan,
    logo: LogoPlanningPlan,
    consistency: BrandConsistencyPlan,
    context: BrandingDesignContext
  ): number {
    let score = 45;
    if (logo.variants.length >= 6) score += 20;
    if (consistency.elements.length >= 6) score += 15;
    if (context.brandGuidelines) score += 10;
    if (design.visualHierarchy.length >= 10) score += 10;
    return Math.min(100, score);
  }

  private computeGraphicDesignScore(
    design: DesignPlanningPlan,
    marketing: MarketingMaterialsPlan,
    social: SocialMediaDesignPlan
  ): number {
    let score = 45;
    if (design.composition.length >= 10) score += 15;
    if (marketing.materials.length >= 4) score += 15;
    if (social.formats.length >= 4) score += 15;
    if (design.illustrationPlanning.length >= 1) score += 10;
    return Math.min(100, score);
  }

  private computeLayoutScore(design: DesignPlanningPlan): number {
    let score = 45;
    if (design.gridSystem.length >= 10) score += 20;
    if (design.alignment.length >= 5) score += 15;
    if (design.whiteSpacePlanning.length >= 10) score += 15;
    if (design.layoutStructure.length >= 10) score += 10;
    return Math.min(100, score);
  }

  private computeTypographyScore(design: DesignPlanningPlan, consistency: BrandConsistencyPlan): number {
    let score = 45;
    if (design.typographyPlanning.length >= 3) score += 25;
    if (consistency.typographyRules.length >= 1) score += 15;
    if (design.typographyPlanning.some((t) => t.includes("H1"))) score += 15;
    return Math.min(100, score);
  }

  private computeBrandConsistencyScore(consistency: BrandConsistencyPlan, context: BrandingDesignContext): number {
    let score = 45;
    if (consistency.elements.length >= 6) score += 20;
    if (context.brandName) score += 15;
    if (consistency.visualIdentityNotes.length >= 1) score += 10;
    if (context.campaignId) score += 10;
    return Math.min(100, score);
  }

  private computePrintReadiness(
    print: PrintDesignPlan,
    color: ColorManagementPlan,
    platforms: BrandingDesignRecord["platformOptimizations"]
  ): number {
    let score = 45;
    if (print.formats.length >= 4) score += 20;
    if (color.cmykPalette.length >= 2) score += 15;
    if (color.contrastValidation.length >= 10) score += 10;
    if (platforms.length >= 4) score += 10;
    if (print.printNotes.length >= 2) score += 10;
    return Math.min(100, score);
  }
}
