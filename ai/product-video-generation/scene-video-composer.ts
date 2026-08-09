import type { StoryboardMarketingBeat, StoryboardScenePanel } from "../product-storyboard/types.js";
import type { CameraMove, MarketingFlowBeat, VisualEffect } from "./types.js";

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const FRAME_RATE = 30;

const REQUIRED_FLOW: MarketingFlowBeat[] = [
  "hook",
  "product-reveal",
  "feature-showcase",
  "benefits",
  "brand-presence",
  "price-presentation",
  "offer",
  "call-to-action",
];

/** Map storyboard camera text to an executable camera move. */
export function resolveCameraMove(panel: StoryboardScenePanel, cameraPrompt: string): { move: CameraMove; why: string } {
  const text = `${panel.cameraMovement} ${panel.visual.cameraInstructions} ${cameraPrompt}`.toLowerCase();
  if (/orbit|rotate around|product rotation|spin/.test(text)) {
    return { move: "product-rotation", why: "Storyboard requests product rotation / orbit around the real product." };
  }
  if (/push.?in|push in|zoom in/.test(text)) return { move: "push-in", why: "Storyboard camera language indicates a push-in." };
  if (/pull.?out|pull out|zoom out/.test(text)) return { move: "pull-out", why: "Storyboard camera language indicates a pull-out." };
  if (/dolly/.test(text)) return { move: "dolly", why: "Storyboard specifies a dolly move." };
  if (/truck/.test(text)) return { move: "truck", why: "Storyboard specifies a truck move." };
  if (/tilt/.test(text)) return { move: "tilt", why: "Storyboard specifies a tilt." };
  if (/crane|rise|elevate/.test(text)) return { move: "crane", why: "Storyboard specifies a crane/elevate move." };
  if (/handheld|organic|subtle shake/.test(text)) return { move: "handheld", why: "Storyboard specifies handheld energy." };
  if (/pan/.test(text)) return { move: "pan", why: "Storyboard specifies a pan." };
  if (/orbit/.test(text)) return { move: "orbit", why: "Storyboard specifies an orbit." };
  // Default by marketing beat
  if (panel.marketingBeat === "attention") return { move: "push-in", why: "Hook scene defaults to push-in for focus." };
  if (panel.marketingBeat === "call-to-action") return { move: "pull-out", why: "CTA scene defaults to pull-out for brand frame." };
  return { move: "dolly", why: "Default cinematic dolly preserving product framing from storyboard." };
}

export function mapMarketingBeat(beat: StoryboardMarketingBeat, scenePurpose: string): { beat: MarketingFlowBeat; why: string } {
  const purpose = scenePurpose.toLowerCase();
  if (beat === "attention" || /hook|open/.test(purpose)) {
    return { beat: "hook", why: "Opening attention beat drives the marketing hook." };
  }
  if (beat === "interest" || /reveal|introduce/.test(purpose)) {
    return { beat: "product-reveal", why: "Interest/reveal beat presents the real product." };
  }
  if (beat === "desire" || /feature|showcase/.test(purpose)) {
    return { beat: "feature-showcase", why: "Desire beat showcases product features from confirmed assets." };
  }
  if (beat === "trust" || /benefit|proof|quality/.test(purpose)) {
    return { beat: "benefits", why: "Trust/benefit beat communicates value without inventing features." };
  }
  if (beat === "product-value" || /brand/.test(purpose)) {
    return { beat: "brand-presence", why: "Product-value beat reinforces brand presence." };
  }
  if (beat === "price") return { beat: "price-presentation", why: "Price beat presents confirmed pricing only." };
  if (beat === "offer") return { beat: "offer", why: "Offer beat presents campaign offer copy." };
  if (beat === "call-to-action") return { beat: "call-to-action", why: "CTA beat closes with campaign call to action." };
  return { beat: "feature-showcase", why: "Scene supports feature storytelling within marketing flow." };
}

export function selectEffects(panel: StoryboardScenePanel, videoPrompt: string): { effects: VisualEffect[]; why: string } {
  const text = `${panel.animationInstructions} ${panel.lightingStyle} ${videoPrompt}`.toLowerCase();
  const effects: VisualEffect[] = ["contact-shadows", "reflections"];
  if (/luxury|premium|gold/.test(text)) effects.push("luxury-presentation", "glow", "product-highlight");
  if (/depth|bokeh|focus/.test(text)) effects.push("depth-of-field");
  if (/motion|fast|dynamic/.test(text)) effects.push("motion-blur");
  if (/lens|flare|anamorphic/.test(text)) effects.push("lens");
  if (!effects.includes("product-highlight")) effects.push("product-highlight");
  return {
    effects: uniqueEffects(effects).slice(0, 5),
    why: "Effects selected only to improve presentation quality while keeping product identity locked.",
  };
}

export function missingMarketingFlow(present: MarketingFlowBeat[]): MarketingFlowBeat[] {
  return REQUIRED_FLOW.filter((beat) => !present.includes(beat));
}

export function requiredMarketingFlow(): MarketingFlowBeat[] {
  return [...REQUIRED_FLOW];
}

/** Offline animated SVG clip: embeds Step 6 still as data URI and applies camera transforms. Product pixels unchanged. */
export function composeSceneVideoSvg(options: {
  productName: string;
  brand: string;
  stillPngBase64: string;
  durationSeconds: number;
  cameraMove: CameraMove;
  effects: VisualEffect[];
  marketingBeat: MarketingFlowBeat;
  onScreenText?: string;
  transition: string;
}): string {
  const w = VIDEO_WIDTH;
  const h = VIDEO_HEIGHT;
  const dur = Math.max(1, options.durationSeconds);
  const transform = cameraAnimation(options.cameraMove, w, h, dur);
  const luxury = options.effects.includes("luxury-presentation") || options.effects.includes("glow");
  const vignette = options.effects.includes("depth-of-field") || options.effects.includes("lens");
  const highlight = options.effects.includes("product-highlight");
  const text = xml(options.onScreenText || options.marketingBeat.replace(/-/g, " "));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${luxury ? "#1a1520" : "#121820"}"/>
      <stop offset="100%" stop-color="${luxury ? "#2a2230" : "#1c2633"}"/>
    </linearGradient>
    <filter id="softGlow"><feGaussianBlur stdDeviation="2.2"/></filter>
    <radialGradient id="vignette" cx="50%" cy="45%" r="65%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.35"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g ${transform.groupAttrs}>
    <image xlink:href="data:image/png;base64,${options.stillPngBase64}" x="${transform.imageX}" y="${transform.imageY}" width="${transform.imageW}" height="${transform.imageH}" preserveAspectRatio="xMidYMid meet">
      ${transform.animate}
    </image>
    ${highlight ? `<rect x="${transform.imageX}" y="${transform.imageY}" width="${transform.imageW}" height="${transform.imageH}" fill="none" stroke="#f0d9a8" stroke-opacity="0.25" stroke-width="3" filter="url(#softGlow)"/>` : ""}
  </g>
  ${vignette ? `<rect width="${w}" height="${h}" fill="url(#vignette)"/>` : ""}
  <text x="${w * 0.06}" y="${h * 0.12}" fill="#f7e7ce" font-family="Georgia, serif" font-size="${w * 0.028}" font-weight="700">${xml(options.brand || options.productName)}</text>
  <text x="${w * 0.06}" y="${h * 0.9}" fill="#ffffff" font-family="Arial, sans-serif" font-size="${w * 0.022}">${text}</text>
  <text x="${w * 0.06}" y="${h * 0.95}" fill="#9aa7b8" font-family="Arial, sans-serif" font-size="${w * 0.016}">transition: ${xml(options.transition)} · camera: ${options.cameraMove} · product preserved</text>
</svg>
`;
}

export function composeAssembledVideoSvg(options: {
  productName: string;
  brand: string;
  clips: Array<{ durationSeconds: number; stillPngBase64: string; cameraMove: CameraMove; marketingBeat: MarketingFlowBeat; onScreenText?: string }>;
}): string {
  const w = VIDEO_WIDTH;
  const h = VIDEO_HEIGHT;
  let cursor = 0;
  const scenes = options.clips.map((clip, index) => {
    const start = cursor;
    const dur = Math.max(1, clip.durationSeconds);
    cursor += dur;
    const transform = cameraAnimation(clip.cameraMove, w, h, dur);
    return `<g opacity="0">
  <set attributeName="opacity" to="1" begin="${start}s" dur="${dur}s"/>
  <set attributeName="opacity" to="0" begin="${start + dur}s"/>
  <rect width="${w}" height="${h}" fill="${index % 2 ? "#16233a" : "#121820"}"/>
  <g ${transform.groupAttrs}>
    <image xlink:href="data:image/png;base64,${clip.stillPngBase64}" x="${transform.imageX}" y="${transform.imageY}" width="${transform.imageW}" height="${transform.imageH}" preserveAspectRatio="xMidYMid meet">
      ${transform.animate}
    </image>
  </g>
  <text x="${w * 0.06}" y="${h * 0.12}" fill="#f7e7ce" font-family="Georgia, serif" font-size="${w * 0.028}" font-weight="700">${xml(options.brand || options.productName)}</text>
  <text x="${w * 0.06}" y="${h * 0.9}" fill="#fff" font-family="Arial, sans-serif" font-size="${w * 0.022}">${xml(clip.onScreenText || clip.marketingBeat)}</text>
</g>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${scenes}
</svg>
`;
}

function cameraAnimation(move: CameraMove, w: number, h: number, dur: number): {
  groupAttrs: string;
  imageX: number;
  imageY: number;
  imageW: number;
  imageH: number;
  animate: string;
} {
  const imageW = w * 0.72;
  const imageH = h * 0.78;
  const imageX = w * 0.14;
  const imageY = h * 0.1;
  const d = Math.max(1, dur);
  switch (move) {
    case "push-in":
      return {
        groupAttrs: "",
        imageX, imageY, imageW, imageH,
        animate: `<animate attributeName="width" from="${imageW}" to="${imageW * 1.12}" dur="${d}s" fill="freeze"/><animate attributeName="height" from="${imageH}" to="${imageH * 1.12}" dur="${d}s" fill="freeze"/><animate attributeName="x" from="${imageX}" to="${imageX - imageW * 0.06}" dur="${d}s" fill="freeze"/><animate attributeName="y" from="${imageY}" to="${imageY - imageH * 0.05}" dur="${d}s" fill="freeze"/>`,
      };
    case "pull-out":
      return {
        groupAttrs: "",
        imageX: imageX - imageW * 0.05, imageY: imageY - imageH * 0.04, imageW: imageW * 1.1, imageH: imageH * 1.1,
        animate: `<animate attributeName="width" from="${imageW * 1.1}" to="${imageW}" dur="${d}s" fill="freeze"/><animate attributeName="height" from="${imageH * 1.1}" to="${imageH}" dur="${d}s" fill="freeze"/><animate attributeName="x" from="${imageX - imageW * 0.05}" to="${imageX}" dur="${d}s" fill="freeze"/><animate attributeName="y" from="${imageY - imageH * 0.04}" to="${imageY}" dur="${d}s" fill="freeze"/>`,
      };
    case "pan":
    case "truck":
      return {
        groupAttrs: "",
        imageX, imageY, imageW, imageH,
        animate: `<animate attributeName="x" from="${imageX + w * 0.04}" to="${imageX - w * 0.04}" dur="${d}s" fill="freeze"/>`,
      };
    case "tilt":
    case "crane":
      return {
        groupAttrs: "",
        imageX, imageY, imageW, imageH,
        animate: `<animate attributeName="y" from="${imageY + h * 0.04}" to="${imageY - h * 0.03}" dur="${d}s" fill="freeze"/>`,
      };
    case "orbit":
    case "product-rotation":
      return {
        groupAttrs: `transform-origin="${w / 2} ${h / 2}"`,
        imageX, imageY, imageW, imageH,
        animate: `<animateTransform attributeName="transform" type="rotate" values="-3;3;-3" dur="${d}s" repeatCount="1"/>`,
      };
    case "handheld":
      return {
        groupAttrs: "",
        imageX, imageY, imageW, imageH,
        animate: `<animate attributeName="x" values="${imageX};${imageX + 6};${imageX - 4};${imageX}" dur="${d}s" repeatCount="1"/><animate attributeName="y" values="${imageY};${imageY - 4};${imageY + 5};${imageY}" dur="${d}s" repeatCount="1"/>`,
      };
    case "dolly":
    default:
      return {
        groupAttrs: "",
        imageX, imageY, imageW, imageH,
        animate: `<animate attributeName="x" from="${imageX + 10}" to="${imageX - 8}" dur="${d}s" fill="freeze"/><animate attributeName="width" from="${imageW}" to="${imageW * 1.05}" dur="${d}s" fill="freeze"/>`,
      };
  }
}

function uniqueEffects(effects: VisualEffect[]): VisualEffect[] {
  return [...new Set(effects)];
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
