/**
 * KWIZERA AI STUDIO — Video Memory Engine types (Step 3G)
 */
export var VideoStatus;
(function (VideoStatus) {
    VideoStatus["Draft"] = "draft";
    VideoStatus["InProduction"] = "in-production";
    VideoStatus["Editing"] = "editing";
    VideoStatus["Completed"] = "completed";
    VideoStatus["Exported"] = "exported";
    VideoStatus["Archived"] = "archived";
})(VideoStatus || (VideoStatus = {}));
export class VideoMemoryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoMemoryEngineError";
    }
}
//# sourceMappingURL=types.js.map