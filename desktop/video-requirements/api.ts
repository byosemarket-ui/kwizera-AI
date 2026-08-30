export {
  fetchCanonicalProduct,
  fetchMarketingBrief,
  persistMarketingBrief,
  finalizeMarketingBrief,
  analyzeMarketingBrief,
} from "../marketing-input/api.js";

export { fetchWorkspaceApi, openProjectApi, updateProjectApi } from "../product-intake/api.js";

export { readScopedHandoff } from "../product-creation/workflow.js";
export { SETUP_HANDOFF_KEY } from "../product-setup/product-setup-engine.js";
