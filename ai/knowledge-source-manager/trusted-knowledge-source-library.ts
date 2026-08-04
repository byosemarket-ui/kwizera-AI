import type { KnowledgeSourceDefinition, TrustedKnowledgeSourceEntry } from "./types.js";

function entry(
  id: string,
  name: string,
  description: string,
  category: string,
  url: string,
  type: KnowledgeSourceDefinition["type"],
  publisher: string
): TrustedKnowledgeSourceEntry {
  const definition: KnowledgeSourceDefinition = {
    id,
    name,
    description,
    type,
    location: { kind: "url", value: url },
    tags: [category],
    publisher,
  };
  return { definition, category };
}

/**
 * Curated, pre-vetted library of well-known real-world documentation sources.
 * Entries are NOT auto-trusted: `seedTrustedKnowledgeSourceLibrary` only registers them
 * (status "pending"); an explicit `approve()` call is still required before AI Me may use them.
 */
export const TRUSTED_SOURCE_LIBRARY: TrustedKnowledgeSourceEntry[] = [
  entry(
    "huggingface-docs",
    "Hugging Face Documentation",
    "Official documentation for Hugging Face models, datasets, and libraries.",
    "AI/ML",
    "https://huggingface.co/docs",
    "official-api-documentation",
    "Hugging Face"
  ),
  entry(
    "pytorch-docs",
    "PyTorch Documentation",
    "Official PyTorch API and framework documentation.",
    "AI/ML",
    "https://pytorch.org/docs/stable/index.html",
    "official-documentation",
    "PyTorch"
  ),
  entry(
    "tensorflow-docs",
    "TensorFlow Documentation",
    "Official TensorFlow API documentation.",
    "AI/ML",
    "https://www.tensorflow.org/api_docs",
    "official-documentation",
    "Google (TensorFlow)"
  ),
  entry(
    "onnx-docs",
    "ONNX Documentation",
    "Official Open Neural Network Exchange format documentation.",
    "AI/ML",
    "https://onnx.ai/onnx/",
    "official-documentation",
    "ONNX"
  ),
  entry(
    "comfyui-docs",
    "ComfyUI Documentation",
    "Official documentation for the ComfyUI node-based image/video generation interface.",
    "Image/Video",
    "https://docs.comfy.org/",
    "official-documentation",
    "Comfy-Org"
  ),
  entry(
    "automatic1111-docs",
    "AUTOMATIC1111 Stable Diffusion WebUI Documentation",
    "Official project wiki documentation for the AUTOMATIC1111 Stable Diffusion WebUI.",
    "Image/Video",
    "https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki",
    "official-documentation",
    "AUTOMATIC1111"
  ),
  entry(
    "ffmpeg-docs",
    "FFmpeg Documentation",
    "Official FFmpeg multimedia framework documentation.",
    "Image/Video",
    "https://ffmpeg.org/documentation.html",
    "official-documentation",
    "FFmpeg"
  ),
  entry(
    "opencv-docs",
    "OpenCV Documentation",
    "Official OpenCV computer vision library documentation.",
    "Computer Vision",
    "https://docs.opencv.org/",
    "official-documentation",
    "OpenCV"
  ),
  entry(
    "blender-docs",
    "Blender Documentation",
    "Official Blender 3D creation suite manual.",
    "Image/Video",
    "https://docs.blender.org/",
    "official-documentation",
    "Blender Foundation"
  ),
  entry(
    "mdn-docs",
    "MDN Web Docs",
    "Mozilla Developer Network reference documentation for web technologies.",
    "Programming",
    "https://developer.mozilla.org/en-US/",
    "official-documentation",
    "Mozilla"
  ),
  entry(
    "nodejs-docs",
    "Node.js API Documentation",
    "Official Node.js runtime API documentation.",
    "Programming",
    "https://nodejs.org/docs/latest/api/",
    "official-api-documentation",
    "OpenJS Foundation"
  ),
  entry(
    "typescript-docs",
    "TypeScript Documentation",
    "Official TypeScript language handbook and reference.",
    "Programming",
    "https://www.typescriptlang.org/docs/",
    "official-documentation",
    "Microsoft"
  ),
  entry(
    "react-docs",
    "React Documentation",
    "Official React library reference documentation.",
    "Programming",
    "https://react.dev/reference/react",
    "official-documentation",
    "Meta (React)"
  ),
  entry(
    "express-docs",
    "Express Documentation",
    "Official Express.js web framework API documentation.",
    "Programming",
    "https://expressjs.com/en/4x/api.html",
    "official-api-documentation",
    "OpenJS Foundation"
  ),
  entry(
    "sqlite-docs",
    "SQLite Documentation",
    "Official SQLite database engine documentation.",
    "Programming",
    "https://www.sqlite.org/docs.html",
    "official-documentation",
    "SQLite Consortium"
  ),
  entry(
    "ultralytics-docs",
    "Ultralytics Documentation",
    "Official Ultralytics YOLO computer vision model documentation.",
    "Computer Vision",
    "https://docs.ultralytics.com/",
    "official-documentation",
    "Ultralytics"
  ),
  entry(
    "google-search-docs",
    "Google Search Central Documentation",
    "Official Google Search API and SEO documentation.",
    "Marketing",
    "https://developers.google.com/search/docs",
    "official-api-documentation",
    "Google"
  ),
  entry(
    "google-analytics-docs",
    "Google Analytics Documentation",
    "Official Google Analytics API and product documentation.",
    "Marketing",
    "https://developers.google.com/analytics",
    "official-api-documentation",
    "Google"
  ),
  entry(
    "meta-business-docs",
    "Meta Business & Marketing API Documentation",
    "Official Meta documentation for Marketing and Business APIs.",
    "Social Platforms",
    "https://developers.facebook.com/docs/marketing-apis",
    "official-api-documentation",
    "Meta"
  ),
  entry(
    "facebook-developer-docs",
    "Facebook for Developers Documentation",
    "Official Facebook Platform developer documentation.",
    "Social Platforms",
    "https://developers.facebook.com/docs",
    "official-api-documentation",
    "Meta"
  ),
  entry(
    "instagram-platform-docs",
    "Instagram Platform Documentation",
    "Official Instagram Graph API and platform documentation.",
    "Social Platforms",
    "https://developers.facebook.com/docs/instagram",
    "official-api-documentation",
    "Meta"
  ),
  entry(
    "youtube-api-docs",
    "YouTube Data API Documentation",
    "Official YouTube Data API v3 reference documentation.",
    "Social Platforms",
    "https://developers.google.com/youtube/v3",
    "official-api-documentation",
    "Google (YouTube)"
  ),
  entry(
    "tiktok-developer-docs",
    "TikTok for Developers Documentation",
    "Official TikTok developer platform and API documentation.",
    "Social Platforms",
    "https://developers.tiktok.com/doc/overview",
    "official-api-documentation",
    "TikTok"
  ),
  entry(
    "arxiv",
    "arXiv",
    "Open-access repository of scholarly research papers across scientific disciplines.",
    "Academic",
    "https://arxiv.org",
    "research-paper",
    "Cornell University"
  ),
  entry(
    "crossref-docs",
    "Crossref Documentation",
    "Official Crossref scholarly metadata and DOI registration documentation.",
    "Academic",
    "https://www.crossref.org/documentation/",
    "official-api-documentation",
    "Crossref"
  ),
];

/** Hostname each library entry is expected to resolve to, used for domain-consistency checks. */
export function trustedLibraryHostname(entryId: string): string | null {
  const found = TRUSTED_SOURCE_LIBRARY.find((item) => item.definition.id === entryId);
  if (!found || found.definition.location.kind !== "url") return null;
  try {
    return new URL(found.definition.location.value).hostname;
  } catch {
    return null;
  }
}
