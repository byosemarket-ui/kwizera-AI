import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

export class LocalVideoEncoder {
  async encode(sourcePath: string, targetPath: string, codec: "h264" | "h265"): Promise<void> {
    if (!path.isAbsolute(sourcePath) || !path.isAbsolute(targetPath)) throw new Error("Video encoder paths must be absolute");
    const targetDirectory = path.dirname(targetPath);
    await fs.mkdir(targetDirectory, { recursive: true });
    try {
      await execFileAsync(process.env.KWIZERA_FFMPEG_PATH || "ffmpeg", ["-y", "-i", sourcePath, "-c:v", codec === "h265" ? "libx265" : "libx264", "-movflags", "+faststart", targetPath], { timeout: 20 * 60_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    } catch (error) {
      throw new Error(`FFmpeg local encoding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const output = await fs.stat(targetPath).catch(() => null);
    if (!output?.size) throw new Error("FFmpeg did not produce an encoded video file");
  }
}