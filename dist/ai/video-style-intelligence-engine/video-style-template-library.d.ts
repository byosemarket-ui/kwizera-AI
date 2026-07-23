import { CinematicStyleClass, StyleTemplate } from "./types.js";
import { VideoAnalysisType } from "../video-analysis-engine/types.js";
declare const BASE_TEMPLATES: Omit<StyleTemplate, "matchScore">[];
export declare class VideoStyleTemplateLibrary {
    getAllTemplates(): Omit<StyleTemplate, "matchScore">[];
    matchTemplates(videoType: VideoAnalysisType, cinematicStyles: CinematicStyleClass[], platformHint?: string): StyleTemplate[];
    private scoreTemplate;
}
export { BASE_TEMPLATES };
//# sourceMappingURL=video-style-template-library.d.ts.map