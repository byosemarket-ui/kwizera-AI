export interface HfmEconomicCalendarEventView {
  eventId: string;
  title: string;
  currency: string;
  impact: string;
  scheduledAtUtc: string;
  forecast: string;
  previous: string;
  actual: string;
  status: string;
  confidence: string;
}

export interface HfmEconomicCalendarView {
  ok: boolean;
  loading: boolean;
  availability: string;
  events: HfmEconomicCalendarEventView[];
  attribution: { text: string; url: string; required?: boolean } | null;
  message: string | null;
}

export function emptyCalendarView(partial?: Partial<HfmEconomicCalendarView>): HfmEconomicCalendarView {
  return {
    ok: false,
    loading: false,
    availability: "NOT_CONFIGURED",
    events: [],
    attribution: null,
    message: null,
    ...partial,
  };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function parseHfmEconomicCalendarResponse(body: unknown): HfmEconomicCalendarView {
  const r = asRecord(body);
  if (!r) return emptyCalendarView({ availability: "UNAVAILABLE", message: "Invalid response" });

  const pkg = asRecord(r.package);
  const rawEvents = Array.isArray(r.events)
    ? r.events
    : Array.isArray(pkg?.events)
      ? pkg!.events
      : [];

  const events: HfmEconomicCalendarEventView[] = [];
  for (const item of rawEvents) {
    const e = asRecord(item);
    if (!e) continue;
    events.push({
      eventId: str(e.eventId) || str(e.id),
      title: str(e.title),
      currency: str(e.currency),
      impact: str(e.impact),
      scheduledAtUtc: str(e.scheduledAtUtc) || str(e.time),
      forecast: str(e.forecast),
      previous: str(e.previous),
      actual: str(e.actual),
      status: str(e.status),
      confidence: str(e.confidence),
    });
  }

  const attr = asRecord(r.attribution) ?? asRecord(pkg?.attribution);
  return {
    ok: Boolean(r.ok) || events.length > 0,
    loading: false,
    availability: str(r.availability) || str(pkg?.availability) || (events.length ? "OK" : "EMPTY"),
    events,
    attribution: attr
      ? { text: str(attr.text), url: str(attr.url), required: Boolean(attr.required) }
      : null,
    message: str(r.message) || null,
  };
}
