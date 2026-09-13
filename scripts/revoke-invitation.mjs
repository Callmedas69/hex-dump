import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function envFileValue(name) {
  try {
    const line = readFileSync(".env", "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
  } catch { return undefined; }
}
const url = process.env.DATABASE_URL ?? envFileValue("DATABASE_URL");
const token = process.argv[2];
if (!url || !token) throw new Error("Usage: DATABASE_URL=... npm run revoke-invitation -- <invitation-token>");
const hash = createHash("sha256").update(token).digest("hex");
const sql = neon(url);
const result = await sql`UPDATE dead_drop_invitations SET revoked = TRUE WHERE token_hash = ${hash} RETURNING id`;
console.log(result.length ? "Invitation revoked." : "Invitation unavailable.");
