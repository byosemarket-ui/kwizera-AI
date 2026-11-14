/**
 * Refuse to serialize MT5 HFM secrets into API responses or logs.
 */
export function assertNoSecretsInMt5HfmPayload(
  payload: unknown,
  extraSecrets: string[] = [],
): void {
  const text = JSON.stringify(payload);
  const candidates = extraSecrets.map((s) => String(s ?? "").trim()).filter((s) => s.length >= 4);
  for (const secret of candidates) {
    if (text.includes(secret)) {
      throw new Error("Refusing to expose HFM MT5 password in API payload.");
    }
  }
  if (/"password"\s*:\s*"[^"]{4,}"/i.test(text)) {
    throw new Error("Refusing to expose HFM MT5 password field in API payload.");
  }
}
