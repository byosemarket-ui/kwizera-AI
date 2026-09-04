/** Content fingerprints for duplicate detection and server checksum identity. */

/** Fast local fingerprint (name + size + head/tail). Not a cryptographic hash. */
export async function fingerprintFile(file: File): Promise<string> {
  const sliceSize = Math.min(file.size, 64 * 1024);
  const head = await file.slice(0, sliceSize).arrayBuffer();
  const tailStart = Math.max(0, file.size - sliceSize);
  const tail = tailStart > 0 ? await file.slice(tailStart, file.size).arrayBuffer() : head;
  const bytes = new Uint8Array(head.byteLength + (tail === head ? 0 : tail.byteLength));
  bytes.set(new Uint8Array(head), 0);
  if (tail !== head) bytes.set(new Uint8Array(tail), head.byteLength);

  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  hash ^= file.size;
  hash = Math.imul(hash, 16777619);
  for (let i = 0; i < file.name.length; i += 1) {
    hash ^= file.name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}-${file.size}`;
}

/** Real SHA-256 of full file bytes — used as checksumSha256 for server idempotency. */
export async function sha256File(file: File): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return fingerprintFile(file);
}

export function isSha256Hex(value: string | undefined | null): boolean {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve(width > 0 && height > 0 ? { width, height } : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
