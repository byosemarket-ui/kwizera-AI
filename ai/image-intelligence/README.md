# Image Intelligence Runtime

This runtime produces a persisted profile for every uploaded Creative Workspace product image. It records file-evidence quality, background classification, lighting, shadow, reflection, camera angle, composition, perspective, object labels, scene context, defects, enhancement decisions, analytics, history, and cache state.

Local analysis is deliberately limited to workspace evidence, filename cues, MIME type, and source size. Pixel-dependent observations are marked for visual-provider verification so a future computer-vision adapter can implement them without changing the stored profile contract.