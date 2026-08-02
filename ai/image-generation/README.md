# AI Image Generation Runtime

This runtime consumes Creative Workspace product inputs and Creative Planning image prompts to create persisted, browser-renderable SVG marketing compositions. It selects and loads an image model through AI Model Management, tracks history/cache/metadata, validates requests, and preserves source product imagery when selected.

The local marketing composer is a deterministic execution provider for this phase. The `AiImageGenerator` boundary is intentionally provider-ready: a future inference adapter can replace its `compose` implementation without changing prompts, history, model lifecycle, safety, gallery, or pipeline integration.