/**
 * KWIZERA AI STUDIO — Target Audience Intelligence Engine types (Step 5D)
 */
export var AudiencePlatform;
(function (AudiencePlatform) {
    AudiencePlatform["TikTok"] = "tiktok";
    AudiencePlatform["Instagram"] = "instagram";
    AudiencePlatform["Facebook"] = "facebook";
    AudiencePlatform["YouTube"] = "youtube";
    AudiencePlatform["WhatsApp"] = "whatsapp";
    AudiencePlatform["Website"] = "website";
    AudiencePlatform["Future"] = "future-platforms";
})(AudiencePlatform || (AudiencePlatform = {}));
export var AudienceCategory;
(function (AudienceCategory) {
    AudienceCategory["B2BProfessional"] = "b2b-professional";
    AudienceCategory["B2CConsumer"] = "b2c-consumer";
    AudienceCategory["D2CDirect"] = "d2c-direct";
    AudienceCategory["Enterprise"] = "enterprise";
    AudienceCategory["Marketplace"] = "marketplace";
    AudienceCategory["Subscription"] = "subscription";
    AudienceCategory["General"] = "general";
})(AudienceCategory || (AudienceCategory = {}));
export class AudienceIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudienceIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map