/**
 * Post-render filesystem verification — output must exist on disk before VIDEO READY.
 */
import fs from "node:fs/promises";

const MP4_SIGNATURE = Buffer.from([0x00, 0x00, 0x00]);

export interface OutputFileVerification {
  valid: boolean;
  issues: string[];
  sizeBytes: number;
  mimeLooksLikeMp4: boolean;
}

export async function verifyOutputFileOnDisk(filePath: string): Promise<OutputFileVerification> {
  const issues: string[] = [];
  let sizeBytes = 0;
  let mimeLooksLikeMp4 = false;

  try {
    const stat = await fs.stat(filePath);
    sizeBytes = stat.size;
    if (!stat.isFile()) issues.push("Output path is not a file.");
    if (sizeBytes <= 0) issues.push("Output file is empty.");
    if (sizeBytes < 1000) issues.push("Output file is too small to be a valid video.");
  } catch {
    issues.push("Output file does not exist on disk.");
    return { valid: false, issues, sizeBytes, mimeLooksLikeMp4 };
  }

  try {
    const handle = await fs.open(filePath, "r");
    try {
      const header = Buffer.alloc(12);
      await handle.read(header, 0, 12, 0);
      // MP4/MOV typically has ftyp at offset 4.
      mimeLooksLikeMp4 = header.slice(4, 8).toString("ascii") === "ftyp"
        || header.slice(0, 3).equals(MP4_SIGNATURE);
      if (!mimeLooksLikeMp4) {
        issues.push("Output file does not look like MP4.");
      }
    } finally {
      await handle.close();
    }
  } catch {
    issues.push("Unable to read output file header.");
  }

  return {
    valid: issues.length === 0,
    issues,
    sizeBytes,
    mimeLooksLikeMp4,
  };
}
