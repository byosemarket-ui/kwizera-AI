/**
 * KWIZERA AI STUDIO — Motion Intelligence Engine types (Step 7G)
 */
export var MotionDirection;
(function (MotionDirection) {
    MotionDirection["Static"] = "static";
    MotionDirection["Left"] = "left";
    MotionDirection["Right"] = "right";
    MotionDirection["Up"] = "up";
    MotionDirection["Down"] = "down";
    MotionDirection["Forward"] = "forward";
    MotionDirection["Backward"] = "backward";
    MotionDirection["Circular"] = "circular";
    MotionDirection["Mixed"] = "mixed";
})(MotionDirection || (MotionDirection = {}));
export var MotionSpeed;
(function (MotionSpeed) {
    MotionSpeed["Static"] = "static";
    MotionSpeed["Slow"] = "slow";
    MotionSpeed["Normal"] = "normal";
    MotionSpeed["Fast"] = "fast";
    MotionSpeed["VeryFast"] = "very-fast";
})(MotionSpeed || (MotionSpeed = {}));
export var MotionClassification;
(function (MotionClassification) {
    MotionClassification["Static"] = "static";
    MotionClassification["SlowMotion"] = "slow-motion";
    MotionClassification["NormalMotion"] = "normal-motion";
    MotionClassification["FastMotion"] = "fast-motion";
    MotionClassification["Action"] = "action";
    MotionClassification["CinematicMotion"] = "cinematic-motion";
    MotionClassification["PromotionalMotion"] = "promotional-motion";
    MotionClassification["DynamicMotion"] = "dynamic-motion";
    MotionClassification["AnimatedMotion"] = "animated-motion";
    MotionClassification["Other"] = "other";
})(MotionClassification || (MotionClassification = {}));
export var ObjectMotionType;
(function (ObjectMotionType) {
    ObjectMotionType["ProductMovement"] = "product-movement";
    ObjectMotionType["HumanMovement"] = "human-movement";
    ObjectMotionType["VehicleMovement"] = "vehicle-movement";
    ObjectMotionType["AnimalMovement"] = "animal-movement";
    ObjectMotionType["BackgroundMotion"] = "background-motion";
    ObjectMotionType["EnvironmentalMotion"] = "environmental-motion";
})(ObjectMotionType || (ObjectMotionType = {}));
export var MotionEventType;
(function (MotionEventType) {
    MotionEventType["StartMotion"] = "start-motion";
    MotionEventType["StopMotion"] = "stop-motion";
    MotionEventType["DirectionChange"] = "direction-change";
    MotionEventType["SpeedChange"] = "speed-change";
    MotionEventType["Collision"] = "collision";
    MotionEventType["Interaction"] = "interaction";
    MotionEventType["FocusShift"] = "focus-shift";
    MotionEventType["AttentionShift"] = "attention-shift";
})(MotionEventType || (MotionEventType = {}));
export var TrackingSubjectType;
(function (TrackingSubjectType) {
    TrackingSubjectType["Product"] = "product";
    TrackingSubjectType["Human"] = "human";
    TrackingSubjectType["Vehicle"] = "vehicle";
    TrackingSubjectType["Animal"] = "animal";
    TrackingSubjectType["Object"] = "object";
    TrackingSubjectType["Background"] = "background";
})(TrackingSubjectType || (TrackingSubjectType = {}));
export class MotionIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MotionIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map