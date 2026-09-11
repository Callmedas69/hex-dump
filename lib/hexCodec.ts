export const MAX_BYTES = 64 * 1024;

export type ParsedHex = { bytes: Uint8Array; warning?: string; baseOffset: number };
export type TextRun = { start: number; end: number; text: string };

export function encodeText(text: string, limit = MAX_BYTES): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > limit) throw new Error(`Input exceeds the ${limit.toLocaleString()} byte limit.`);
  return bytes;
}

export function parseRawHex(input: string, limit = MAX_BYTES): ParsedHex {
  const compact = input.replace(/\s+/g, "");
  if (!compact) return { bytes: new Uint8Array(), baseOffset: 0 };
  if (/[^0-9a-f]/i.test(compact)) throw new Error("Invalid hex character. Use digits 0–9 and letters A–F.");
  const warning = compact.length % 2 ? "Trailing half-byte ignored until completed." : undefined;
  const complete = compact.slice(0, compact.length - (compact.length % 2));
  const bytes = Uint8Array.from({ length: complete.length / 2 }, (_, i) => parseInt(complete.slice(i * 2, i * 2 + 2), 16));
  if (bytes.length > limit) throw new Error(`Input exceeds the ${limit.toLocaleString()} byte limit.`);
  return { bytes, warning, baseOffset: 0 };
}

export function parseOffsetDump(input: string, limit = MAX_BYTES): ParsedHex {
  const rows = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return { bytes: new Uint8Array(), baseOffset: 0 };
  const parsed: number[] = []; let base = -1; let expected = 0;
  rows.forEach((row, rowIndex) => {
    const match = row.match(/^([0-9a-f]{8})\s+((?:[0-9a-f]{2}\s*){1,16})$/i);
    if (!match) throw new Error(`Malformed offset row ${rowIndex + 1}. Expected 8-digit offset followed by bytes.`);
    const offset = parseInt(match[1], 16); const tokens = match[2].trim().split(/\s+/);
    if (tokens.some((token) => !/^[0-9a-f]{2}$/i.test(token))) throw new Error(`Malformed byte in row ${rowIndex + 1}.`);
    if (base < 0) { base = offset; expected = offset; }
    if (offset !== expected) throw new Error(`Offset discontinuity on row ${rowIndex + 1}: expected ${expected.toString(16).padStart(8, "0")}.`);
    if (rowIndex < rows.length - 1 && tokens.length !== 16) throw new Error(`Row ${rowIndex + 1} must contain exactly 16 bytes.`);
    tokens.forEach((token) => parsed.push(parseInt(token, 16))); expected += tokens.length;
  });
  if (parsed.length > limit) throw new Error(`Input exceeds the ${limit.toLocaleString()} byte limit.`);
  return { bytes: Uint8Array.from(parsed), baseOffset: base };
}

export function decodeAscii(bytes: Uint8Array): string { return Array.from(bytes, (b) => b >= 32 && b <= 126 ? String.fromCharCode(b) : ".").join(""); }
export function decodeUtf8(bytes: Uint8Array): string { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
export function toHex(bytes: Uint8Array): string { return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" "); }
export function formatDump(bytes: Uint8Array, baseOffset = 0, width = 16): string {
  if (!Number.isInteger(width) || width < 1 || width > 64) throw new Error("Row width must be between 1 and 64.");
  const rows: string[] = [];
  for (let i = 0; i < bytes.length; i += width) {
    const part = Array.from(bytes.slice(i, i + width), (b) => b.toString(16).padStart(2, "0"));
    const groups: string[] = []; for (let j = 0; j < part.length; j += 8) groups.push(part.slice(j, j + 8).join(" "));
    rows.push(`${(baseOffset + i).toString(16).padStart(8, "0")}  ${groups.join("  ")}`);
  }
  return rows.join("\n");
}
export function discoverTextRuns(bytes: Uint8Array, minimum = 4): TextRun[] {
  const runs: TextRun[] = []; let start = -1;
  const flush = (end: number) => { if (start >= 0 && end - start >= minimum) runs.push({ start, end, text: String.fromCharCode(...bytes.slice(start, end)) }); start = -1; };
  bytes.forEach((b, i) => { if (b >= 32 && b <= 126) { if (start < 0) start = i; } else flush(i); }); flush(bytes.length); return runs;
}
