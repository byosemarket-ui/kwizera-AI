/**
 * KWIZERA AI STUDIO — Image Analysis Engine types (Step 6B)
 */
export var ImageFileFormat;
(function (ImageFileFormat) {
    ImageFileFormat["JPEG"] = "jpeg";
    ImageFileFormat["PNG"] = "png";
    ImageFileFormat["WebP"] = "webp";
    ImageFileFormat["GIF"] = "gif";
    ImageFileFormat["TIFF"] = "tiff";
    ImageFileFormat["BMP"] = "bmp";
    ImageFileFormat["SVG"] = "svg";
    ImageFileFormat["HEIC"] = "heic";
    ImageFileFormat["Other"] = "other";
})(ImageFileFormat || (ImageFileFormat = {}));
export var ImageOrientation;
(function (ImageOrientation) {
    ImageOrientation["Landscape"] = "landscape";
    ImageOrientation["Portrait"] = "portrait";
    ImageOrientation["Square"] = "square";
})(ImageOrientation || (ImageOrientation = {}));
export var ImageColorSpace;
(function (ImageColorSpace) {
    ImageColorSpace["SRGB"] = "srgb";
    ImageColorSpace["AdobeRGB"] = "adobe-rgb";
    ImageColorSpace["DisplayP3"] = "display-p3";
    ImageColorSpace["CMYK"] = "cmyk";
    ImageColorSpace["Grayscale"] = "grayscale";
    ImageColorSpace["Unknown"] = "unknown";
})(ImageColorSpace || (ImageColorSpace = {}));
export var ImageCompressionType;
(function (ImageCompressionType) {
    ImageCompressionType["Lossless"] = "lossless";
    ImageCompressionType["Lossy"] = "lossy";
    ImageCompressionType["Uncompressed"] = "uncompressed";
    ImageCompressionType["Unknown"] = "unknown";
})(ImageCompressionType || (ImageCompressionType = {}));
export var ImageAnalysisType;
(function (ImageAnalysisType) {
    ImageAnalysisType["ProductImage"] = "product-image";
    ImageAnalysisType["LifestyleImage"] = "lifestyle-image";
    ImageAnalysisType["MarketingImage"] = "marketing-image";
    ImageAnalysisType["Logo"] = "logo";
    ImageAnalysisType["Banner"] = "banner";
    ImageAnalysisType["Poster"] = "poster";
    ImageAnalysisType["Screenshot"] = "screenshot";
    ImageAnalysisType["Background"] = "background";
    ImageAnalysisType["Other"] = "other";
})(ImageAnalysisType || (ImageAnalysisType = {}));
export class ImageAnalysisEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageAnalysisEngineError";
    }
}
//# sourceMappingURL=types.js.map