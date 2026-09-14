export type DeadDropEnvelope = {
  v: 1;
  iv: string;
  ciphertext: string;
};

const MAX_PLAINTEXT_BYTES = 16 * 1024;
// Base64url expands the encrypted bytes, which include a 16-byte GCM tag.
const MAX_CIPHERTEXT_CHARACTERS = Math.ceil((MAX_PLAINTEXT_BYTES + 16) * 4 / 3);
export const MAX_ENVELOPE_BYTES = JSON.stringify({ v: 1, iv: "A".repeat(16), ciphertext: "A".repeat(MAX_CIPHERTEXT_CHARACTERS) }).length;

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Malformed encrypted payload.");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function assertEnvelope(envelope: unknown): asserts envelope is DeadDropEnvelope {
  if (!envelope || typeof envelope !== "object") throw new Error("Malformed encrypted payload.");
  const value = envelope as Record<string, unknown>;
  if (value.v !== 1 || typeof value.iv !== "string" || typeof value.ciphertext !== "string") throw new Error("Malformed encrypted payload.");
  if (value.iv.length !== 16 || value.ciphertext.length > MAX_CIPHERTEXT_CHARACTERS) throw new Error("Malformed encrypted payload.");
  const iv = fromBase64Url(value.iv);
  const ciphertext = fromBase64Url(value.ciphertext);
  if (iv.length !== 12 || ciphertext.length < 16 || ciphertext.length > MAX_PLAINTEXT_BYTES + 16) throw new Error("Malformed encrypted payload.");
}

export async function encryptDeadDrop(plaintext: string) {
  const bytes = new TextEncoder().encode(plaintext);
  if (bytes.length > MAX_PLAINTEXT_BYTES) throw new Error("Transmission is limited to 16 KiB of UTF-8.");
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { envelope: { v: 1 as const, iv: toBase64Url(iv), ciphertext: toBase64Url(ciphertext) }, key: toBase64Url(rawKey) };
}

export async function decryptDeadDrop(envelope: unknown, encodedKey: string) {
  assertEnvelope(envelope);
  const keyBytes = fromBase64Url(encodedKey);
  if (keyBytes.length !== 32) throw new Error("Missing or invalid link key.");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(envelope.iv) }, key, fromBase64Url(envelope.ciphertext));
  return new TextDecoder().decode(plaintext);
}

export function validateDeadDropEnvelope(value: unknown) {
  assertEnvelope(value);
  return { v: value.v, iv: value.iv, ciphertext: value.ciphertext };
}

export { MAX_PLAINTEXT_BYTES };
