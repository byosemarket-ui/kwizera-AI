import { useState } from "react";
import { ArrowLeft, ArrowRight, Box, Check, ChevronDown, Clapperboard, Images } from "lucide-react";
import { productSetupEngine } from "../../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../../product-setup/types";
import {
  PMV_DURATION_PRESETS,
  PMV_PLATFORMS,
  durationFromParts,
  formatDuration,
  maxDurationSeconds,
  resolvePmvDestination,
  validateDuration,
  type PmvFormat,
  type PmvPlatform,
} from "../../../../ai/pmv-shared/destination.js";
import {
  LANGUAGE_OPTIONS,
  STYLE_PRESETS,
  selectedStyleId,
  stylePresetFromTone,
  validateStyle,
  videoStyleOptions,
  type PmvVideoStyleId,
  type StylePresetId,
} from "./view-model";
import { PmvAudioSection } from "./PmvAudioSection";

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
  const destination = resolvePmvDestination(settings.platform, settings.aspectRatio);
  const platformOption = PMV_PLATFORMS.find((p) => p.id === destination.platform)!;
  const maxSeconds = maxDurationSeconds(destination);
  const [customMinutes, setCustomMinutes] = useState(() => String(Math.floor(settings.durationSeconds / 60)));
  const [customSeconds, setCustomSeconds] = useState(() => String(settings.durationSeconds % 60));
  const customParts = settings.durationCustom ? durationFromParts(customMinutes, customSeconds) : null;
  const durationProblem = customParts?.error
    ?? validateDuration(settings.durationSeconds, destination, direction.generationMode);
  const validation = customParts?.error ?? validateStyle({
    generationMode: direction.generationMode,
    cinematicAvailable,
    platform: destination.platform,
    aspectRatio: destination.format.aspectRatio,
    durationSeconds: settings.durationSeconds,
  });
  const preset = stylePresetFromTone(direction.creativeTone);

  const choosePlatform = (id: PmvPlatform) => {
    if (id === destination.platform) return;
    const next = PMV_PLATFORMS.find((p) => p.id === id)!;
    productSetupEngine.setVideoSettingsField("aspectRatio", next.formats[0]!.aspectRatio);
    productSetupEngine.setVideoSettingsField("platform", id);
  };

  const choosePresetDuration = (seconds: number) => {
    if (settings.durationCustom) productSetupEngine.setVideoSettingsField("durationCustom", false);
    if (seconds !== settings.durationSeconds) productSetupEngine.setVideoSettingsField("durationSeconds", seconds);
  };

  const chooseCustomDuration = () => {
    if (settings.durationCustom) return;
    setCustomMinutes(String(Math.floor(settings.durationSeconds / 60)));
    setCustomSeconds(String(settings.durationSeconds % 60));
    productSetupEngine.setVideoSettingsField("durationCustom", true);
  };

  const changeCustom = (minutes: string, seconds: string) => {
    setCustomMinutes(minutes);
    setCustomSeconds(seconds);
    const parts = durationFromParts(minutes, seconds);
    if (parts.total != null && parts.total !== settings.durationSeconds) {
      productSetupEngine.setVideoSettingsField("durationSeconds", parts.total);
    }
  };

  const choosePreset = (id: StylePresetId) => {
    const next = STYLE_PRESETS.find((p) => p.id === id);
    if (!next || id === preset) return;
    if (direction.goal !== next.goal) productSetupEngine.setCreativeDirectionField("goal", next.goal);
    if (direction.energy !== next.energy) productSetupEngine.setCreativeDirectionField("energy", next.energy);
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
      </div>

      <div className="pmv-field-group" data-pmv-destination={destination.profile.id}>
        <span className="pmv-field-label" id="pmv-platform-label">Where will this video be used?</span>
        <div className="pmv-chips" role="radiogroup" aria-labelledby="pmv-platform-label">
          {PMV_PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={destination.platform === p.id}
              className={`pmv-chip${destination.platform === p.id ? " is-selected" : ""}`}
              data-platform={p.id}
              onClick={() => choosePlatform(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="pmv-form pmv-form--settings">
          <label className="pmv-field">
            <span>Format</span>
            <select
              value={destination.format.aspectRatio}
              disabled={platformOption.formats.length < 2}
              onChange={(ev) => productSetupEngine.setVideoSettingsField("aspectRatio", ev.target.value as PmvFormat)}
            >
              {platformOption.formats.map((f) => <option key={f.aspectRatio} value={f.aspectRatio}>{f.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="pmv-field-group">
        <span className="pmv-field-label" id="pmv-duration-label">Video length</span>
        <div className="pmv-chips" role="radiogroup" aria-labelledby="pmv-duration-label">
          {PMV_DURATION_PRESETS.map((seconds) => {
            const tooLong = seconds > maxSeconds;
            const isSelected = !settings.durationCustom && settings.durationSeconds === seconds;
            return (
              <button
                key={seconds}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={tooLong && !isSelected}
                className={`pmv-chip${isSelected ? " is-selected" : ""}`}
                data-duration={seconds}
                onClick={() => choosePresetDuration(seconds)}
              >
                {seconds < 60 ? `${seconds}s` : formatDuration(seconds)}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={settings.durationCustom}
            className={`pmv-chip${settings.durationCustom ? " is-selected" : ""}`}
            data-duration="custom"
            onClick={chooseCustomDuration}
          >
            Custom
          </button>
        </div>
        {settings.durationCustom ? (
          <div className="pmv-duration-custom">
            <label className="pmv-field">
              <span>Minutes</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={customMinutes}
                aria-invalid={Boolean(customParts?.error)}
                onChange={(ev) => changeCustom(ev.target.value, customSeconds)}
              />
            </label>
            <label className="pmv-field">
              <span>Seconds</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={1}
                value={customSeconds}
                aria-invalid={Boolean(customParts?.error)}
                onChange={(ev) => changeCustom(customMinutes, ev.target.value)}
              />
            </label>
            <output className="pmv-duration-total" aria-live="polite">
              {customParts?.total != null ? formatDuration(customParts.total) : "—"}
            </output>
          </div>
        ) : null}
        {durationProblem ? (
          <small className="pmv-field-error" role="status">{durationProblem}</small>
        ) : (
          <small className="pmv-muted">
            {destination.platformLabel} {destination.format.label}: up to {formatDuration(maxSeconds)}.
          </small>
        )}
      </div>

      <PmvAudioSection snap={snap} onError={onError} />

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
