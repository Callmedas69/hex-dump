import "server-only";

export function validatePng(base64: unknown): Buffer {
  if (typeof base64 !== "string" || base64.length > 7_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error("Use the generated PNG image.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length < 33 || bytes.length > 5_000_000 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.subarray(12, 16).toString() !== "IHDR" || bytes.readUInt32BE(16) !== 1600 || bytes.readUInt32BE(20) !== 900) throw new Error("The image must be a 1600 × 900 PNG under 5 MB.");
  return bytes;
}

export async function publishToX(accessToken: string, text: string, image: Buffer, request: typeof fetch = fetch): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const upload = await request("https://api.x.com/2/media/upload", { method: "POST", headers, body: JSON.stringify({ media: image.toString("base64"), media_category: "tweet_image", media_type: "image/png" }), signal: AbortSignal.timeout(30_000) });
  if (!upload.ok) throw new Error(upload.status === 401 ? "X session expired. Reconnect to X." : "X rejected the image upload. Check API access and try the download option.");
  const media = await upload.json();
  if (!/^\d+$/.test(media.data?.id ?? "")) throw new Error("X did not return a media identifier. Nothing was posted.");
  if (media.data?.processing_info && media.data.processing_info.state !== "succeeded") throw new Error("X has not finished processing this image. Nothing was posted; use the download option.");
  let response: Response;
  try {
    response = await request("https://api.x.com/2/tweets", { method: "POST", headers, body: JSON.stringify({ text, media: { media_ids: [media.data.id] } }), signal: AbortSignal.timeout(30_000) });
  } catch { throw new Error("X did not confirm the result. Check your profile before trying a new draft to avoid duplicate posts."); }
  if (!response.ok) throw new Error(response.status === 401 ? "X session expired. Reconnect to X." : "X rejected the post. Check your API access, post text, and account limits.");
  const post = await response.json();
  if (!/^\d+$/.test(post.data?.id ?? "")) throw new Error("X did not confirm a post URL. Check your profile before trying again.");
  return `https://x.com/i/status/${post.data.id}`;
}
