# AI Video & Audio Generation Runtime

This runtime produces persisted marketing-video packages from Creative Planning storyboards, scripts, prompts, and generated image assets. A package contains an animated SVG preview, real WAV narration/music/SFX mix, WebVTT subtitles, scene timeline, synchronization metadata, quality report, history, and cache entry.

No local MP4/WebM encoder is present in this environment. The animated preview is therefore the executable visual artifact, while the `AiVideoGenerator` boundary is designed for a future encoded-video provider without changing UI, asset lifecycle, model selection, synchronization, or history contracts.