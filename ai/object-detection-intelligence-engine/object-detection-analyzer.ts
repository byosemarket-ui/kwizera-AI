import crypto from "node:crypto";
import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import {
  BoundingRegion,
  DetectedObject,
  DetectedObjectType,
  LogoDetection,
  ObjectDetectionRecommendation,
  ObjectOrientation,
  ObjectPosition,
  ProductDetection,
  TextDetection,
} from "./types.js";

export class ObjectDetectionAnalyzer {
  buildFromIntelligence(
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord
  ): {
    objects: DetectedObject[];
    productDetection: ProductDetection;
    textDetection: TextDetection;
    logoDetection: LogoDetection;
    recommendations: ObjectDetectionRecommendation[];
    keywords: string[];
  } {
    const objects: DetectedObject[] = [];
    let index = 0;

    for (const product of analysis.content.products) {
      objects.push(this.createObject(analysis.imageId, ++index, DetectedObjectType.Product, product, {
        x: 30,
        y: 25,
        width: 40,
        height: 50,
      }, 88, ObjectPosition.Center));
    }

    for (const logo of analysis.content.logos) {
      objects.push(this.createObject(analysis.imageId, ++index, DetectedObjectType.Logo, logo, {
        x: 5,
        y: 5,
        width: 15,
        height: 12,
      }, 85, ObjectPosition.TopLeft));
    }

    for (const text of analysis.content.text) {
      objects.push(this.createObject(analysis.imageId, ++index, DetectedObjectType.Text, text, {
        x: 10,
        y: 70,
        width: 80,
        height: 15,
      }, 80, ObjectPosition.BottomLeft, ObjectOrientation.Horizontal));
    }

    for (const obj of analysis.content.objects) {
      const type = this.inferObjectType(obj);
      objects.push(this.createObject(analysis.imageId, ++index, type, obj, {
        x: 20 + (index % 3) * 20,
        y: 20 + (index % 2) * 25,
        width: 25,
        height: 25,
      }, 75, ObjectPosition.Center));
    }

    for (const shape of analysis.content.shapes) {
      objects.push(this.createObject(analysis.imageId, ++index, DetectedObjectType.DecorativeElement, shape, {
        x: 60,
        y: 10,
        width: 20,
        height: 20,
      }, 70, ObjectPosition.TopRight));
    }

    if (analysis.content.background) {
      objects.push(this.createObject(
        analysis.imageId,
        ++index,
        DetectedObjectType.BackgroundObject,
        analysis.content.background,
        { x: 0, y: 0, width: 100, height: 100 },
        90,
        ObjectPosition.FullFrame
      ));
    }

    if (objects.length === 0 && analysis.content.foreground) {
      objects.push(this.createObject(
        analysis.imageId,
        ++index,
        DetectedObjectType.Product,
        analysis.content.foreground,
        { x: 25, y: 20, width: 50, height: 60 },
        82,
        ObjectPosition.Center
      ));
    }

    this.linkObjectRelationships(objects);

    const mainProduct = analysis.content.products[0] ?? null;
    const productDetection: ProductDetection = {
      mainProduct,
      secondaryProducts: analysis.content.products.slice(1),
      productVisibility: understanding.product.productVisibility,
      productPosition: mainProduct ? ObjectPosition.Center : ObjectPosition.FullFrame,
      productImportance: understanding.product.productImportance,
      productGrouping: analysis.content.products.length > 1 ? "multi-product" : "single-product",
      productPresentation: understanding.product.productPresentation,
    };

    const textDetection: TextDetection = {
      textPresent: analysis.content.text.length > 0,
      textRegions: analysis.content.text.map((_, i) => ({
        x: 10,
        y: 70 + i * 5,
        width: 80,
        height: 12,
      })),
      textOrientation: ObjectOrientation.Horizontal,
      textSize: analysis.content.text.length > 0 ? "medium" : "none",
      textImportance: analysis.classification.imageType === "banner" ? "high" : "medium",
      detectedTextLabels: analysis.content.text,
    };

    const logoDetection: LogoDetection = {
      logoPresent: analysis.content.logos.length > 0 || understanding.brand.logoPresence,
      logoPosition: analysis.content.logos.length > 0 ? ObjectPosition.TopLeft : ObjectPosition.Center,
      logoVisibility: understanding.brand.brandVisibility,
      logoSize: analysis.content.logos.length > 0 ? "small" : "none",
      brandAssociation: understanding.brand.brandIdentity,
      logoRegions: analysis.content.logos.map(() => ({ x: 5, y: 5, width: 15, height: 12 })),
    };

    const recommendations = this.buildRecommendations(objects, productDetection, logoDetection, textDetection);
    const keywords = [
      ...analysis.keywords,
      ...understanding.keywords,
      ...objects.map((o) => o.objectType),
      ...objects.map((o) => o.objectName),
    ].filter(Boolean);

    return { objects, productDetection, textDetection, logoDetection, recommendations, keywords };
  }

  private createObject(
    imageId: string,
    index: number,
    type: DetectedObjectType,
    name: string,
    region: BoundingRegion,
    confidence: number,
    position: ObjectPosition,
    orientation: ObjectOrientation = ObjectOrientation.Unknown
  ): DetectedObject {
    return {
      objectId: `obj-${imageId}-${index}-${crypto.randomBytes(2).toString("hex")}`,
      objectType: type,
      objectName: name,
      boundingRegion: region,
      estimatedSize: `${region.width}% x ${region.height}%`,
      position,
      visibility: Math.min(100, confidence + 5),
      orientation,
      confidenceScore: confidence,
      relatedObjectIds: [],
    };
  }

  private inferObjectType(name: string): DetectedObjectType {
    const lower = name.toLowerCase();
    if (lower.includes("person") || lower.includes("model")) return DetectedObjectType.Person;
    if (lower.includes("car") || lower.includes("vehicle")) return DetectedObjectType.Vehicle;
    if (lower.includes("food")) return DetectedObjectType.Food;
    if (lower.includes("chair") || lower.includes("furniture")) return DetectedObjectType.Furniture;
    if (lower.includes("phone") || lower.includes("device")) return DetectedObjectType.Electronics;
    if (lower.includes("icon")) return DetectedObjectType.Icon;
    if (lower.includes("animal")) return DetectedObjectType.Animal;
    if (lower.includes("building")) return DetectedObjectType.Building;
    if (lower.includes("cloth") || lower.includes("jacket")) return DetectedObjectType.Clothing;
    return DetectedObjectType.BackgroundObject;
  }

  private linkObjectRelationships(objects: DetectedObject[]): void {
    const products = objects.filter((o) => o.objectType === DetectedObjectType.Product);
    const logos = objects.filter((o) => o.objectType === DetectedObjectType.Logo);
    const texts = objects.filter((o) => o.objectType === DetectedObjectType.Text);

    for (const product of products) {
      product.relatedObjectIds = [
        ...logos.map((l) => l.objectId),
        ...texts.slice(0, 1).map((t) => t.objectId),
      ];
    }
    for (const logo of logos) {
      logo.relatedObjectIds = products.map((p) => p.objectId);
    }
  }

  private buildRecommendations(
    objects: DetectedObject[],
    product: ProductDetection,
    logo: LogoDetection,
    text: TextDetection
  ): ObjectDetectionRecommendation[] {
    const recs: ObjectDetectionRecommendation[] = [];

    if (product.mainProduct && product.productVisibility < 75) {
      recs.push({
        category: "visibility",
        suggestion: "Increase main product prominence in frame",
        priority: "high",
        reason: `Product visibility at ${product.productVisibility}%`,
      });
    }
    if (!logo.logoPresent) {
      recs.push({
        category: "branding",
        suggestion: "Add logo placement for brand recognition",
        priority: "medium",
        reason: "No logo detected in object structure",
      });
    }
    if (text.textPresent && text.textImportance === "high") {
      recs.push({
        category: "placement",
        suggestion: "Reserve clear text region for CTA overlay",
        priority: "high",
        reason: "High-importance text detected",
      });
    }
    if (objects.length < 2) {
      recs.push({
        category: "composition",
        suggestion: "Enrich scene with supporting visual elements",
        priority: "low",
        reason: "Limited object diversity detected",
      });
    }
    recs.push({
      category: "creative",
      suggestion: "Object structure ready for enhancement planning",
      priority: "low",
      reason: `${objects.length} objects indexed`,
    });

    return recs;
  }
}
