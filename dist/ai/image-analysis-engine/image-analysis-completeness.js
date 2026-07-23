const REQUIRED_FIELDS = ["imageName", "filePath", "width", "height", "fileFormat"];
export class ImageAnalysisCompletenessDetector {
    detect(input, technical) {
        const missing = [];
        if (!technical.imageName || technical.imageName === "Unnamed Image")
            missing.push("imageName");
        if (!technical.filePath)
            missing.push("filePath");
        if (!technical.width || technical.width <= 0)
            missing.push("width");
        if (!technical.height || technical.height <= 0)
            missing.push("height");
        if (!technical.fileFormat)
            missing.push("fileFormat");
        if (!technical.fileSizeBytes || technical.fileSizeBytes <= 0)
            missing.push("fileSizeBytes");
        if (!technical.resolution)
            missing.push("resolution");
        if (!technical.aspectRatio)
            missing.push("aspectRatio");
        if (!technical.colorSpace)
            missing.push("colorSpace");
        if (!technical.bitDepth || technical.bitDepth <= 0)
            missing.push("bitDepth");
        if (!technical.compressionType)
            missing.push("compressionType");
        if (!technical.creationDate)
            missing.push("creationDate");
        if (!technical.lastModifiedDate)
            missing.push("lastModifiedDate");
        if (!input.product)
            missing.push("product");
        if (!input.brand)
            missing.push("brand");
        if (!input.imageType)
            missing.push("imageType");
        if (!input.tags?.length)
            missing.push("tags");
        if (!input.keywords?.length)
            missing.push("keywords");
        if (!input.visual?.dominantColors?.length && !input.visual?.brightness)
            missing.push("dominantColors");
        if (!input.content?.background)
            missing.push("background");
        return [...new Set(missing)];
    }
    isCriticallyIncomplete(missing) {
        return REQUIRED_FIELDS.some((f) => missing.includes(f));
    }
}
//# sourceMappingURL=image-analysis-completeness.js.map