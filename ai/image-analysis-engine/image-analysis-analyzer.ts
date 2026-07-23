import {
  ImageAnalysisEngineInput,
  ImageAnalysisType,
  ImageClassification,
  ImageColorSpace,
  ImageCompressionType,
  ImageContentPreparation,
  ImageFileFormat,
  ImageOrientation,
  ImageTechnicalProfile,
  ImageVisualAnalysis,
} from "./types.js";

const TYPE_DEFAULTS: Record<
  ImageAnalysisType,
  { category: string; subcategory: string; creativeStyle: string; useCase: string }
> = {
  [ImageAnalysisType.ProductImage]: {
    category: "commerce",
    subcategory: "product-hero",
    creativeStyle: "commercial",
    useCase: "e-commerce-listing",
  },
  [ImageAnalysisType.LifestyleImage]: {
    category: "lifestyle",
    subcategory: "in-context",
    creativeStyle: "editorial",
    useCase: "brand-storytelling",
  },
  [ImageAnalysisType.MarketingImage]: {
    category: "marketing",
    subcategory: "campaign",
    creativeStyle: "modern",
    useCase: "advertising",
  },
  [ImageAnalysisType.Logo]: {
    category: "brand",
    subcategory: "identity",
    creativeStyle: "minimal",
    useCase: "brand-recognition",
  },
  [ImageAnalysisType.Banner]: {
    category: "marketing",
    subcategory: "banner",
    creativeStyle: "commercial",
    useCase: "web-display",
  },
  [ImageAnalysisType.Poster]: {
    category: "marketing",
    subcategory: "poster",
    creativeStyle: "editorial",
    useCase: "print-digital",
  },
  [ImageAnalysisType.Screenshot]: {
    category: "digital",
    subcategory: "interface",
    creativeStyle: "minimal",
    useCase: "documentation",
  },
  [ImageAnalysisType.Background]: {
    category: "design",
    subcategory: "background",
    creativeStyle: "minimal",
    useCase: "composition-base",
  },
  [ImageAnalysisType.Other]: {
    category: "general",
    subcategory: "uncategorized",
    creativeStyle: "standard",
    useCase: "general-purpose",
  },
};

export class ImageAnalysisAnalyzer {
  analyze(input: ImageAnalysisEngineInput): {
    technical: ImageTechnicalProfile;
    visual: ImageVisualAnalysis;
    content: ImageContentPreparation;
    classification: ImageClassification;
  } {
    const imageName = input.imageName ?? "Unnamed Image";
    const filePath = input.filePath ?? "";
    const width = input.width ?? 0;
    const height = input.height ?? 0;
    const fileFormat = input.fileFormat ?? this.inferFormat(filePath);
    const aspectRatio = width > 0 && height > 0 ? this.computeAspectRatio(width, height) : "unknown";
    const orientation = this.computeOrientation(width, height);

    const technical: ImageTechnicalProfile = {
      imageName,
      imageId: input.imageId ?? "",
      filePath,
      fileFormat,
      fileSizeBytes: input.fileSizeBytes ?? 0,
      resolution: width > 0 && height > 0 ? `${width}x${height}` : "unknown",
      width,
      height,
      aspectRatio,
      orientation,
      colorSpace: input.colorSpace ?? ImageColorSpace.SRGB,
      bitDepth: input.bitDepth ?? 8,
      compressionType: input.compressionType ?? this.inferCompression(fileFormat),
      hasTransparency: input.hasTransparency ?? fileFormat === ImageFileFormat.PNG,
      metadata: input.metadata ?? {},
      creationDate: input.creationDate,
      lastModifiedDate: input.lastModifiedDate,
    };

    const visual: ImageVisualAnalysis = {
      brightness: input.visual?.brightness ?? 65,
      contrast: input.visual?.contrast ?? 70,
      saturation: input.visual?.saturation ?? 60,
      sharpness: input.visual?.sharpness ?? 75,
      noiseLevel: input.visual?.noiseLevel ?? 15,
      whiteBalance: input.visual?.whiteBalance ?? 72,
      exposure: input.visual?.exposure ?? 68,
      dynamicRange: input.visual?.dynamicRange ?? 70,
      colorDistribution: input.visual?.colorDistribution ?? this.inferColorDistribution(input),
      dominantColors: input.visual?.dominantColors ?? this.inferDominantColors(input),
    };

    const imageType = input.imageType ?? this.classifyImageType(input, visual);
    const defaults = TYPE_DEFAULTS[imageType];

    const content: ImageContentPreparation = {
      objects: input.content?.objects ?? [],
      products: input.content?.products ?? (input.product ? [input.product] : []),
      logos: input.content?.logos ?? (imageType === ImageAnalysisType.Logo && input.brand ? [input.brand] : []),
      text: input.content?.text ?? [],
      background: input.content?.background ?? this.inferBackground(imageType),
      foreground: input.content?.foreground ?? (input.product ? input.product : "primary-subject"),
      shapes: input.content?.shapes ?? [],
      patterns: input.content?.patterns ?? [],
    };

    const classification: ImageClassification = {
      imageType,
      category: input.category ?? defaults.category,
      subcategory: input.subcategory ?? defaults.subcategory,
      creativeStyle: input.creativeStyle ?? defaults.creativeStyle,
      useCase: input.useCase ?? defaults.useCase,
    };

    return { technical, visual, content, classification };
  }

  private inferFormat(filePath: string): ImageFileFormat {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const map: Record<string, ImageFileFormat> = {
      jpg: ImageFileFormat.JPEG,
      jpeg: ImageFileFormat.JPEG,
      png: ImageFileFormat.PNG,
      webp: ImageFileFormat.WebP,
      gif: ImageFileFormat.GIF,
      tiff: ImageFileFormat.TIFF,
      bmp: ImageFileFormat.BMP,
      svg: ImageFileFormat.SVG,
      heic: ImageFileFormat.HEIC,
    };
    return ext && map[ext] ? map[ext] : ImageFileFormat.Other;
  }

  private inferCompression(format: ImageFileFormat): ImageCompressionType {
    if (format === ImageFileFormat.PNG || format === ImageFileFormat.TIFF) {
      return ImageCompressionType.Lossless;
    }
    if (format === ImageFileFormat.JPEG || format === ImageFileFormat.WebP) {
      return ImageCompressionType.Lossy;
    }
    return ImageCompressionType.Unknown;
  }

  private computeAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const d = gcd(width, height);
    return `${width / d}:${height / d}`;
  }

  private computeOrientation(width: number, height: number): ImageOrientation {
    if (width === height) return ImageOrientation.Square;
    return width > height ? ImageOrientation.Landscape : ImageOrientation.Portrait;
  }

  private classifyImageType(input: ImageAnalysisEngineInput, visual: ImageVisualAnalysis): ImageAnalysisType {
    if (input.imageType) return input.imageType;

    const name = (input.imageName ?? "").toLowerCase();
    const path = (input.filePath ?? "").toLowerCase();

    if (name.includes("logo") || path.includes("logo")) return ImageAnalysisType.Logo;
    if (name.includes("banner") || path.includes("banner")) return ImageAnalysisType.Banner;
    if (name.includes("poster") || path.includes("poster")) return ImageAnalysisType.Poster;
    if (name.includes("screenshot") || path.includes("screenshot")) return ImageAnalysisType.Screenshot;
    if (name.includes("background") || path.includes("background")) return ImageAnalysisType.Background;
    if (input.product && visual.sharpness >= 70) return ImageAnalysisType.ProductImage;
    if (input.campaign || name.includes("marketing")) return ImageAnalysisType.MarketingImage;
    if (input.brand && !input.product) return ImageAnalysisType.LifestyleImage;

    return ImageAnalysisType.Other;
  }

  private inferDominantColors(input: ImageAnalysisEngineInput): string[] {
    if (input.visual?.dominantColors?.length) return input.visual.dominantColors;
    if (input.brand?.toLowerCase().includes("kwizera")) return ["#1a1a2e", "#e94560", "#ffffff"];
    return ["#333333", "#cccccc"];
  }

  private inferColorDistribution(input: ImageAnalysisEngineInput): Record<string, number> {
    if (input.visual?.colorDistribution) return input.visual.colorDistribution;
    const colors = this.inferDominantColors(input);
    const share = Math.floor(100 / colors.length);
    const dist: Record<string, number> = {};
    for (const c of colors) dist[c] = share;
    return dist;
  }

  private inferBackground(imageType: ImageAnalysisType): string {
    const map: Partial<Record<ImageAnalysisType, string>> = {
      [ImageAnalysisType.ProductImage]: "studio-white",
      [ImageAnalysisType.LifestyleImage]: "environmental",
      [ImageAnalysisType.Logo]: "transparent",
      [ImageAnalysisType.Banner]: "gradient",
      [ImageAnalysisType.Background]: "full-frame",
      [ImageAnalysisType.Screenshot]: "interface-canvas",
    };
    return map[imageType] ?? "neutral";
  }
}
