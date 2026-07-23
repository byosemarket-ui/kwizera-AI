/**
 * KWIZERA AI STUDIO — Ambient Audio Generation Engine types (Step 10G)
 */
export var AmbientPlatform;
(function (AmbientPlatform) {
    AmbientPlatform["Website"] = "website";
    AmbientPlatform["Mobile"] = "mobile";
    AmbientPlatform["YouTube"] = "youtube";
    AmbientPlatform["TikTok"] = "tiktok";
    AmbientPlatform["Instagram"] = "instagram";
    AmbientPlatform["Facebook"] = "facebook";
    AmbientPlatform["Television"] = "television";
    AmbientPlatform["Radio"] = "radio";
})(AmbientPlatform || (AmbientPlatform = {}));
export var EnvironmentCategory;
(function (EnvironmentCategory) {
    EnvironmentCategory["Nature"] = "nature";
    EnvironmentCategory["Urban"] = "urban";
    EnvironmentCategory["Indoor"] = "indoor";
    EnvironmentCategory["Weather"] = "weather";
    EnvironmentCategory["Mixed"] = "mixed";
})(EnvironmentCategory || (EnvironmentCategory = {}));
export var NatureAmbienceType;
(function (NatureAmbienceType) {
    NatureAmbienceType["Forest"] = "forest";
    NatureAmbienceType["Rain"] = "rain";
    NatureAmbienceType["Wind"] = "wind";
    NatureAmbienceType["Ocean"] = "ocean";
    NatureAmbienceType["River"] = "river";
    NatureAmbienceType["Waterfall"] = "waterfall";
    NatureAmbienceType["Birds"] = "birds";
    NatureAmbienceType["Insects"] = "insects";
    NatureAmbienceType["Fire"] = "fire";
    NatureAmbienceType["Thunder"] = "thunder";
})(NatureAmbienceType || (NatureAmbienceType = {}));
export var UrbanAmbienceType;
(function (UrbanAmbienceType) {
    UrbanAmbienceType["City"] = "city";
    UrbanAmbienceType["Traffic"] = "traffic";
    UrbanAmbienceType["Market"] = "market";
    UrbanAmbienceType["Airport"] = "airport";
    UrbanAmbienceType["TrainStation"] = "train-station";
    UrbanAmbienceType["BusStation"] = "bus-station";
    UrbanAmbienceType["Construction"] = "construction";
    UrbanAmbienceType["ShoppingMall"] = "shopping-mall";
    UrbanAmbienceType["Stadium"] = "stadium";
})(UrbanAmbienceType || (UrbanAmbienceType = {}));
export var IndoorAmbienceType;
(function (IndoorAmbienceType) {
    IndoorAmbienceType["Office"] = "office";
    IndoorAmbienceType["Home"] = "home";
    IndoorAmbienceType["Classroom"] = "classroom";
    IndoorAmbienceType["Hospital"] = "hospital";
    IndoorAmbienceType["Restaurant"] = "restaurant";
    IndoorAmbienceType["Hotel"] = "hotel";
    IndoorAmbienceType["Church"] = "church";
    IndoorAmbienceType["ConferenceRoom"] = "conference-room";
    IndoorAmbienceType["Factory"] = "factory";
})(IndoorAmbienceType || (IndoorAmbienceType = {}));
export var WeatherType;
(function (WeatherType) {
    WeatherType["LightRain"] = "light-rain";
    WeatherType["HeavyRain"] = "heavy-rain";
    WeatherType["Storm"] = "storm";
    WeatherType["Wind"] = "wind";
    WeatherType["Snow"] = "snow";
    WeatherType["Fog"] = "fog";
    WeatherType["Sunrise"] = "sunrise";
    WeatherType["Sunset"] = "sunset";
    WeatherType["Night"] = "night";
    WeatherType["Dawn"] = "dawn";
})(WeatherType || (WeatherType = {}));
export var AmbientSyncTarget;
(function (AmbientSyncTarget) {
    AmbientSyncTarget["Video"] = "video";
    AmbientSyncTarget["Animation"] = "animation";
    AmbientSyncTarget["Film"] = "film";
    AmbientSyncTarget["Podcast"] = "podcast";
    AmbientSyncTarget["Game"] = "game";
    AmbientSyncTarget["Advertisement"] = "advertisement";
    AmbientSyncTarget["Presentation"] = "presentation";
})(AmbientSyncTarget || (AmbientSyncTarget = {}));
export var AmbientInputType;
(function (AmbientInputType) {
    AmbientInputType["EnvironmentPrompt"] = "environment-prompt";
    AmbientInputType["VideoInformation"] = "video-information";
    AmbientInputType["ImageInformation"] = "image-information";
    AmbientInputType["Timeline"] = "timeline";
    AmbientInputType["BrandGuidelines"] = "brand-guidelines";
    AmbientInputType["Campaign"] = "campaign";
    AmbientInputType["GeographicContext"] = "geographic-context";
    AmbientInputType["KnowledgeRecord"] = "knowledge-record";
})(AmbientInputType || (AmbientInputType = {}));
export class AmbientAudioGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AmbientAudioGenerationEngineError";
    }
}
export const ALL_AMBIENT_PLATFORMS = [
    AmbientPlatform.Website,
    AmbientPlatform.Mobile,
    AmbientPlatform.YouTube,
    AmbientPlatform.TikTok,
    AmbientPlatform.Instagram,
    AmbientPlatform.Facebook,
    AmbientPlatform.Television,
    AmbientPlatform.Radio,
];
export const SUPPORTED_ENVIRONMENT_CATEGORIES = [
    EnvironmentCategory.Nature,
    EnvironmentCategory.Urban,
    EnvironmentCategory.Indoor,
    EnvironmentCategory.Weather,
    EnvironmentCategory.Mixed,
];
export const NATURE_AMBIENCE_TYPES = Object.values(NatureAmbienceType);
export const URBAN_AMBIENCE_TYPES = Object.values(UrbanAmbienceType);
export const INDOOR_AMBIENCE_TYPES = Object.values(IndoorAmbienceType);
export const WEATHER_TYPES = Object.values(WeatherType);
export const PLATFORM_AMBIENT_CONFIG = {
    [AmbientPlatform.Website]: { maxDurationSec: 300, loopRecommended: true, formatNotes: "Seamless background loop" },
    [AmbientPlatform.Mobile]: { maxDurationSec: 180, loopRecommended: true, formatNotes: "Low CPU ambient bed" },
    [AmbientPlatform.YouTube]: { maxDurationSec: 600, loopRecommended: false, formatNotes: "Full environmental arc" },
    [AmbientPlatform.TikTok]: { maxDurationSec: 60, loopRecommended: true, formatNotes: "Short immersive loop" },
    [AmbientPlatform.Instagram]: { maxDurationSec: 90, loopRecommended: true, formatNotes: "Atmospheric bed" },
    [AmbientPlatform.Facebook]: { maxDurationSec: 120, loopRecommended: true, formatNotes: "Subtle ambient layer" },
    [AmbientPlatform.Television]: { maxDurationSec: 180, loopRecommended: false, formatNotes: "Broadcast ambience" },
    [AmbientPlatform.Radio]: { maxDurationSec: 300, loopRecommended: true, formatNotes: "Continuous ambient bed" },
};
//# sourceMappingURL=types.js.map