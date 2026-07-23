const REQUIRED_FIELDS = ["videoName", "filePath", "width", "height", "fileFormat", "durationMs"];
export class VideoAnalysisCompletenessDetector {
    detect(input, technical) {
        const missing = [];
        if (!technical.videoName || technical.videoName === "Unnamed Video")
            missing.push("videoName");
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
        if (!technical.durationMs || technical.durationMs <= 0)
            missing.push("durationMs");
        if (!technical.resolution)
            missing.push("resolution");
        if (!technical.aspectRatio)
            missing.push("aspectRatio");
        if (!technical.fps || technical.fps <= 0)
            missing.push("fps");
        if (!technical.videoCodec)
            missing.push("videoCodec");
        if (!technical.container)
            missing.push("container");
        if (!technical.bitrateKbps || technical.bitrateKbps <= 0)
            missing.push("bitrateKbps");
        if (!technical.creationDate)
            missing.push("creationDate");
        if (!technical.lastModifiedDate)
            missing.push("lastModifiedDate");
        if (!input.product)
            missing.push("product");
        if (!input.brand)
            missing.push("brand");
        if (!input.videoType)
            missing.push("videoType");
        if (!input.tags?.length)
            missing.push("tags");
        if (!input.keywords?.length)
            missing.push("keywords");
        if (!input.language)
            missing.push("language");
        return [...new Set(missing)];
    }
    isCriticallyIncomplete(missing) {
        return REQUIRED_FIELDS.some((f) => missing.includes(f));
    }
}
//# sourceMappingURL=video-analysis-completeness.js.map