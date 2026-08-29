import { describe, expect, it } from "vitest";
import { ASPECT_OPTIONS, CAMERA_OPTIONS, MOTION_OPTIONS, TRANSITION_OPTIONS } from "../../../desktop/video-production/api.ts";

describe("Video Production workspace controls", () => {
  it("exposes only renderer-backed camera, motion, transition, and aspect options", () => {
    expect(CAMERA_OPTIONS).toContain("close-up");
    expect(CAMERA_OPTIONS).toContain("orbit");
    expect(MOTION_OPTIONS).toContain("slow-zoom");
    expect(TRANSITION_OPTIONS).toEqual(["cut", "fade"]);
    expect(ASPECT_OPTIONS).toEqual(["16:9", "9:16", "1:1"]);
  });
});
