/**
 * KWIZERA AI STUDIO — Video Analysis Engine types (Step 7B)
 */
export var VideoFileFormat;
(function (VideoFileFormat) {
    VideoFileFormat["MP4"] = "mp4";
    VideoFileFormat["MOV"] = "mov";
    VideoFileFormat["AVI"] = "avi";
    VideoFileFormat["MKV"] = "mkv";
    VideoFileFormat["WebM"] = "webm";
    VideoFileFormat["MPEG"] = "mpeg";
    VideoFileFormat["Other"] = "other";
})(VideoFileFormat || (VideoFileFormat = {}));
export var VideoContainer;
(function (VideoContainer) {
    VideoContainer["MP4"] = "mp4";
    VideoContainer["QuickTime"] = "quicktime";
    VideoContainer["Matroska"] = "matroska";
    VideoContainer["WebM"] = "webm";
    VideoContainer["AVI"] = "avi";
    VideoContainer["Other"] = "other";
})(VideoContainer || (VideoContainer = {}));
export var VideoCodec;
(function (VideoCodec) {
    VideoCodec["H264"] = "h264";
    VideoCodec["H265"] = "h265";
    VideoCodec["VP9"] = "vp9";
    VideoCodec["AV1"] = "av1";
    VideoCodec["ProRes"] = "prores";
    VideoCodec["Other"] = "other";
})(VideoCodec || (VideoCodec = {}));
export var AudioCodec;
(function (AudioCodec) {
    AudioCodec["AAC"] = "aac";
    AudioCodec["MP3"] = "mp3";
    AudioCodec["PCM"] = "pcm";
    AudioCodec["Opus"] = "opus";
    AudioCodec["AC3"] = "ac3";
    AudioCodec["Other"] = "other";
})(AudioCodec || (AudioCodec = {}));
export var VideoOrientation;
(function (VideoOrientation) {
    VideoOrientation["Landscape"] = "landscape";
    VideoOrientation["Portrait"] = "portrait";
    VideoOrientation["Square"] = "square";
})(VideoOrientation || (VideoOrientation = {}));
export var FrameRateMode;
(function (FrameRateMode) {
    FrameRateMode["Constant"] = "constant";
    FrameRateMode["Variable"] = "variable";
})(FrameRateMode || (FrameRateMode = {}));
export var VideoColorSpace;
(function (VideoColorSpace) {
    VideoColorSpace["SRGB"] = "srgb";
    VideoColorSpace["Rec709"] = "rec709";
    VideoColorSpace["Rec2020"] = "rec2020";
    VideoColorSpace["P3"] = "p3";
    VideoColorSpace["Unknown"] = "unknown";
})(VideoColorSpace || (VideoColorSpace = {}));
export var VideoAnalysisType;
(function (VideoAnalysisType) {
    VideoAnalysisType["Advertisement"] = "advertisement";
    VideoAnalysisType["Commercial"] = "commercial";
    VideoAnalysisType["ProductShowcase"] = "product-showcase";
    VideoAnalysisType["Tutorial"] = "tutorial";
    VideoAnalysisType["SocialMedia"] = "social-media";
    VideoAnalysisType["Documentary"] = "documentary";
    VideoAnalysisType["Presentation"] = "presentation";
    VideoAnalysisType["Interview"] = "interview";
    VideoAnalysisType["Animation"] = "animation";
    VideoAnalysisType["Corporate"] = "corporate";
    VideoAnalysisType["Other"] = "other";
})(VideoAnalysisType || (VideoAnalysisType = {}));
export class VideoAnalysisEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoAnalysisEngineError";
    }
}
//# sourceMappingURL=types.js.map