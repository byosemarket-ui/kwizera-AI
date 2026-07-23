import { CreativeVideoTemplate, CreativeVideoType } from "./types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
export declare class CreativeVideoTemplateLibrary {
    getAllTemplates(): Omit<CreativeVideoTemplate, "matchScore">[];
    matchTemplates(videoType: VideoAnalysisType, creativeType: CreativeVideoType, industry?: string): CreativeVideoTemplate[];
    private scoreTemplate;
}
//# sourceMappingURL=creative-video-template-library.d.ts.map