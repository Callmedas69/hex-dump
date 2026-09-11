import twitterText from "twitter-text";

export const SHARE_WIDTH = 1600;
export const SHARE_HEIGHT = 900;
export type ShareSelection = { start: number; end: number; text: string };
export type ShareSnapshot = {
  bytes: Uint8Array;
  mode: "encode" | "decode";
  baseOffset: number;
  selection?: ShareSelection;
};

export function composerUrl(text: string): string {
  return `https://x.com/intent/tweet?${new URLSearchParams({ text })}`;
}

export function postLength(text: string): number {
  return twitterText.parseTweet(text).weightedLength;
}

export function validatePostText(text: string): string | null {
  if (!text.trim()) return "Add some post text first.";
  if (!twitterText.parseTweet(text).valid) return "Use valid post text within X's 280-character limit.";
  return null;
}

export function validateShare(text: string, bytes: Uint8Array): string | null {
  if (!bytes.length) return "Complete a conversion before sharing.";
  return validatePostText(text);
}

export function initialPostText(snapshot: ShareSnapshot): string {
  if (snapshot.mode === "encode") {
    // 93 complete, space-separated bytes fit in a standard 280-character X post.
    return Array.from(snapshot.bytes.subarray(0, 93), byte => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  }
  let message = snapshot.selection?.text;
  if (!message) message = "Discovering readable messages inside Bitcoin bytes.";
  const prefix = "Found in Bitcoin bytes: ";
  const originalCharacters = Array.from(message);
  const characters = originalCharacters.slice(0, 280);
  while (characters.length && postLength(prefix + characters.join("") + "\n#Bitcoin") > 275) characters.pop();
  return prefix + characters.join("") + (characters.length < originalCharacters.length ? "…" : "") + "\n#Bitcoin";
}

/** Byte-aligned excerpts keep original offsets; the renderer marks omitted data. */
export function cardExcerpt(snapshot: ShareSnapshot, maximumBytes = 192) {
  const start = Math.floor((snapshot.selection?.start ?? 0) / 16) * 16;
  const end = Math.min(snapshot.bytes.length, start + maximumBytes);
  return { start, end, truncated: start > 0 || end < snapshot.bytes.length };
}
