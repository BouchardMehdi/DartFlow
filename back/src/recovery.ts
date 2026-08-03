import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const payloadLength = 24;

export function normalizeRecoveryCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.startsWith("DF") ? compact.slice(2) : compact;
}

export function generateRecoveryCode(): string {
  const bytes = randomBytes(payloadLength);
  const payload = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `DF-${payload.match(/.{1,6}/g)?.join("-") ?? payload}`;
}

export function hashRecoveryCode(value: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(value)).digest("hex");
}

export function verifyRecoveryCode(value: string, expectedHash: string | null | undefined): boolean {
  const normalized = normalizeRecoveryCode(value);
  if (normalized.length !== payloadLength || !expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  return timingSafeEqual(Buffer.from(hashRecoveryCode(normalized), "hex"), Buffer.from(expectedHash, "hex"));
}
