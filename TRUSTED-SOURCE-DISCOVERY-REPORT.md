# Trusted Source Discovery Report

**KWIZERA AI STUDIO — Knowledge Seeding Step 2**  
**Generated:** 2026-08-05  
**Scope:** Discover, classify, and rank trusted sources only — no downloads

---

## Verdict

Trusted Source Discovery extends the existing Knowledge Source Manager. **25 existing sources were upgraded**, **27 new sources were registered**, and **26/26 discovery topics** now have coverage. All sources remain **pending** until explicit approval. Nothing was downloaded or auto-approved.

---

## 1. Existing Sources Found

The original curated library (25 entries) was inspected and kept:

| Category | Examples |
|----------|----------|
| AI/ML | Hugging Face, PyTorch, TensorFlow, ONNX |
| Image/Video | ComfyUI, AUTOMATIC1111, FFmpeg, Blender |
| Computer Vision | OpenCV, Ultralytics |
| Programming | MDN, Node.js, TypeScript, React, Express, SQLite |
| Marketing | Google Search Central, Google Analytics |
| Social Platforms | Meta Business, Facebook, Instagram, YouTube, TikTok developer docs |
| Academic | arXiv, Crossref |

---

## 2. Sources Upgraded

All 25 existing entries were upgraded with discovery metadata:

- `category`
- `domainIds` (linked to Knowledge Domain Planning)
- `officialWebsite`
- `resourceType`
- `language`
- `trustClass`
- `updateFrequency`
- `accessMethod`
- `license`
- `lastUpdated`

Status remains **pending** (never auto-approved).

---

## 3. New Sources Registered

**27 new** professional sources added for creative, production, marketing, and commerce coverage, including:

| Source ID | Name | Trust Class |
|-----------|------|-------------|
| `adobe-camera-raw-docs` | Adobe Camera Raw Documentation | trusted |
| `canon-learning-center` | Canon USA Learning Resources | trusted |
| `nikon-learn-explore` | Nikon Learn & Explore | trusted |
| `davinci-resolve-manual` | DaVinci Resolve Reference Manual | highly-trusted |
| `premiere-pro-user-guide` | Adobe Premiere Pro User Guide | trusted |
| `after-effects-user-guide` | Adobe After Effects User Guide | trusted |
| `cinema4d-manual` | Maxon Cinema 4D Documentation | official |
| `unreal-engine-docs` | Unreal Engine Documentation | official |
| `audiokinetic-wwise-docs` | Audiokinetic Wwise Documentation | official |
| `ableton-live-manual` | Ableton Live Manual | trusted |
| `aes-standards` | Audio Engineering Society Standards | highly-trusted |
| `smpte-standards` | SMPTE Standards | highly-trusted |
| `asc-cinematography` | ASC Resources | trusted |
| `pixar-storytelling` | Pixar in a Box — Storytelling | trusted |
| `nngroup-ux` | Nielsen Norman Group UX Articles | highly-trusted |
| `w3c-wai` | W3C Web Accessibility Initiative | highly-trusted |
| `shopify-commerce-docs` | Shopify Commerce Documentation | official |
| `google-merchant-center-docs` | Google Merchant Center Documentation | official |
| `hubspot-marketing-library` | HubSpot Marketing Library | trusted |
| `ama-marketing` | American Marketing Association Resources | trusted |
| `apa-psychology` | APA Resources | trusted |
| `branding-iso-guidelines` | ISO Brand-Related Standards Overview | highly-trusted |
| `youtube-creator-academy` | YouTube Creator Academy | trusted |
| `meta-blueprint` | Meta Blueprint | trusted |
| `tiktok-academy` | TikTok Creative Center / Academy | trusted |
| `cie-lighting` | CIE Lighting Standards | highly-trusted |
| `aws-well-architected` | AWS Well-Architected Framework | trusted |

**Catalog total:** 52 sources

---

## 4. Source Categories

Discovery categories include:

AI/ML, Image/Video, Computer Vision, Programming, Marketing, Social Platforms, Academic, Photography, Video Editing, Motion Graphics, Animation, Rendering, Audio, Music, Video Production, Cinematography, Storytelling, UI/UX, E-commerce, Psychology, Branding, Lighting, Software Engineering

**Supported resource types:**

- Official Documentation
- Official API Documentation
- Technical Manuals / Standards
- User Manuals
- Research Papers
- White Papers
- Open Educational Resources *(new)*
- User-approved Websites
- Company Documents *(new)*
- Existing Knowledge Packs (`knowledge-foundation`)

---

## 5. Trust Scores

Trust scores come from static verification using acquisition reliability baselines by source type (e.g. official documentation ≈ 95, research papers ≈ 90).

Every catalog source:

- Passes static HTTPS/path verification
- Receives a trust score
- Stays **pending** until explicit `approve()`

**Trust tiers (automatic classification):**

| Tier | Meaning |
|------|---------|
| Official | Official docs / API docs |
| Highly Trusted | Standards, research, technical manuals, foundation packs |
| Trusted | White papers, manuals, OERs |
| Community | Approved websites / community docs |
| User Provided | Local/user/company documents |

Unknown or low-quality sources are **never auto-approved**.

---

## 6. Quality Scores

Quality composite (unchanged engine, extended inputs):

`0.3 trust + 0.25 reputation + 0.2 completeness + 0.15 freshness + 0.1 confidence`

Reputation now includes trust-class boosts. Completeness/confidence include discovery fields (category, domainIds, official website, language, update frequency, access method).

---

## 7. Coverage of Each Knowledge Domain / Discovery Topic

**26/26 topics covered:**

| Topic | Coverage |
|-------|----------|
| Artificial Intelligence | covered |
| Machine Learning | covered |
| Product Photography | covered |
| Video Production | covered |
| Camera | covered |
| Lighting | covered |
| Composition | covered |
| Storytelling | covered |
| Animation | covered |
| Motion Graphics | covered |
| Rendering | covered |
| Video Editing | covered |
| Audio | covered |
| Music | covered |
| Marketing | covered |
| Branding | covered |
| Customer Psychology | covered |
| Sales Psychology | covered |
| Social Media | covered |
| TikTok | covered |
| Instagram | covered |
| Facebook | covered |
| YouTube | covered |
| E-commerce | covered |
| UI/UX | covered |
| Software Engineering | covered |

Topics link to Knowledge Domain Planning IDs (e.g. `video-production-knowledge`, `tiktok-knowledge`).

---

## 8. Missing Trusted Sources

After this discovery pass: **0 topics with missing coverage**.

Weak-coverage detection remains available via `detectMissingTrustedSources()` for future expansion when only a single source backs a topic.

---

## AI Me Integration

AI Me can:

| Capability | API / Intent |
|------------|--------------|
| Recommend best source | `recommendBestTrustedSource(topic)` |
| Explain selection | `explainTrustedSourceSelection(topic)` |
| Detect missing sources | `detectMissingTrustedSources()` |
| Recommend additional sources | `recommendAdditionalTrustedSources(topic)` |
| Conversation intent | `knowledge-sources` |

Example awareness summary:

> Trusted source discovery: 52 source(s) registered, 26/26 topics covered, 0 topic gap(s). Sources remain pending until explicit approval — nothing is auto-approved.

---

## Implementation Map

| Component | Path |
|-----------|------|
| Extended source schema | `ai/knowledge-source-manager/types.ts` |
| Trust classifier | `ai/knowledge-source-manager/trusted-source-classifier.ts` |
| Discovery topics | `ai/knowledge-source-manager/trusted-source-discovery-topics.ts` |
| Expanded catalog | `ai/knowledge-source-manager/trusted-knowledge-source-library.ts` |
| Discovery service | `ai/knowledge-source-manager/trusted-source-discovery.ts` |
| Manager upgrade | `ai/knowledge-source-manager/knowledge-source-manager.ts` |
| AI Me conversation | `ai/conversation/conversation-engine.ts` |
| Validation | `npm run validate:trusted-source-discovery` |

---

## Totals

| Metric | Count |
|--------|-------|
| Existing sources found/upgraded | 25 |
| New sources registered | 27 |
| Catalog size | 52 |
| Discovery topics | 26 |
| Topics covered | 26 |
| Topics missing | 0 |
| Auto-approved | 0 |
| Downloads performed | 0 |

---

## Explicit Non-Goals (This Step)

- No resource downloading
- No knowledge import into Foundation records
- No auto-approval of pending sources

**Next steps (later):** approve selected sources, then research/download gated content into planned knowledge domains.
