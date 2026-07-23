/**
 * KWIZERA AI STUDIO — Object Detection Intelligence Engine types (Step 6D)
 */
export var DetectedObjectType;
(function (DetectedObjectType) {
    DetectedObjectType["Product"] = "product";
    DetectedObjectType["Logo"] = "logo";
    DetectedObjectType["Text"] = "text";
    DetectedObjectType["Icon"] = "icon";
    DetectedObjectType["Person"] = "person";
    DetectedObjectType["Animal"] = "animal";
    DetectedObjectType["Vehicle"] = "vehicle";
    DetectedObjectType["Building"] = "building";
    DetectedObjectType["Furniture"] = "furniture";
    DetectedObjectType["Food"] = "food";
    DetectedObjectType["Clothing"] = "clothing";
    DetectedObjectType["Electronics"] = "electronics";
    DetectedObjectType["BackgroundObject"] = "background-object";
    DetectedObjectType["DecorativeElement"] = "decorative-element";
})(DetectedObjectType || (DetectedObjectType = {}));
export var ObjectPosition;
(function (ObjectPosition) {
    ObjectPosition["Center"] = "center";
    ObjectPosition["TopLeft"] = "top-left";
    ObjectPosition["TopRight"] = "top-right";
    ObjectPosition["BottomLeft"] = "bottom-left";
    ObjectPosition["BottomRight"] = "bottom-right";
    ObjectPosition["FullFrame"] = "full-frame";
})(ObjectPosition || (ObjectPosition = {}));
export var ObjectOrientation;
(function (ObjectOrientation) {
    ObjectOrientation["Horizontal"] = "horizontal";
    ObjectOrientation["Vertical"] = "vertical";
    ObjectOrientation["Diagonal"] = "diagonal";
    ObjectOrientation["Unknown"] = "unknown";
})(ObjectOrientation || (ObjectOrientation = {}));
export class ObjectDetectionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ObjectDetectionEngineError";
    }
}
//# sourceMappingURL=types.js.map