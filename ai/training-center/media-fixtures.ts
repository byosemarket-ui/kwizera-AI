/**
 * Phase 20 — Admin-only verification fixtures generated on the server with FFmpeg lavfi sources.
 * Presets are fixed (no caller-controlled FFmpeg arguments); output is bounded in duration and size and returned as
 * bytes so it can be uploaded through the normal teaching path. Synthetic fixtures are labelled as such: the
 * "speech-like" preset is amplitude-modulated noise, not real speech.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface FixturePreset {
  id: string;
  kind: "VIDEO" | "AUDIO";
  fileName: string;
  mimeType: string;
  description: string;
  /** Written to a non-seekable pipe, so the container has no duration header (browser MediaRecorder-like). */
  pipe?: boolean;
  args: (out: string) => string[];
}

const lavfi = (graph: string) => ["-f", "lavfi", "-i", graph];
const H264 = ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"];
const AAC = ["-c:a", "aac", "-b:a", "128k"];
/** 120 BPM click with a bass tone on every beat and a louder accent every 4th beat. */
const beat = (d: number, rate = 44_100) => `aevalsrc='0.6*sin(2*PI*110*t)*exp(-12*mod(t,0.5))*(1+0.8*lt(mod(t,2),0.5))+0.3*sin(2*PI*880*t)*exp(-40*mod(t,0.5))':s=${rate}:d=${d}`;
const tone = (d: number) => `sine=frequency=440:sample_rate=48000:duration=${d}`;
const scene = (bg: string, w: number, h: number, d: number, box: string) => `color=c=${bg}:s=${w}x${h}:r=30:d=${d},drawbox=${box}:color=0xE0A040:t=fill`;

const video = (id: string, fileName: string, mimeType: string, description: string, args: (out: string) => string[], pipe = false): FixturePreset => ({ id, kind: "VIDEO", fileName, mimeType, description, args, pipe });
const audio = (id: string, fileName: string, mimeType: string, description: string, args: (out: string) => string[], pipe = false): FixturePreset => ({ id, kind: "AUDIO", fileName, mimeType, description, args, pipe });

/** Story A: hook → fade → reveal → fade → close-up (push-in) → cut → CTA band. */
const STORY_A = [
  scene("0x101010", 720, 1280, 2, "x=310:y=590:w=100:h=140"),
  scene("0x202830", 720, 1280, 2, "x=235:y=480:w=250:h=350"),
  "color=c=0x202830:s=720x1280:r=30:d=2,drawbox=x=160:y=380:w=400:h=560:color=0xE0A040:t=fill,zoompan=z='1+0.004*on':d=1:s=720x1280:fps=30",
  "color=c=0xF0F0F0:s=720x1280:r=30:d=2,drawbox=x=235:y=380:w=250:h=350:color=0xE0A040:t=fill,drawbox=x=60:y=1060:w=600:h=110:color=0x202020:t=fill",
];
/** Story B: wide → fast slide cuts alternating left/right detail → offer band → CTA. */
const STORY_B = [
  scene("0x3050A0", 1280, 720, 1, "x=100:y=260:w=240:h=200"),
  scene("0x3050A0", 1280, 720, 0.7, "x=900:y=160:w=300:h=400"),
  scene("0x2A2A2A", 1280, 720, 0.7, "x=80:y=120:w=420:h=480"),
  scene("0x2A2A2A", 1280, 720, 0.7, "x=780:y=120:w=420:h=480"),
  "color=c=0xC02020:s=1280x720:r=30:d=1.4,drawbox=x=80:y=200:w=320:h=320:color=0xE0A040:t=fill,drawbox=x=560:y=260:w=620:h=200:color=0xFFFFFF:t=fill",
];

function storyGraph(parts: string[], transitions: Array<{ type: string; dur: number } | null>, durations: number[]): string[] {
  const inputs = parts.flatMap((p) => lavfi(p));
  let chain = "";
  let prev = "[0:v]";
  let offset = durations[0]!;
  for (let i = 1; i < parts.length; i += 1) {
    const t = transitions[i - 1];
    const label = `[v${i}]`;
    if (t) {
      offset -= t.dur;
      chain += `${prev}[${i}:v]xfade=transition=${t.type}:duration=${t.dur}:offset=${offset.toFixed(2)}${label};`;
    } else chain += `${prev}[${i}:v]concat=n=2:v=1:a=0${label};`;
    offset += durations[i]!;
    prev = label;
  }
  return [...inputs, "-filter_complex", chain.replace(/;$/, ""), "-map", prev];
}

export const FIXTURE_PRESETS: FixturePreset[] = [
  video("v-mp4-h264-aac", "p20-mp4-h264-aac.mp4", "video/mp4", "MP4 H.264 + AAC 1280×720, 6 s, 120 BPM track",
    (o) => [...lavfi("testsrc2=s=1280x720:r=30:d=6"), ...lavfi(beat(6)), ...H264, ...AAC, "-shortest", o]),
  video("v-mp4-640x480", "p20-mp4-640x480.mp4", "video/mp4", "MP4 640×480 (4:3), 4 s", (o) => [...lavfi("testsrc2=s=640x480:r=25:d=4"), ...lavfi(tone(4)), ...H264, ...AAC, "-shortest", o]),
  video("v-vertical", "p20-vertical-1080x1920.mp4", "video/mp4", "Vertical 1080×1920, 4 s", (o) => [...lavfi("testsrc2=s=1080x1920:r=30:d=4"), ...lavfi(beat(4)), ...H264, ...AAC, "-shortest", o]),
  video("v-horizontal", "p20-horizontal-1920x1080.mp4", "video/mp4", "Horizontal 1920×1080, 4 s", (o) => [...lavfi("testsrc2=s=1920x1080:r=30:d=4"), ...lavfi(beat(4)), ...H264, ...AAC, "-shortest", o]),
  video("v-square", "p20-square-1080.mp4", "video/mp4", "Square 1080×1080, 4 s", (o) => [...lavfi("testsrc2=s=1080x1080:r=30:d=4"), ...lavfi(tone(4)), ...H264, ...AAC, "-shortest", o]),
  video("v-short", "p20-short-1s.mp4", "video/mp4", "Short 1 s", (o) => [...lavfi("testsrc2=s=640x360:r=30:d=1"), ...lavfi(tone(1)), ...H264, ...AAC, "-shortest", o]),
  video("v-long", "p20-long-45s.mp4", "video/mp4", "Longer 45 s, 640×360, cuts every 5 s", (o) => [...lavfi("testsrc2=s=640x360:r=24:d=45,hue=h='360*floor(t/5)/9'"), ...lavfi(beat(45)), ...H264, ...AAC, "-shortest", o]),
  video("v-no-audio", "p20-no-audio.mp4", "video/mp4", "MP4 without an audio track", (o) => [...lavfi("testsrc2=s=720x1280:r=30:d=4"), ...H264, "-an", o]),
  video("v-text", "p20-text-bands.mp4", "video/mp4", "Headline and CTA text bands (drawn text-like bars)",
    (o) => [...lavfi("color=c=0x1A1A1A:s=720x1280:r=30:d=4,drawbox=x=60:y=120:w=600:h=90:color=white:t=fill,drawbox=x=60:y=240:w=420:h=40:color=0xCCCCCC:t=fill,drawbox=x=160:y=1080:w=400:h=100:color=0xE04040:t=fill,drawgrid=w=12:h=12:t=1:c=black@0.9"), ...lavfi(tone(4)), ...H264, ...AAC, "-shortest", o]),
  video("v-story-a", "p20-story-a.mp4", "video/mp4", "Story A (vertical): hook → fade → reveal → fade → push-in close-up → cut → CTA band; slow pacing",
    (o) => [...storyGraph(STORY_A, [{ type: "fade", dur: 0.5 }, { type: "fade", dur: 0.5 }, null], [2, 2, 2, 2]), ...H264, "-an", o]),
  video("v-story-b", "p20-story-b.mp4", "video/mp4", "Story B (horizontal): wide → fast slide cuts left/right detail → offer band; fast pacing",
    (o) => [...storyGraph(STORY_B, [null, { type: "slideleft", dur: 0.3 }, { type: "slideright", dur: 0.3 }, null], [1, 0.7, 0.7, 0.7, 1.4]), ...H264, "-an", o]),
  video("v-mov", "p20-quicktime.mov", "video/quicktime", "QuickTime MOV (H.264 + AAC)", (o) => [...lavfi("testsrc2=s=1280x720:r=30:d=4"), ...lavfi(tone(4)), ...H264, ...AAC, "-shortest", "-f", "mov", o]),
  video("v-webm", "p20-vp9-opus.webm", "video/webm", "WebM VP8 + Opus", (o) => [...lavfi("testsrc2=s=640x360:r=30:d=4"), ...lavfi(tone(4)), "-c:v", "libvpx", "-deadline", "realtime", "-b:v", "800k", "-c:a", "libopus", "-shortest", o]),
  video("v-webm-recorder", "p20-recorder.webm", "video/webm", "WebM written to a pipe: no duration header (MediaRecorder-like)",
    (o) => [...lavfi("testsrc2=s=640x360:r=30:d=4"), ...lavfi(tone(4)), "-c:v", "libvpx", "-deadline", "realtime", "-b:v", "800k", "-c:a", "libopus", "-shortest", "-f", "webm", o], true),
  video("v-mkv", "p20-matroska.mkv", "video/x-matroska", "Matroska MPEG-4 Part 2 + FLAC (normalised)", (o) => [...lavfi("testsrc2=s=640x360:r=30:d=4"), ...lavfi(tone(4)), "-c:v", "mpeg4", "-q:v", "5", "-c:a", "flac", "-shortest", o]),
  video("v-avi", "p20-legacy.avi", "video/x-msvideo", "AVI MPEG-4 Part 2 + MP3", (o) => [...lavfi("testsrc2=s=640x360:r=25:d=4"), ...lavfi(tone(4)), "-c:v", "mpeg4", "-q:v", "5", "-c:a", "libmp3lame", "-shortest", o]),
  video("v-mpeg", "p20-program.mpg", "video/mpeg", "MPEG-PS MPEG-2 + MP2", (o) => [...lavfi("testsrc2=s=720x576:r=25:d=4"), ...lavfi(tone(4)), "-c:v", "mpeg2video", "-q:v", "5", "-c:a", "mp2", "-shortest", "-f", "mpeg", o]),
  video("v-m4v", "p20-apple.m4v", "video/x-m4v", "M4V H.264 + AAC", (o) => [...lavfi("testsrc2=s=960x540:r=30:d=4"), ...lavfi(tone(4)), ...H264, ...AAC, "-shortest", "-f", "ipod", o]),
  video("v-fps-23976", "p20-23976fps.mp4", "video/mp4", "Unusual frame rate 23.976 fps", (o) => [...lavfi("testsrc2=s=640x360:r=24000/1001:d=4"), ...H264, "-an", o]),
  video("v-ultrawide", "p20-ultrawide-21x9.mp4", "video/mp4", "Unusual aspect ratio 21:9 (1260×540)", (o) => [...lavfi("testsrc2=s=1260x540:r=30:d=4"), ...H264, "-an", o]),
  video("v-vfr", "p20-variable-fps.mkv", "video/x-matroska", "Variable frame rate (30 fps then 10 fps)",
    (o) => [...lavfi("testsrc2=s=640x360:r=30:d=6"), "-vf", "select='lt(t\\,3)+not(mod(n\\,3))'", "-vsync", "vfr", ...H264, "-an", o]),
  video("v-rotated", "p20-rotated.mp4", "video/mp4", "Phone-style rotation metadata (90°)", (o) => [...lavfi("testsrc2=s=1280x720:r=30:d=3"), ...H264, "-an", "-metadata:s:v:0", "rotate=90", o]),

  audio("a-mp3", "p20-music.mp3", "audio/mpeg", "MP3 stereo 44.1 kHz, 120 BPM, 12 s", (o) => [...lavfi(beat(12)), "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k", o]),
  audio("a-wav", "p20-music.wav", "audio/wav", "WAV PCM 16-bit, 120 BPM, 12 s", (o) => [...lavfi(beat(12)), "-ac", "2", "-c:a", "pcm_s16le", o]),
  audio("a-m4a", "p20-music.m4a", "audio/mp4", "M4A AAC, 120 BPM, 12 s", (o) => [...lavfi(beat(12)), "-ac", "2", ...AAC, o]),
  audio("a-aac", "p20-music.aac", "audio/aac", "Raw ADTS AAC, 12 s", (o) => [...lavfi(beat(12)), "-ac", "2", ...AAC, "-f", "adts", o]),
  audio("a-flac", "p20-music.flac", "audio/flac", "FLAC, 12 s", (o) => [...lavfi(beat(12)), "-ac", "2", "-c:a", "flac", o]),
  audio("a-opus", "p20-voice.opus", "audio/ogg", "Ogg Opus written to a pipe (no duration header)", (o) => [...lavfi(beat(12, 48_000)), "-c:a", "libopus", "-f", "ogg", o], true),
  audio("a-webm", "p20-recorder-audio.webm", "audio/webm", "Audio-only WebM Opus from a pipe (MediaRecorder-like)", (o) => [...lavfi(beat(8, 48_000)), "-c:a", "libopus", "-f", "webm", o], true),
  audio("a-speech-like", "p20-speech-like.wav", "audio/wav", "Speech-like synthetic (syllable-rate modulated noise; not real speech)",
    (o) => [...lavfi("anoisesrc=color=pink:amplitude=0.5:d=10:r=16000,volume='0.2+0.8*gt(sin(2*PI*4*t),0.2)*gt(sin(2*PI*0.4*t),-0.6)':eval=frame,lowpass=f=3400,highpass=f=200"), "-ac", "1", "-c:a", "pcm_s16le", o]),
  audio("a-silence-gap", "p20-music-silence.wav", "audio/wav", "Music, 4 s silence, music", (o) => [...lavfi(`${beat(12)},volume='if(between(t,4,8),0,1)':eval=frame`), "-c:a", "pcm_s16le", o]),
  audio("a-short", "p20-short.wav", "audio/wav", "Short 1 s", (o) => [...lavfi(beat(1)), "-c:a", "pcm_s16le", o]),
  audio("a-long", "p20-long.mp3", "audio/mpeg", "Longer 90 s", (o) => [...lavfi(beat(90)), "-c:a", "libmp3lame", "-b:a", "128k", o]),
  audio("a-mono-8k", "p20-mono-8k.wav", "audio/wav", "Mono 8 kHz", (o) => [...lavfi(beat(8, 8_000)), "-ac", "1", "-c:a", "pcm_s16le", o]),
  audio("a-stereo-48k", "p20-stereo-48k.wav", "audio/wav", "Stereo 48 kHz", (o) => [...lavfi(beat(8, 48_000)), "-ac", "2", "-c:a", "pcm_s16le", o]),
  audio("a-22k", "p20-22k.mp3", "audio/mpeg", "22.05 kHz MP3", (o) => [...lavfi(beat(8, 22_050)), "-c:a", "libmp3lame", o]),
];

const MAX_FIXTURE_BYTES = 20 * 1024 * 1024;
let busy = false;

export async function generateFixture(id: string): Promise<{ fileName: string; mimeType: string; kind: "VIDEO" | "AUDIO"; description: string; dataBase64: string; sizeBytes: number }> {
  const preset = FIXTURE_PRESETS.find((p) => p.id === id);
  if (!preset) throw Object.assign(new Error("Unknown fixture preset."), { code: "UNKNOWN_FIXTURE" });
  if (busy) throw Object.assign(new Error("Another fixture is being generated; retry shortly."), { code: "FIXTURE_BUSY" });
  busy = true;
  const { ffmpegBinary } = await import("../video-production/ffmpeg-renderer.js");
  const out = path.join(os.tmpdir(), `kwz-teach-fixture-${randomUUID()}${path.extname(preset.fileName)}`);
  try {
    const target = preset.pipe ? "pipe:1" : out;
    const args = ["-nostdin", "-hide_banner", "-v", "error", "-y", ...preset.args(target)];
    const bytes = await new Promise<Buffer>((resolve, reject) => {
      execFile(ffmpegBinary(), args, { timeout: 120_000, windowsHide: true, maxBuffer: MAX_FIXTURE_BYTES, encoding: "buffer" }, async (err, stdout, stderr) => {
        if (err) return reject(Object.assign(new Error(`FFmpeg could not generate ${preset.id}: ${String(stderr).split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 200) ?? err.message}`), { code: "FIXTURE_FAILED" }));
        resolve(preset.pipe ? stdout : await fs.readFile(out));
      });
    });
    if (!bytes.length || bytes.length > MAX_FIXTURE_BYTES) throw Object.assign(new Error("Fixture output is empty or too large."), { code: "FIXTURE_FAILED" });
    return { fileName: preset.fileName, mimeType: preset.mimeType, kind: preset.kind, description: preset.description, dataBase64: bytes.toString("base64"), sizeBytes: bytes.length };
  } finally {
    busy = false;
    await fs.rm(out, { force: true }).catch(() => undefined);
  }
}
