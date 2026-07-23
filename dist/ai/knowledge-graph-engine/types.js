/**
 * KWIZERA AI STUDIO — Knowledge Graph Engine types (Step 4D)
 */
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export var KnowledgeNodeType;
(function (KnowledgeNodeType) {
    KnowledgeNodeType["Product"] = "product";
    KnowledgeNodeType["Image"] = "image";
    KnowledgeNodeType["Video"] = "video";
    KnowledgeNodeType["MarketingCampaign"] = "marketing-campaign";
    KnowledgeNodeType["Brand"] = "brand";
    KnowledgeNodeType["Language"] = "language";
    KnowledgeNodeType["CreativeStyle"] = "creative-style";
    KnowledgeNodeType["Workflow"] = "workflow";
    KnowledgeNodeType["Project"] = "project";
    KnowledgeNodeType["Decision"] = "decision";
    KnowledgeNodeType["Reasoning"] = "reasoning";
    KnowledgeNodeType["Learning"] = "learning";
    KnowledgeNodeType["MemoryObject"] = "memory-object";
    KnowledgeNodeType["BusinessConcept"] = "business-concept";
    KnowledgeNodeType["UserPreference"] = "user-preference";
    KnowledgeNodeType["Technical"] = "technical";
    KnowledgeNodeType["Industry"] = "industry";
})(KnowledgeNodeType || (KnowledgeNodeType = {}));
export var KnowledgeRelationType;
(function (KnowledgeRelationType) {
    KnowledgeRelationType["BelongsTo"] = "belongs-to";
    KnowledgeRelationType["PartOf"] = "part-of";
    KnowledgeRelationType["Uses"] = "uses";
    KnowledgeRelationType["Produces"] = "produces";
    KnowledgeRelationType["DependsOn"] = "depends-on";
    KnowledgeRelationType["SimilarTo"] = "similar-to";
    KnowledgeRelationType["RelatedTo"] = "related-to";
    KnowledgeRelationType["DerivedFrom"] = "derived-from";
    KnowledgeRelationType["InspiredBy"] = "inspired-by";
    KnowledgeRelationType["Improves"] = "improves";
    KnowledgeRelationType["Requires"] = "requires";
    KnowledgeRelationType["RecommendedWith"] = "recommended-with";
    KnowledgeRelationType["FrequentlyUsedTogether"] = "frequently-used-together";
    KnowledgeRelationType["Parent"] = "parent";
    KnowledgeRelationType["Child"] = "child";
})(KnowledgeRelationType || (KnowledgeRelationType = {}));
export var GraphValidationStatus;
(function (GraphValidationStatus) {
    GraphValidationStatus["Valid"] = "valid";
    GraphValidationStatus["Pending"] = "pending";
    GraphValidationStatus["Invalid"] = "invalid";
    GraphValidationStatus["Repaired"] = "repaired";
})(GraphValidationStatus || (GraphValidationStatus = {}));
export class KnowledgeGraphEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "KnowledgeGraphEngineError";
    }
}
export function mapStorageTypeToNodeType(type) {
    const map = {
        [KnowledgeStorageType.Product]: KnowledgeNodeType.Product,
        [KnowledgeStorageType.Image]: KnowledgeNodeType.Image,
        [KnowledgeStorageType.Video]: KnowledgeNodeType.Video,
        [KnowledgeStorageType.Marketing]: KnowledgeNodeType.MarketingCampaign,
        [KnowledgeStorageType.Brand]: KnowledgeNodeType.Brand,
        [KnowledgeStorageType.Language]: KnowledgeNodeType.Language,
        [KnowledgeStorageType.Creative]: KnowledgeNodeType.CreativeStyle,
        [KnowledgeStorageType.Technical]: KnowledgeNodeType.Technical,
        [KnowledgeStorageType.Business]: KnowledgeNodeType.BusinessConcept,
        [KnowledgeStorageType.Workflow]: KnowledgeNodeType.Workflow,
        [KnowledgeStorageType.Decision]: KnowledgeNodeType.Decision,
        [KnowledgeStorageType.Reasoning]: KnowledgeNodeType.Reasoning,
        [KnowledgeStorageType.Industry]: KnowledgeNodeType.Industry,
    };
    return map[type];
}
//# sourceMappingURL=types.js.map