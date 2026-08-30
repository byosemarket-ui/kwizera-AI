import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clapperboard, Image as ImageIcon,
  Play, Save, Sparkles,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { productProfileEngine } from "./profile-engine";
import { categorySpecHints } from "./types";
import type { ProfileSnapshot } from "./types";
import { listToText, textToList } from "./validation";
import { DisplayList, DisplayText } from "../shared/DisplayValue";
import "./product-profile.css";

type SectionId =
  | "identity"
  | "pricing"
  | "description"
  | "specs"
  | "variants"
  | "ai"
  | "history"
  | "review";

export function ProductInformationWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<ProfileSnapshot>(() => productProfileEngine.snapshot());
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    identity: true,
    pricing: true,
    description: true,
    specs: true,
    variants: false,
    ai: true,
    history: false,
    review: true,
  });
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [variantDraft, setVariantDraft] = useState<{
    kind: "color" | "size" | "model" | "package" | "other";
    label: string;
    values: string;
  }>({ kind: "color", label: "Color", values: "" });

  useEffect(() => {
    productProfileEngine.setNotify(notify);
    productProfileEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product.updated",
        "product-analysis.completed",
        "state.shared",
        "notify.info",
        "production.progress",
      ]);
      const eventType = allowed.has(type) ? type : "product.updated";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product.updated",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace", "marketing"],
        payload,
        priority: "normal",
      });
    });
    const unsub = productProfileEngine.subscribe((next) => {
      setSnap(next);
      setSavePulse(true);
      window.setTimeout(() => setSavePulse(false), 600);
    });
    void productProfileEngine.hydrateFromHandoff();
    return () => {
      unsub();
      productProfileEngine.setNotify(null);
      productProfileEngine.setEventEmitter(null);
    };
  }, [notify]);

  const profile = snap.profile;
  const fields = profile?.fields;
  const hints = useMemo(
    () => categorySpecHints(fields?.category ?? ""),
    [fields?.category],
  );

  const toggle = (id: SectionId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const onContinue = async () => {
    setBusy(true);
    try {
      await productProfileEngine.continueToStep4();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Step 3 complete",
        "Product Profile saved. Continue with Marketing Input.",
        "production-complete",
      );
      switchWorkspace("marketing");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Incomplete", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onAnalyze = async () => {
    setAnalyzing(true);
    try {
      await productProfileEngine.runProductUnderstanding();
      notify("success", "Product understood", "KWIZERA AI built a structured product profile from your images and inputs.", "ai-suggestions");
    } catch (error) {
      notify("error", "Analysis failed", error instanceof Error ? error.message : "Unable to analyze", "errors");
    } finally {
      setAnalyzing(false);
    }
  };

  const onGenerateVideo = async () => {
    setGenerating(true);
    try {
      await productProfileEngine.startVideoGeneration();
      notify("info", "Video production started", "KWIZERA AI is running the creative pipeline.", "production-complete");
    } catch (error) {
      notify("error", "Cannot start production", error instanceof Error ? error.message : "Pipeline unavailable", "errors");
    } finally {
      setGenerating(false);
    }
  };

  const primaryImage = profile?.productImageSet?.images.find((i) => i.roleInGroup === "primary")
    ?? profile?.productImageSet?.images.find((i) => i.viewType === "FRONT")
    ?? profile?.productImageSet?.images[0]
    ?? null;

  const viewPreview = (view: string) =>
    profile?.productImageSet?.images.find((i) => i.viewType === view && i.roleInGroup === "primary")
    ?? profile?.productImageSet?.images.find((i) => i.viewType === view);

  if (!profile || !fields) {
    return (
      <div className="product-profile">
        <header className="pp-hero">
          <div>
            <span className="pp-kicker">Product Creation · Step 3</span>
            <h1>Product Information</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="pp-panel">
          <p>Complete Step 2 Image Organization, then continue here.</p>
          <button type="button" onClick={() => switchWorkspace("image-organization")}>
            Open Image Organization
          </button>
        </section>
      </div>
    );
  }

  const validationIcon = (field: string) => {
    const row = profile.validations.find((v) => v.field === field);
    if (!row) return null;
    if (row.status === "ok") return <span className="pp-val ok">✓</span>;
    if (row.status === "warning") return <span className="pp-val warn">⚠</span>;
    return <span className="pp-val err">✗</span>;
  };

  return (
    <div className="product-profile">
      <header className="pp-hero">
        <div>
          <span className="pp-kicker">Product Creation · Step 3</span>
          <h1>Product Information & Profile</h1>
          <p>
            Combine product images, AI analysis, and your authoritative product data into one Complete Product Profile.
          </p>
        </div>
        <div className="pp-hero-stats">
          <div><b>{profile.completeness.overall}%</b><span>Overall</span></div>
          <div><b>{profile.completeness.information}%</b><span>Info</span></div>
          <div><b>{profile.completeness.images}%</b><span>Images</span></div>
          <div><b>{profile.completeness.specifications}%</b><span>Specs</span></div>
        </div>
      </header>

      <section className="pp-toolbar">
        <div>
          <strong>{fields.name || profile.projectName}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="pp-toolbar-actions">
          <span className={`pp-save ${savePulse ? "pulse" : ""}`}>
            <Save size={14} /> Auto-save
          </span>
          <button type="button" onClick={() => switchWorkspace("image-organization")}>Back to Images</button>
          <button
            type="button"
            disabled={analyzing || !profile.readiness.canGenerateVideo}
            onClick={() => void onAnalyze()}
            title="Run Product + Image Intelligence"
          >
            {analyzing ? "Analyzing…" : "Analyze Product"}
          </button>
          <button
            type="button"
            className="pp-generate"
            disabled={generating || profile.production.status === "running" || !profile.readiness.canGenerateVideo}
            onClick={() => void onGenerateVideo()}
            title={profile.readiness.blockedReason ?? "Start KWIZERA video production"}
          >
            <Clapperboard size={15} /> {generating || profile.production.status === "running" ? "Starting…" : "Generate Video"}
          </button>
          <button
            type="button"
            className="pp-primary"
            disabled={busy || !profile.canContinue}
            onClick={() => void onContinue()}
            title={profile.continueBlockedReason ?? "Continue to Marketing"}
          >
            Continue to Marketing
          </button>
        </div>
      </section>

      <section className="pp-panel pp-readiness">
        <h3>Product Readiness</h3>
        <p className={`pp-readiness-banner ${profile.readiness.canGenerateVideo ? "ready" : "blocked"}`}>
          {profile.readiness.message}
        </p>
        <div className="pp-readiness-grid">
          {profile.readiness.required.map((row) => (
            <div key={row.field} className={`pp-readiness-row ${row.satisfied ? "ok" : "err"}`}>
              <span>{row.label}</span>
              <b>{row.satisfied ? "✓" : "✗"}</b>
            </div>
          ))}
          {profile.readiness.optional.slice(0, 6).map((row) => (
            <div key={row.field} className={`pp-readiness-row ${row.satisfied ? "ok" : "opt"}`}>
              <span>{row.label}</span>
              <b>{row.satisfied ? "✓" : "—"}</b>
            </div>
          ))}
        </div>
      </section>

      {(profile.production.status !== "idle" || profile.structuredProfile) && (
        <section className="pp-panel pp-production">
          {profile.production.status !== "idle" && (
            <>
              <h3>Video Production</h3>
              <div className="pp-progress-head">
                <strong>{profile.production.progress}%</strong>
                <span>{profile.production.status === "running" ? "In progress" : profile.production.status}</span>
              </div>
              <div className="pp-progress-bar">
                <div className="pp-progress-fill" style={{ width: `${profile.production.progress}%` }} />
              </div>
              <ul className="pp-stage-list">
                {profile.production.stages.map((stage) => (
                  <li key={stage.id} className={`stage-${stage.status}`}>
                    <span>{stage.status === "completed" ? "✓" : stage.status === "active" ? "▶" : stage.status === "failed" ? "✗" : "○"}</span>
                    {stage.label}
                  </li>
                ))}
              </ul>
              {profile.production.error && (
                <p className="pp-err">{profile.production.error}</p>
              )}
              {profile.production.status === "completed" && profile.production.outputUrl && (
                <div className="pp-output">
                  <h4>Output Preview</h4>
                  {profile.production.outputUrl.endsWith(".svg") || profile.production.outputUrl.includes("preview") ? (
                    <img src={profile.production.outputUrl} alt="Generated video preview" className="pp-output-preview" />
                  ) : (
                    <a href={profile.production.outputUrl} target="_blank" rel="noreferrer">
                      <Play size={14} /> Open output
                    </a>
                  )}
                  {profile.production.outputVersion && (
                    <p className="pp-muted">Version {profile.production.outputVersion}
                      {profile.production.outputQuality != null ? ` · Quality ${profile.production.outputQuality}/100` : ""}
                    </p>
                  )}
                </div>
              )}
              {profile.production.status === "completed" && !profile.production.outputUrl && (
                <p className="pp-warn">
                  Pipeline finished but no validated preview artifact was found. Check AI Services and storage.
                </p>
              )}
            </>
          )}
          {profile.structuredProfile && (
            <div className="pp-structured">
              <h3>Structured Product Profile</h3>
              <div className="pp-summary">
                <div><span>Category</span><b>{profile.structuredProfile.identity.category ?? "—"}</b></div>
                <div><span>Product type</span><b>{profile.structuredProfile.identity.productType ?? "—"}</b></div>
                <div><span>Confidence</span><b>{profile.structuredProfile.confidence.overall}%</b></div>
                <div><span>Image views</span><b>{profile.structuredProfile.coverage.viewCount}</b></div>
                <div><span>Colors</span><b>{profile.structuredProfile.visual.colors.join(" / ") || "—"}</b></div>
                <div><span>Materials</span><b>{profile.structuredProfile.visual.materials.join(" / ") || "—"}</b></div>
                <div className="span-2"><span>Selling points</span><b><DisplayList value={profile.structuredProfile.commercial.sellingPoints.slice(0, 4)} /></b></div>
              </div>
              {profile.structuredProfile.uncertainFields.length > 0 && (
                <p className="pp-warn">Review needed: {profile.structuredProfile.uncertainFields.join(", ")}</p>
              )}
              {profile.structuredProfile.missingInformation.length > 0 && (
                <p className="pp-muted">Optional gaps: <DisplayList value={profile.structuredProfile.missingInformation.slice(0, 5)} separator=", " /></p>
              )}
            </div>
          )}
        </section>
      )}

      <div className="pp-layout">
        <aside className="pp-images">
          <h3><ImageIcon size={15} /> Product Images</h3>
          {primaryImage?.url ? (
            <img className="pp-primary-img" src={primaryImage.url} alt={primaryImage.fileName} />
          ) : (
            <div className="pp-primary-img empty">No primary image</div>
          )}
          <div className="pp-thumbs">
            {(["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM", "DETAIL", "PACKAGING", "LOGO"] as const).map((view) => {
              const img = viewPreview(view);
              return (
                <div key={view} className={`pp-thumb ${img ? "" : "missing"}`}>
                  {img?.url ? <img src={img.url} alt={view} /> : <span>{view}</span>}
                  <small>{view}</small>
                </div>
              );
            })}
          </div>
          <p className="pp-muted">
            {profile.productImageSet?.images.length ?? 0} images · Coverage {profile.productImageSet?.coverageScore ?? 0}%
          </p>
        </aside>

        <div className="pp-forms">
          <Section title="Product Identity" open={open.identity} onToggle={() => toggle("identity")}>
            <div className="pp-grid">
              <label>Product Name {validationIcon("name")}
                <input
                  autoFocus
                  value={fields.name}
                  placeholder="e.g. Nike Air Max"
                  onChange={(e) => productProfileEngine.updateField("name", e.target.value)}
                />
              </label>
              <label>Brand {validationIcon("brand")}
                <input
                  value={fields.brand}
                  placeholder="Brand name"
                  onChange={(e) => productProfileEngine.updateField("brand", e.target.value)}
                />
              </label>
              <label>Model
                <input value={fields.model} onChange={(e) => productProfileEngine.updateField("model", e.target.value)} />
              </label>
              <label>SKU {validationIcon("sku")}
                <input value={fields.sku} placeholder="ABC-123" onChange={(e) => productProfileEngine.updateField("sku", e.target.value)} />
              </label>
              <label>Barcode {validationIcon("barcode")}
                <input value={fields.barcode} placeholder="8–14 digits" onChange={(e) => productProfileEngine.updateField("barcode", e.target.value)} />
              </label>
              <label>Category {validationIcon("category")}
                <input value={fields.category} placeholder="Optional — AI can suggest" onChange={(e) => productProfileEngine.updateField("category", e.target.value)} />
              </label>
              <label>Subcategory
                <input value={fields.subcategory} onChange={(e) => productProfileEngine.updateField("subcategory", e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="Pricing" open={open.pricing} onToggle={() => toggle("pricing")}>
            <p className="pp-note">User-provided prices are authoritative. AI never invents or silently changes prices.</p>
            <div className="pp-grid">
              <label>Selling Price {validationIcon("price")}
                <input
                  type="number"
                  min={0}
                  value={fields.price ?? ""}
                  onChange={(e) => productProfileEngine.updateField("price", e.target.value === "" ? null : Number(e.target.value))}
                />
              </label>
              <label>Currency {validationIcon("currency")}
                <input value={fields.currency} onChange={(e) => productProfileEngine.updateField("currency", e.target.value.toUpperCase())} />
              </label>
              <label>Original Price {validationIcon("originalPrice")}
                <input
                  type="number"
                  min={0}
                  value={fields.originalPrice ?? ""}
                  onChange={(e) => productProfileEngine.updateField("originalPrice", e.target.value === "" ? null : Number(e.target.value))}
                />
              </label>
              <label>Discount %
                <input
                  type="number"
                  min={0}
                  value={fields.discount ?? ""}
                  onChange={(e) => productProfileEngine.updateField("discount", e.target.value === "" ? null : Number(e.target.value))}
                />
              </label>
              <label>Promotion Price
                <input
                  type="number"
                  min={0}
                  value={fields.promotionPrice ?? ""}
                  onChange={(e) => productProfileEngine.updateField("promotionPrice", e.target.value === "" ? null : Number(e.target.value))}
                />
              </label>
              <label>Cost Price (private)
                <input
                  type="number"
                  min={0}
                  value={fields.costPrice ?? ""}
                  onChange={(e) => productProfileEngine.updateField("costPrice", e.target.value === "" ? null : Number(e.target.value))}
                />
              </label>
              <label className="span-2">Price Notes
                <input value={fields.priceNotes} onChange={(e) => productProfileEngine.updateField("priceNotes", e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="Description" open={open.description} onToggle={() => toggle("description")}>
            <div className="pp-grid">
              <label className="span-2">Short Description {validationIcon("description")}
                <textarea
                  rows={2}
                  value={fields.shortDescription}
                  placeholder="One-line product summary"
                  onChange={(e) => productProfileEngine.updateField("shortDescription", e.target.value)}
                />
              </label>
              <label className="span-2">Full Description
                <textarea
                  rows={4}
                  value={fields.description}
                  placeholder="Detailed product description"
                  onChange={(e) => productProfileEngine.updateField("description", e.target.value)}
                />
              </label>
              <label className="span-2">Highlights (comma-separated)
                <input
                  value={listToText(fields.highlights)}
                  onChange={(e) => productProfileEngine.updateField("highlights", textToList(e.target.value))}
                />
              </label>
              <label className="span-2">Key Features
                <input
                  value={listToText(fields.features)}
                  onChange={(e) => productProfileEngine.updateField("features", textToList(e.target.value))}
                />
              </label>
              <label className="span-2">Benefits
                <input
                  value={listToText(fields.benefits)}
                  onChange={(e) => productProfileEngine.updateField("benefits", textToList(e.target.value))}
                />
              </label>
              <label className="span-2">Additional Notes
                <textarea
                  rows={2}
                  value={fields.additionalNotes}
                  onChange={(e) => productProfileEngine.updateField("additionalNotes", e.target.value)}
                />
              </label>
            </div>
          </Section>

          <Section title="Specifications" open={open.specs} onToggle={() => toggle("specs")}>
            <div className="pp-grid">
              <label>Materials
                <input
                  value={listToText(fields.materials)}
                  placeholder="Leather, mesh"
                  onChange={(e) => productProfileEngine.updateField("materials", textToList(e.target.value))}
                />
              </label>
              <label>Colors {validationIcon("colors")}
                <input
                  value={listToText(fields.colors)}
                  placeholder="Black, White"
                  onChange={(e) => productProfileEngine.updateField("colors", textToList(e.target.value))}
                />
              </label>
              <label>Sizes
                <input
                  value={listToText(fields.sizes)}
                  placeholder="39, 40, 41"
                  onChange={(e) => productProfileEngine.updateField("sizes", textToList(e.target.value))}
                />
              </label>
              <label>Dimensions
                <input value={fields.dimensions} onChange={(e) => productProfileEngine.updateField("dimensions", e.target.value)} />
              </label>
              <label>Weight
                <input value={fields.weight} onChange={(e) => productProfileEngine.updateField("weight", e.target.value)} />
              </label>
              <label>Warranty
                <input value={fields.warranty} onChange={(e) => productProfileEngine.updateField("warranty", e.target.value)} />
              </label>
              <label>Stock
                <input value={fields.stock} onChange={(e) => productProfileEngine.updateField("stock", e.target.value)} />
              </label>
              <label>Country of Origin
                <input value={fields.countryOfOrigin} onChange={(e) => productProfileEngine.updateField("countryOfOrigin", e.target.value)} />
              </label>
            </div>
            {hints.length > 0 && (
              <>
                <h4 className="pp-subhead">Category-specific · {fields.category || "General"}</h4>
                <div className="pp-grid">
                  {hints.map((hint) => (
                    <label key={hint.key}>{hint.label}
                      <input
                        value={fields.specifications[hint.key] ?? ""}
                        placeholder={hint.placeholder}
                        onChange={(e) => productProfileEngine.updateSpecification(hint.key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section title="Variants" open={open.variants} onToggle={() => toggle("variants")}>
            <div className="pp-variant-form">
              <select
                value={variantDraft.kind}
                onChange={(e) => setVariantDraft((d) => ({
                  ...d,
                  kind: e.target.value as typeof d.kind,
                  label: e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1),
                }))}
              >
                <option value="color">Color</option>
                <option value="size">Size</option>
                <option value="model">Model</option>
                <option value="package">Package</option>
                <option value="other">Other</option>
              </select>
              <input
                value={variantDraft.label}
                onChange={(e) => setVariantDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="Label"
              />
              <input
                value={variantDraft.values}
                onChange={(e) => setVariantDraft((d) => ({ ...d, values: e.target.value }))}
                placeholder="Black, White, Brown"
              />
              <button
                type="button"
                onClick={() => {
                  productProfileEngine.addVariant(variantDraft.kind, variantDraft.label, variantDraft.values);
                  setVariantDraft((d) => ({ ...d, values: "" }));
                }}
              >
                Add Variant
              </button>
            </div>
            <ul className="pp-variant-list">
              {profile.variants.map((v) => (
                <li key={v.id}>
                  <strong>{v.label}</strong> ({v.kind}): {v.values.join(" / ")}
                  <button type="button" className="link" onClick={() => productProfileEngine.removeVariant(v.id)}>Remove</button>
                </li>
              ))}
              {!profile.variants.length && <li className="pp-muted">No variants yet.</li>}
            </ul>
          </Section>

          <Section title="AI-Derived Suggestions" open={open.ai} onToggle={() => toggle("ai")}>
            <p className="pp-note">
              <Sparkles size={14} /> AI-derived values are suggestions only. Your entries stay authoritative unless you Accept.
            </p>
            <div className="pp-ai-list">
              {profile.aiDerived.map((row) => (
                <div key={row.field} className={`pp-ai-card status-${row.status}`}>
                  <div>
                    <span className="pp-ai-badge">AI-derived</span>
                    <strong>{row.field}</strong>
                    <p>{Array.isArray(row.value) ? row.value.join(", ") : String(row.value)}</p>
                    <small>Confidence: {Math.round(row.confidence * 100)}% · {row.source} · {row.status}</small>
                  </div>
                  {row.status === "pending" && (
                    <div className="pp-ai-actions">
                      <button type="button" onClick={() => productProfileEngine.acceptAiSuggestion(row.field)}>Accept</button>
                      <button type="button" onClick={() => {
                        const edited = window.prompt(`Edit ${row.field}`, Array.isArray(row.value) ? row.value.join(", ") : String(row.value));
                        if (edited != null) productProfileEngine.editAiSuggestion(row.field, edited);
                      }}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => productProfileEngine.rejectAiSuggestion(row.field)}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
              {!profile.aiDerived.length && <p className="pp-muted">No AI suggestions for this product yet.</p>}
            </div>
          </Section>

          <Section title="Version History" open={open.history} onToggle={() => toggle("history")}>
            <ul className="pp-history">
              {profile.history.slice(0, 25).map((h) => (
                <li key={h.id}>
                  <time>{new Date(h.at).toLocaleString()}</time>
                  <span>{h.field}</span>
                  <span className="pp-muted">{h.source}</span>
                </li>
              ))}
              {!profile.history.length && <li className="pp-muted">No changes recorded yet.</li>}
            </ul>
          </Section>

          <Section title="Product Profile Review" open={open.review} onToggle={() => toggle("review")}>
            <div className="pp-summary">
              <div><span>Product</span><b>{fields.name || "—"}</b></div>
              <div><span>Brand</span><b>{fields.brand || "—"}</b></div>
              <div><span>Category</span><b>{fields.category || "—"}</b></div>
              <div><span>Price</span><b>{fields.price != null ? `${fields.price.toLocaleString()} ${fields.currency}` : "—"}</b></div>
              <div><span>Colors</span><b>{fields.colors.join(" / ") || "—"}</b></div>
              <div><span>Sizes</span><b>{fields.sizes.join(" / ") || "—"}</b></div>
              <div><span>Images</span><b>{profile.productImageSet?.images.length ?? 0}</b></div>
              <div><span>Variants</span><b>{profile.variants.length}</b></div>
              <div><span>Description</span><b>{fields.description || fields.shortDescription ? "Present" : "Empty"}</b></div>
              <div><span>Specifications</span><b>{profile.completeness.specifications}%</b></div>
              <div><span>Completeness</span><b>{profile.completeness.overall}%</b></div>
              <div><span>Validation</span><b>{profile.validationStatus.toUpperCase()}</b></div>
              <div className="span-2">
                <span>Status</span>
                <b>{profile.readiness.message}</b>
              </div>
            </div>
            {profile.completeness.missingRecommended.length > 0 && (
              <p className="pp-warn">
                <AlertTriangle size={14} /> Missing recommended: {profile.completeness.missingRecommended.join(", ")}
              </p>
            )}
            {profile.validations.filter((v) => v.status !== "ok").map((v) => (
              <p key={v.field} className={v.status === "error" ? "pp-err" : "pp-warn"}>
                {v.status === "error" ? "✗" : "⚠"} {v.message}
              </p>
            ))}
            {profile.canContinue && (
              <p className="pp-ok"><CheckCircle2 size={14} /> Critical product information is valid.</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="pp-panel">
      <button type="button" className="pp-section-head" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>{title}</h3>
      </button>
      {open && <div className="pp-section-body">{children}</div>}
    </section>
  );
}
