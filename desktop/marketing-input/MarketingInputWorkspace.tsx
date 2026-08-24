import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Save, Sparkles,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { marketingInputEngine } from "./marketing-engine";
import type { MarketingSnapshot } from "./types";
import {
  CTA_PRESETS,
  FORMAT_PRESETS,
  LANGUAGE_PRESETS,
  OBJECTIVE_PRESETS,
  PLATFORM_PRESETS,
  PROMOTION_PRESETS,
  TONE_PRESETS,
  resolvedAudienceSummary,
  resolvedCta,
  resolvedFormat,
  resolvedLanguage,
  resolvedPlatforms,
} from "./types";
import "./marketing-input.css";

type SectionId =
  | "product"
  | "objective"
  | "audience"
  | "platform"
  | "format"
  | "voice"
  | "cta"
  | "creative"
  | "brand"
  | "ai"
  | "review";

export function MarketingInputWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<MarketingSnapshot>(() => marketingInputEngine.snapshot());
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    product: true,
    objective: true,
    audience: true,
    platform: true,
    format: true,
    voice: true,
    cta: true,
    creative: false,
    brand: false,
    ai: true,
    review: true,
  });
  const [busy, setBusy] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [interestsText, setInterestsText] = useState("");

  useEffect(() => {
    marketingInputEngine.setNotify(notify);
    marketingInputEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "marketing.started",
        "marketing.completed",
        "product.updated",
        "state.shared",
        "notify.info",
        "production.progress",
      ]);
      const eventType = allowed.has(type) ? type : "state.shared";
      void workspaceIntegrationEngine.emit({
        type: eventType as "marketing.started",
        source: "marketing",
        targets: ["ai-me", "notifications", "workspace", "creative"],
        payload,
        priority: "normal",
      });
    });
    const unsub = marketingInputEngine.subscribe((next) => {
      setSnap(next);
      setSavePulse(true);
      window.setTimeout(() => setSavePulse(false), 600);
      if (next.brief) setInterestsText(next.brief.fields.interests.join(", "));
    });
    void marketingInputEngine.hydrateFromHandoff();
    return () => {
      unsub();
      marketingInputEngine.setNotify(null);
      marketingInputEngine.setEventEmitter(null);
    };
  }, [notify]);

  const brief = snap.brief;
  const fields = brief?.fields;
  const product = brief?.productProfile;
  const toggle = (id: SectionId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  const onContinue = async () => {
    setBusy(true);
    try {
      await marketingInputEngine.continueToStep5();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Step 4 complete",
        "Marketing Production Brief saved. Continue with Live Validation.",
        "production-complete",
      );
      switchWorkspace("product-validation");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Incomplete", "errors");
    } finally {
      setBusy(false);
    }
  };

  if (!brief || !fields || !product) {
    return (
      <div className="marketing-input">
        <header className="mi-hero">
          <div>
            <span className="mi-kicker">Product Creation · Step 4</span>
            <h1>Marketing Input</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="mi-panel">
          <p>Complete Step 3 Product Information, then continue here.</p>
          <button type="button" onClick={() => switchWorkspace("product-information")}>
            Open Product Information
          </button>
        </section>
      </div>
    );
  }

  const pf = product.fields;
  const priceLabel = pf.price != null ? `${pf.price.toLocaleString()} ${pf.currency}` : "—";

  return (
    <div className="marketing-input">
      <header className="mi-hero">
        <div>
          <span className="mi-kicker">Product Creation · Step 4</span>
          <h1>Marketing Input & Production Brief</h1>
          <p>
            Connect the verified Product Profile to campaign requirements. Product facts stay read-only — configure marketing only.
          </p>
        </div>
        <div className="mi-hero-stats">
          <div><b>{brief.completeness.overall}%</b><span>Overall</span></div>
          <div><b>{brief.completeness.objective}%</b><span>Objective</span></div>
          <div><b>{brief.completeness.platform}%</b><span>Platform</span></div>
          <div><b>{brief.completeness.cta}%</b><span>CTA</span></div>
        </div>
      </header>

      <section className="mi-toolbar">
        <div>
          <strong>{pf.name || brief.projectName}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="mi-toolbar-actions">
          <span className={`mi-save ${savePulse ? "pulse" : ""}`}><Save size={14} /> Auto-save</span>
          <button type="button" onClick={() => switchWorkspace("product-information")}>Edit Product</button>
          <button
            type="button"
            className="mi-primary"
            disabled={busy || !(brief.canContinue || brief.continueAnyway) || brief.validations.some((v) => v.status === "error")}
            onClick={() => void onContinue()}
          >
            Continue to Validation
          </button>
        </div>
      </section>

      <div className="mi-layout">
        <aside className="mi-product">
          <h3>Product (from Step 3)</h3>
          <div className="mi-product-card">
            <div><span>Name</span><b>{pf.name || "—"}</b></div>
            <div><span>Brand</span><b>{pf.brand || "—"}</b></div>
            <div><span>Category</span><b>{pf.category || "—"}</b></div>
            <div><span>Price</span><b>{priceLabel}</b></div>
            <div><span>Colors</span><b>{pf.colors.join(" / ") || "—"}</b></div>
            <div><span>Sizes</span><b>{pf.sizes.join(" / ") || "—"}</b></div>
            <div><span>Images</span><b>{product.productImageSet?.images.length ?? 0}</b></div>
            <div><span>Profile</span><b>{product.canContinue ? "Verified" : product.validationStatus}</b></div>
          </div>
          <p className="mi-note">Read-only. Use Edit Product to change commerce data. Prices are never invented here.</p>
          {product.productImageSet?.images[0]?.url && (
            <img className="mi-thumb" src={product.productImageSet.images.find((i) => i.roleInGroup === "primary")?.url
              ?? product.productImageSet.images[0].url} alt="" />
          )}
        </aside>

        <div className="mi-forms">
          <Section title="Campaign Objective" open={open.objective} onToggle={() => toggle("objective")}>
            <div className="mi-chips">
              {OBJECTIVE_PRESETS.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={
                    (o === "Custom Objective"
                      ? Boolean(fields.objective) && !(OBJECTIVE_PRESETS as readonly string[]).slice(0, -1).includes(fields.objective)
                      : fields.objective === o)
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    if (o === "Custom Objective") {
                      const custom = window.prompt("Custom objective", fields.objective) ?? fields.objective;
                      marketingInputEngine.updateField("objective", custom);
                    } else marketingInputEngine.updateField("objective", o);
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
            <label className="mi-label">Objective
              <input value={fields.objective} onChange={(e) => marketingInputEngine.updateField("objective", e.target.value)} placeholder="Or type a custom objective" />
            </label>
          </Section>

          <Section title="Target Audience" open={open.audience} onToggle={() => toggle("audience")}>
            <div className="mi-grid">
              <label>Audience Type
                <input value={fields.audienceType} onChange={(e) => marketingInputEngine.updateField("audienceType", e.target.value)} placeholder="e.g. Young professionals" />
              </label>
              <label>Age Range
                <input value={fields.ageRange} onChange={(e) => marketingInputEngine.updateField("ageRange", e.target.value)} placeholder="e.g. 18–35" />
              </label>
              <label>Gender (optional)
                <input value={fields.gender} onChange={(e) => marketingInputEngine.updateField("gender", e.target.value)} placeholder="Unspecified" />
              </label>
              <label>Location
                <input value={fields.location} onChange={(e) => marketingInputEngine.updateField("location", e.target.value)} placeholder="e.g. Kigali" />
              </label>
              <label className="span-2">Interests
                <input
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  onBlur={() => marketingInputEngine.updateField(
                    "interests",
                    interestsText.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
                  )}
                  placeholder="Comma-separated"
                />
              </label>
              <label>Customer Needs
                <input value={fields.customerNeeds} onChange={(e) => marketingInputEngine.updateField("customerNeeds", e.target.value)} />
              </label>
              <label>Buying Intent
                <input value={fields.buyingIntent} onChange={(e) => marketingInputEngine.updateField("buyingIntent", e.target.value)} />
              </label>
              <label>Customer Segment
                <input value={fields.customerSegment} onChange={(e) => marketingInputEngine.updateField("customerSegment", e.target.value)} />
              </label>
              <label className="span-2">Audience Notes
                <textarea rows={2} value={fields.audienceNotes} onChange={(e) => marketingInputEngine.updateField("audienceNotes", e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="Platforms & Format" open={open.platform} onToggle={() => toggle("platform")}>
            <div className="mi-chips">
              {PLATFORM_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={fields.platforms.includes(p) ? "active" : ""}
                  onClick={() => marketingInputEngine.togglePlatform(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            {fields.platforms.includes("Custom Platform") && (
              <label className="mi-label">Custom Platform
                <input value={fields.customPlatform} onChange={(e) => marketingInputEngine.updateField("customPlatform", e.target.value)} />
              </label>
            )}
            <h4 className="mi-sub">Content Format</h4>
            <div className="mi-chips">
              {FORMAT_PRESETS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={fields.contentFormat === f ? "active" : ""}
                  onClick={() => marketingInputEngine.updateField("contentFormat", f)}
                >
                  {f}
                </button>
              ))}
            </div>
            {fields.contentFormat === "Custom Format" && (
              <label className="mi-label">Custom Format
                <input value={fields.customFormat} onChange={(e) => marketingInputEngine.updateField("customFormat", e.target.value)} />
              </label>
            )}
            <h4 className="mi-sub">Video Duration</h4>
            <div className="mi-chips">
              {(["automatic", "short", "medium", "long", "custom"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={fields.duration === d ? "active" : ""}
                  onClick={() => marketingInputEngine.updateField("duration", d)}
                >
                  {d}
                </button>
              ))}
            </div>
            {fields.duration === "custom" && (
              <label className="mi-label">Custom seconds
                <input
                  type="number"
                  min={1}
                  value={fields.customDurationSeconds ?? ""}
                  onChange={(e) => marketingInputEngine.updateField(
                    "customDurationSeconds",
                    e.target.value === "" ? null : Number(e.target.value),
                  )}
                />
              </label>
            )}
          </Section>

          <Section title="Language & Voice" open={open.voice} onToggle={() => toggle("voice")}>
            <div className="mi-chips">
              {LANGUAGE_PRESETS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={fields.language === l ? "active" : ""}
                  onClick={() => marketingInputEngine.updateField("language", l)}
                >
                  {l}
                </button>
              ))}
            </div>
            {fields.language === "Other" && (
              <label className="mi-label">Other language
                <input value={fields.languageOther} onChange={(e) => marketingInputEngine.updateField("languageOther", e.target.value)} />
              </label>
            )}
            <div className="mi-grid">
              <label>Voice Language
                <input value={fields.voiceLanguage} onChange={(e) => marketingInputEngine.updateField("voiceLanguage", e.target.value)} placeholder="Defaults to campaign language" />
              </label>
              <label>Voice Gender
                <input value={fields.voiceGender} onChange={(e) => marketingInputEngine.updateField("voiceGender", e.target.value)} placeholder="Optional" />
              </label>
              <label>Voice Style
                <input value={fields.voiceStyle} onChange={(e) => marketingInputEngine.updateField("voiceStyle", e.target.value)} />
              </label>
              <label>Tone
                <select value={fields.tone} onChange={(e) => marketingInputEngine.updateField("tone", e.target.value)}>
                  {TONE_PRESETS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="span-2">
                <span className="mi-check">
                  <input
                    type="checkbox"
                    checked={fields.narrationEnabled}
                    onChange={(e) => marketingInputEngine.updateField("narrationEnabled", e.target.checked)}
                  />
                  Narration enabled (configuration only — no audio generated in this step)
                </span>
              </label>
              <label className="span-2">Custom Voice Notes
                <input value={fields.customVoiceNotes} onChange={(e) => marketingInputEngine.updateField("customVoiceNotes", e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="CTA & Promotion" open={open.cta} onToggle={() => toggle("cta")}>
            <div className="mi-chips">
              {CTA_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={fields.cta === c ? "active" : ""}
                  onClick={() => marketingInputEngine.updateField("cta", c)}
                >
                  {c}
                </button>
              ))}
            </div>
            {fields.cta === "Custom CTA" && (
              <label className="mi-label">Custom CTA (preserved exactly)
                <input value={fields.ctaCustom} onChange={(e) => marketingInputEngine.updateField("ctaCustom", e.target.value)} />
              </label>
            )}
            <h4 className="mi-sub">Promotion</h4>
            <p className="mi-note">Never invent discounts. Product price from Step 3: <b>{priceLabel}</b></p>
            <div className="mi-chips">
              {PROMOTION_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={fields.promotionType === p ? "active" : ""}
                  onClick={() => marketingInputEngine.updateField("promotionType", p)}
                >
                  {p}
                </button>
              ))}
            </div>
            {fields.promotionType !== "None" && (
              <label className="mi-label">Promotion details (user-provided only)
                <input
                  value={fields.promotionDetails}
                  placeholder="e.g. 20% off this week — enter only real offers"
                  onChange={(e) => marketingInputEngine.updateField("promotionDetails", e.target.value)}
                />
              </label>
            )}
          </Section>

          <Section title="Creative Preferences" open={open.creative} onToggle={() => toggle("creative")}>
            <div className="mi-grid">
              <label>Style
                <input value={fields.style} onChange={(e) => marketingInputEngine.updateField("style", e.target.value)} placeholder="Premium product advertisement" />
              </label>
              <label>Mood
                <input value={fields.mood} onChange={(e) => marketingInputEngine.updateField("mood", e.target.value)} />
              </label>
              <label>Energy
                <input value={fields.energy} onChange={(e) => marketingInputEngine.updateField("energy", e.target.value)} />
              </label>
              <label>Visual Preference
                <input value={fields.visualPreference} onChange={(e) => marketingInputEngine.updateField("visualPreference", e.target.value)} />
              </label>
              <label>Background
                <input value={fields.backgroundPreference} onChange={(e) => marketingInputEngine.updateField("backgroundPreference", e.target.value)} />
              </label>
              <label>Brand Feeling
                <input value={fields.brandFeeling} onChange={(e) => marketingInputEngine.updateField("brandFeeling", e.target.value)} />
              </label>
              <label>Camera
                <input value={fields.cameraPreference} onChange={(e) => marketingInputEngine.updateField("cameraPreference", e.target.value)} />
              </label>
              <label>Music
                <input value={fields.musicPreference} onChange={(e) => marketingInputEngine.updateField("musicPreference", e.target.value)} />
              </label>
              <label className="span-2">Campaign Notes
                <textarea rows={2} value={fields.campaignNotes} onChange={(e) => marketingInputEngine.updateField("campaignNotes", e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="Brand Settings" open={open.brand} onToggle={() => toggle("brand")}>
            <p className="mi-note">Reuses Product Profile brand. Project-specific prefs only — no global brand DB overwrite.</p>
            <div className="mi-grid">
              <label>Brand Name
                <input value={fields.brandName} onChange={(e) => marketingInputEngine.updateField("brandName", e.target.value)} />
              </label>
              <label>Brand Style
                <input value={fields.brandStyle} onChange={(e) => marketingInputEngine.updateField("brandStyle", e.target.value)} />
              </label>
              <label>Brand Colors
                <input value={fields.brandColors} onChange={(e) => marketingInputEngine.updateField("brandColors", e.target.value)} />
              </label>
              <label>Brand Voice
                <input value={fields.brandVoice} onChange={(e) => marketingInputEngine.updateField("brandVoice", e.target.value)} />
              </label>
              <label className="span-2">Brand Guidelines
                <textarea rows={2} value={fields.brandGuidelines} onChange={(e) => marketingInputEngine.updateField("brandGuidelines", e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="AI Recommendations" open={open.ai} onToggle={() => toggle("ai")}>
            <p className="mi-note"><Sparkles size={14} /> Separated from USER PROVIDED settings. Accept explicitly — never auto-applied.</p>
            <div className="mi-ai-list">
              {brief.recommendations.map((row) => (
                <div key={row.field} className={`mi-ai-card status-${row.status}`}>
                  <div>
                    <span className="mi-ai-badge">AI Recommendation</span>
                    <strong>{row.field}</strong>
                    <p>{Array.isArray(row.value) ? row.value.join(", ") : String(row.value)}</p>
                    <small>{row.reason} · {Math.round(row.confidence * 100)}% · {row.status}</small>
                  </div>
                  {row.status === "pending" && (
                    <div className="mi-ai-actions">
                      <button type="button" onClick={() => marketingInputEngine.acceptRecommendation(row.field)}>Accept</button>
                      <button type="button" onClick={() => marketingInputEngine.rejectRecommendation(row.field)}>Reject</button>
                    </div>
                  )}
                </div>
              ))}
              {!brief.recommendations.length && <p className="mi-muted">No recommendations yet.</p>}
            </div>
          </Section>

          {brief.conflicts.filter((c) => !c.acknowledged).map((c) => (
            <section key={c.id} className="mi-conflict">
              <AlertTriangle size={16} />
              <div>
                <strong>WARNING</strong>
                <p>{c.message}</p>
              </div>
              <div className="mi-ai-actions">
                <button type="button" onClick={() => {
                  if (c.code === "platform-duration") setOpen((o) => ({ ...o, platform: true }));
                  if (c.code === "missing-cta") setOpen((o) => ({ ...o, cta: true }));
                }}
                >
                  Review
                </button>
                <button type="button" onClick={() => marketingInputEngine.acknowledgeConflict(c.id)}>Continue Anyway</button>
              </div>
            </section>
          ))}

          <Section title="Marketing Production Brief Review" open={open.review} onToggle={() => toggle("review")}>
            <div className="mi-summary">
              <div><span>Product</span><b>{pf.name}</b></div>
              <div><span>Campaign</span><b>{fields.objective || "—"}</b></div>
              <div><span>Audience</span><b>{resolvedAudienceSummary(fields) || "—"}</b></div>
              <div><span>Platform</span><b>{resolvedPlatforms(fields).join(", ") || "—"}</b></div>
              <div><span>Format</span><b>{resolvedFormat(fields) || "—"}</b></div>
              <div><span>Duration</span><b>{fields.duration}{fields.duration === "custom" ? ` (${fields.customDurationSeconds}s)` : ""}</b></div>
              <div><span>Language</span><b>{resolvedLanguage(fields)}</b></div>
              <div><span>Voice</span><b>{fields.narrationEnabled ? `${fields.voiceLanguage || resolvedLanguage(fields)} · ${fields.tone}` : "Off"}</b></div>
              <div><span>CTA</span><b>{resolvedCta(fields) || "—"}</b></div>
              <div><span>Promotion</span><b>{fields.promotionType === "None" ? "None" : `${fields.promotionType}: ${fields.promotionDetails || "—"}`}</b></div>
              <div><span>Completeness</span><b>{brief.completeness.overall}%</b></div>
              <div><span>Validation</span><b>{brief.validationStatus.toUpperCase()}</b></div>
            </div>
            {brief.completeness.missingRecommended.length > 0 && (
              <p className="mi-warn"><AlertTriangle size={14} /> Missing recommended: {brief.completeness.missingRecommended.join(", ")}</p>
            )}
            {brief.validations.filter((v) => v.status !== "ok").map((v) => (
              <p key={v.field} className={v.status === "error" ? "mi-err" : "mi-warn"}>
                {v.status === "error" ? "✗" : "⚠"} {v.message}
              </p>
            ))}
            {(brief.canContinue || brief.continueAnyway) && !brief.validations.some((v) => v.status === "error") && (
              <p className="mi-ok"><CheckCircle2 size={14} /> Ready for Step 5 handoff.</p>
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
    <section className="mi-panel">
      <button type="button" className="mi-section-head" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>{title}</h3>
      </button>
      {open && <div className="mi-section-body">{children}</div>}
    </section>
  );
}
