import { useState } from "react";
import { ArrowLeft, ArrowRight, Box, Check, ChevronDown, Clapperboard, Images } from "lucide-react";
import { productSetupEngine } from "../../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../../product-setup/types";
import {
  DURATION_OPTIONS,
  FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  STYLE_PRESETS,
  selectedStyleId,
  stylePresetFromTone,
  validateStyle,
  videoStyleOptions,
  type PmvVideoStyleId,
  type StylePresetId,
} from "./view-model";

const STYLE_ICONS: Record<PmvVideoStyleId, typeof Images> = {
  slideshow: Images,
  showcase3d: Box,
  cinematic: Clapperboard,
};

export function PmvStyleStep({
  snap,
  cinematicAvailable,
  onBack,
  onContinue,
  onError,
}: {
  snap: ProductSetupSnapshot;
  cinematicAvailable: boolean | null;
  onBack: () => void;
  onContinue: () => void;
  onError: (message: string) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const direction = snap.creativeDirection;
  const settings = snap.videoSettings;
  const options = videoStyleOptions(cinematicAvailable);
  const selected = selectedStyleId(direction.generationMode);
  const validation = validateStyle({ generationMode: direction.generationMode, cinematicAvailable });
  const preset = stylePresetFromTone(direction.creativeTone);
  const showMusic = snap.audioLibrary.length > 0 || Boolean(snap.selectedAudioAssetId);

  const choosePreset = (id: StylePresetId) => {
    const next = STYLE_PRESETS.find((p) => p.id === id);
    if (!next || id === preset) return;
    if (direction.goal !== next.goal) productSetupEngine.setCreativeDirectionField("goal", next.goal);
    if (direction.energy !== next.energy) productSetupEngine.setCreativeDirectionField("energy", next.energy);
  };

  const chooseMusic = (assetId: string) => {
    if (assetId === (snap.selectedAudioAssetId ?? "")) return;
    const task = assetId ? productSetupEngine.selectProjectAudio(assetId) : productSetupEngine.clearProjectAudio();
    void task.catch(() => onError("Could not update the music. Please try again."));
  };

  return (
    <section className="pmv-step" aria-labelledby="pmv-style-title">
      <div className="pmv-step__head">
        <h2 id="pmv-style-title">Choose your video style</h2>
      </div>

      <div className="pmv-styles" role="radiogroup" aria-labelledby="pmv-style-title">
        {options.map((option) => {
          const Icon = STYLE_ICONS[option.id];
          const isSelected = selected === option.id;
          const available = option.availability === "available";
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={!available}
              disabled={!available}
              className={`pmv-style${isSelected ? " is-selected" : ""}${available ? "" : " is-unavailable"}`}
              data-style={option.id}
              data-availability={option.availability}
              onClick={() => {
                if (!available || !option.generationMode || isSelected) return;
                productSetupEngine.setCreativeDirectionField("generationMode", option.generationMode);
              }}
            >
              <span className="pmv-style__icon" aria-hidden><Icon size={18} /></span>
              <span className="pmv-style__text">
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </span>
              {available ? (
                isSelected ? <span className="pmv-style__check" aria-hidden><Check size={14} /></span> : null
              ) : (
                <span className="pmv-badge">{option.availability === "coming_soon" ? "Coming soon" : "Not available"}</span>
              )}
            </button>
          );
        })}
      </div>

      {selected === "cinematic" ? (
        <label className="pmv-field">
          <span>Describe the scene <em>optional</em></span>
          <textarea
            rows={2}
            maxLength={600}
            value={direction.creativeRequest ?? ""}
            onChange={(ev) => productSetupEngine.setCreativeDirectionField("creativeRequest", ev.target.value)}
            placeholder="A luxury studio with soft cinematic lighting"
          />
          <small className="pmv-muted">Only the surroundings change. Your product stays exactly as it is.</small>
        </label>
      ) : null}

      <div className="pmv-form pmv-form--settings">
        <label className="pmv-field">
          <span>Style</span>
          <select value={preset} onChange={(ev) => choosePreset(ev.target.value as StylePresetId)}>
            {STYLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="pmv-field">
          <span>Language</span>
          <select value={settings.language || "en"} onChange={(ev) => productSetupEngine.setVideoSettingsField("language", ev.target.value)}>
            {LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            {!LANGUAGE_OPTIONS.some((l) => l.value === (settings.language || "en")) ? (
              <option value={settings.language}>{settings.language}</option>
            ) : null}
          </select>
        </label>
        {showMusic ? (
          <label className="pmv-field">
            <span>Music</span>
            <select value={snap.selectedAudioAssetId ?? ""} onChange={(ev) => chooseMusic(ev.target.value)}>
              <option value="">No music</option>
              {snap.audioLibrary.map((a) => <option key={a.assetId} value={a.assetId}>{a.title}</option>)}
            </select>
          </label>
        ) : null}
        <label className="pmv-field">
          <span>Duration</span>
          <select
            value={settings.durationSeconds}
            onChange={(ev) => productSetupEngine.setVideoSettingsField("durationSeconds", Number(ev.target.value))}
          >
            {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d} sec</option>)}
          </select>
        </label>
        <label className="pmv-field">
          <span>Format</span>
          <select
            value={settings.aspectRatio}
            onChange={(ev) => productSetupEngine.setVideoSettingsField("aspectRatio", ev.target.value as typeof settings.aspectRatio)}
          >
            {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>

      <button
        type="button"
        className="pmv-disclosure"
        aria-expanded={advancedOpen}
        aria-controls="pmv-advanced"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        <ChevronDown size={14} className={advancedOpen ? "is-open" : undefined} aria-hidden />
        Advanced options
      </button>

      {advancedOpen ? (
        <div id="pmv-advanced" className="pmv-form pmv-form--settings">
          <label className="pmv-field">
            <span>Target audience</span>
            <input
              value={direction.audience}
              onChange={(ev) => productSetupEngine.setCreativeDirectionField("audience", ev.target.value)}
              placeholder="Young professionals"
            />
          </label>
          {snap.selectedAudioAssetId ? (
            <>
              <label className="pmv-field">
                <span>Music timing</span>
                <select
                  value={snap.beatSyncMode}
                  onChange={(ev) => {
                    void productSetupEngine.setBeatSyncMode(ev.target.value as "OFF" | "SMART" | "STRICT")
                      .catch(() => onError("Could not update music timing. Please try again."));
                  }}
                >
                  <option value="SMART">Match the beat</option>
                  <option value="STRICT">Strictly on beat</option>
                  <option value="OFF">Free timing</option>
                </select>
              </label>
              <label className="pmv-field">
                <span>Music volume</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(snap.audioVolume * 100)}
                  onChange={(ev) => { void productSetupEngine.setAudioVolume(Number(ev.target.value) / 100).catch(() => undefined); }}
                  aria-valuetext={`${Math.round(snap.audioVolume * 100)}%`}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      {attempted && validation ? <p className="pmv-alert" role="alert">{validation}</p> : null}

      <div className="pmv-actions">
        <button type="button" className="cp-button-secondary" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden /> Back
        </button>
        <button
          type="button"
          className="cp-button pmv-primary"
          onClick={() => {
            setAttempted(true);
            if (!validation) onContinue();
          }}
        >
          Continue <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </section>
  );
}
