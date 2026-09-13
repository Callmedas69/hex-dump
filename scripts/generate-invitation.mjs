import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function envFileValue(name) {
  try {
    const line = readFileSync(".env", "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "");
  } catch { return undefined; }
}
const url = process.env.DATABASE_URL ?? envFileValue("DATABASE_URL");
if (!url) throw new Error("DATABASE_URL is required");
const deposits = Number(process.argv[2] ?? 10);
const days = Number(process.argv[3] ?? 7);
if (!Number.isInteger(deposits) || deposits < 1 || deposits > 1000 || !Number.isFinite(days) || days <= 0 || days > 365) throw new Error("Usage: npm run invitation -- <deposits> <valid-days>");
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
const sql = neon(url);
await sql`CREATE TABLE IF NOT EXISTS dead_drop_invitations (id BIGSERIAL PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, remaining_deposits INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL, revoked BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
await sql`INSERT INTO dead_drop_invitations (token_hash, remaining_deposits, expires_at) VALUES (${hash}, ${deposits}, NOW() + (${days} * INTERVAL '1 day'))`;
console.log(`Invitation (display once): ${token}`);
