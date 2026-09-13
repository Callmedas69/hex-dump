import { cardExcerpt, SHARE_HEIGHT, SHARE_WIDTH, type ShareSnapshot } from "./share";

export function wrapCardText(text: string, measure: (text: string) => number, width: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  let truncated = false;
  for (const glyph of Array.from(text)) {
    if (glyph === "\n" || measure(line + glyph) > width) {
      const space = glyph === "\n" ? -1 : line.lastIndexOf(" ");
      const remainder = space > 0 ? line.slice(space + 1) : "";
      lines.push(space > 0 ? line.slice(0, space) : line);
      line = remainder;
      if (lines.length === maxLines) { truncated = true; break; }
      if (glyph === "\n" || (glyph === " " && !line)) continue;
    }
    line += glyph;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last && measure(last + " …") > width) last = Array.from(last).slice(0, -1).join("");
    lines[lines.length - 1] = last + " …";
  }
  return { lines, truncated };
}

export async function renderShareImage(snapshot: ShareSnapshot): Promise<Blob> {
  const bodyFont = getComputedStyle(document.body).fontFamily || "monospace";
  const titleFont = getComputedStyle(document.documentElement).getPropertyValue("--font-nokia-title").trim() || "monospace";
  await document.fonts.load(`46px ${titleFont}`);
  await document.fonts.load(`21px ${bodyFont}`);
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image rendering is unavailable in this browser.");
  const font = bodyFont;
  ctx.fillStyle = "#91ad50";
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  // A static LCD cell grid stays subtle enough to preserve byte contrast.
  ctx.fillStyle = "#899f49";
  for (let y = 0; y < SHARE_HEIGHT; y += 6) {
    for (let x = 0; x < SHARE_WIDTH; x += 6) ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = "#586f32";
  ctx.strokeRect(35, 35, 1530, 830);
  ctx.fillStyle = "#17230f";
  // Pixel signal bars echo the reference's old mobile-phone display.
  for (let column = 0; column < 5; column++) {
    for (let row = 0; row <= column; row++) ctx.fillRect(1380 + column * 24, 137 - row * 18, 17, 12);
  }
  ctx.font = `400 46px ${titleFont}`;
  ctx.fillText("HEXONION", 75, 115);
  ctx.fillStyle = "#354622";
  ctx.font = `20px ${font}`;
  ctx.fillText(`${snapshot.mode.toUpperCase()} / ${snapshot.bytes.length.toLocaleString()} BYTES`, 75, 160);
  ctx.font = `21px ${font}`;
  const excerpt = snapshot.mode === "encode" ? { start: 0, end: Math.min(snapshot.bytes.length, 384), truncated: snapshot.bytes.length > 384 } : cardExcerpt(snapshot);
  const columns = snapshot.mode === "encode" ? 32 : 16;
  for (let i = excerpt.start, row = 0; i < excerpt.end; i += columns, row++) {
    if (row >= 12) break;
    const y = 237 + row * 39;
    ctx.fillStyle = "#354622";
    ctx.fillText((snapshot.baseOffset + i).toString(16).padStart(8, "0").toUpperCase(), 75, y);
    for (let j = 0; j < columns && i + j < excerpt.end; j++) {
      const x = snapshot.mode === "encode" ? 225 + j * 36 + Math.floor(j / 8) * 18 : 225 + j * 33 + (j >= 8 ? 18 : 0);
      const selected = snapshot.mode === "decode" && snapshot.selection && i + j >= snapshot.selection.start && i + j < snapshot.selection.end;
      if (selected) { ctx.fillStyle = "#17230f"; ctx.fillRect(x - 3, y - 25, 32, 33); }
      ctx.fillStyle = selected ? "#b5cc7a" : "#17230f";
      ctx.fillText(snapshot.bytes[i + j].toString(16).padStart(2, "0").toUpperCase(), x, y);
    }
  }
  let wrapped = { lines: [] as string[], truncated: false };
  if (snapshot.mode === "decode") {
    ctx.strokeStyle = "#586f32"; ctx.beginPath(); ctx.moveTo(830, 205); ctx.lineTo(830, 737); ctx.stroke();
    ctx.font = `18px ${font}`; ctx.fillStyle = "#354622"; ctx.fillText("READABLE BYTES", 875, 227);
    const message = snapshot.selection?.text || "Inspect the raw bytes to discover readable text.";
    ctx.font = `29px ${font}`; ctx.fillStyle = "#17230f";
    wrapped = wrapCardText(message, (line) => ctx.measureText(line).width, 600, 11);
    wrapped.lines.forEach((line, index) => ctx.fillText(line, 875, 280 + index * 39));
  }
  ctx.fillStyle = "#354622";
  ctx.font = `18px ${font}`;
  const range = `${(snapshot.baseOffset + excerpt.start).toString(16).padStart(8, "0")}–${(snapshot.baseOffset + excerpt.end - 1).toString(16).padStart(8, "0")}`;
  ctx.fillText(`${excerpt.truncated ? "BYTE EXCERPT" : "BYTE RANGE"} / ${range}`, 75, 790);
  if (wrapped.truncated) ctx.fillText("TEXT EXCERPT — CONTINUES", 875, 790);
  ctx.fillText("ENCODE. DECODE. DISCOVER.", 75, 805);
  ctx.font = `18px ${font}`;
  ctx.fillText("Bitcoin hex encoder · decoder · private dead drops", 75, 832);
  ctx.fillText("Encrypted in your browser", 75, 856);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export the image.")), "image/png"));
}
