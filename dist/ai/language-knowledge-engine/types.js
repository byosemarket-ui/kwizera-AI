/**
 * KWIZERA AI STUDIO — Language Knowledge Engine types (Step 4J)
 */
export var KnowledgeSupportedLanguage;
(function (KnowledgeSupportedLanguage) {
    KnowledgeSupportedLanguage["Kinyarwanda"] = "rw";
    KnowledgeSupportedLanguage["English"] = "en";
    KnowledgeSupportedLanguage["French"] = "fr";
    KnowledgeSupportedLanguage["Swahili"] = "sw";
    KnowledgeSupportedLanguage["Arabic"] = "ar";
    KnowledgeSupportedLanguage["Spanish"] = "es";
    KnowledgeSupportedLanguage["Portuguese"] = "pt";
    KnowledgeSupportedLanguage["German"] = "de";
    KnowledgeSupportedLanguage["Chinese"] = "zh";
    KnowledgeSupportedLanguage["Japanese"] = "ja";
    KnowledgeSupportedLanguage["Future"] = "future";
})(KnowledgeSupportedLanguage || (KnowledgeSupportedLanguage = {}));
export var LanguageWritingStyle;
(function (LanguageWritingStyle) {
    LanguageWritingStyle["Formal"] = "formal";
    LanguageWritingStyle["Informal"] = "informal";
    LanguageWritingStyle["Marketing"] = "marketing";
    LanguageWritingStyle["Business"] = "business";
    LanguageWritingStyle["Creative"] = "creative";
    LanguageWritingStyle["Storytelling"] = "storytelling";
    LanguageWritingStyle["Technical"] = "technical";
})(LanguageWritingStyle || (LanguageWritingStyle = {}));
export var LanguageScriptType;
(function (LanguageScriptType) {
    LanguageScriptType["Headline"] = "headline";
    LanguageScriptType["Hook"] = "hook";
    LanguageScriptType["Cta"] = "cta";
    LanguageScriptType["ProductDescription"] = "product-description";
    LanguageScriptType["PromotionalScript"] = "promotional-script";
    LanguageScriptType["SocialCaption"] = "social-caption";
    LanguageScriptType["Advertisement"] = "advertisement";
    LanguageScriptType["EmailMarketing"] = "email-marketing";
    LanguageScriptType["WebsiteContent"] = "website-content";
    LanguageScriptType["VoiceOver"] = "voice-over";
    LanguageScriptType["Narration"] = "narration";
    LanguageScriptType["Subtitle"] = "subtitle";
    LanguageScriptType["Caption"] = "caption";
})(LanguageScriptType || (LanguageScriptType = {}));
export var LanguageMarketingGoal;
(function (LanguageMarketingGoal) {
    LanguageMarketingGoal["Conversion"] = "conversion";
    LanguageMarketingGoal["Awareness"] = "awareness";
    LanguageMarketingGoal["Engagement"] = "engagement";
    LanguageMarketingGoal["Education"] = "education";
    LanguageMarketingGoal["Retention"] = "retention";
})(LanguageMarketingGoal || (LanguageMarketingGoal = {}));
export class LanguageKnowledgeEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "LanguageKnowledgeEngineError";
    }
}
//# sourceMappingURL=types.js.map