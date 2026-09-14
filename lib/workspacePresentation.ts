export function workspaceStatus(input: {
  mode: "encode" | "decode";
  byteCount: number;
  error?: string;
  warning?: string;
  outputError?: string;
}): string {
  if (input.error) return "Check your input";
  if (input.warning) return "Complete the final byte";
  if (!input.byteCount) return input.mode === "encode" ? "Enter text to begin" : "Paste hex to begin";
  if (input.outputError) return "Choose another output view";
  return "Result ready";
}

export function outputHelp(mode: "encode" | "decode", view: "ascii" | "utf8" | "dump"): string {
  if (mode === "encode") return "Two hexadecimal digits represent one byte. Anyone can decode this result.";
  if (view === "utf8") return "UTF-8 reads text including emoji and international characters. Some binary data is not valid UTF-8.";
  if (view === "dump") return "Hex dump shows the original bytes with their row positions. Positions are labels, not part of your data.";
  return "ASCII shows basic characters; non-printable bytes appear as dots. Original bytes are preserved.";
}
