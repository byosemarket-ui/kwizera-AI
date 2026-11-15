import { describe, expect, it } from "vitest";

/** Mirrors hfm-sse-client parseSseChunk (kept local to avoid DOM fetch in unit tests). */
function parseSseChunk(
  buffer: string,
): { events: Array<{ event: string; data: string }>; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: Array<{ event: string; data: string }> = [];
  for (const block of parts) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length) events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

describe("HFM SSE framing", () => {
  it("parses event/data blocks and retains partial remainder", () => {
    const raw =
      'event: hello\ndata: {"type":"hello","broker":"HFM_MT5"}\n\nevent: quote\ndata: {"type":"quote"\n';
    const { events, rest } = parseSseChunk(raw);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("hello");
    expect(JSON.parse(events[0].data).broker).toBe("HFM_MT5");
    expect(rest.startsWith("event: quote")).toBe(true);
  });
});
