import type { HfmMwMetricAvailability } from "../types";

export function HfmOverviewCard({
  label,
  value,
  hint,
  availability,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string | null;
  availability: HfmMwMetricAvailability;
  tone: "purple" | "green" | "red" | "blue" | "amber";
  icon: string;
}) {
  return (
    <article className="hfm-mw-ov-card" data-tone={label === "Trading Session" ? "session" : undefined}>
      <div className="hfm-mw-ov-icon" data-tone={tone} aria-hidden="true">
        {icon}
      </div>
      <div className="hfm-mw-ov-body">
        <span>{label}</span>
        <strong data-state={availability} aria-label={`${label}: ${value}`}>
          {value}
        </strong>
        {hint ? <em>{hint}</em> : null}
      </div>
    </article>
  );
}
