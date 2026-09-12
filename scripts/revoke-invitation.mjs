import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
const token = process.argv[2];
if (!url || !token) throw new Error("Usage: DATABASE_URL=... npm run revoke-invitation -- <invitation-token>");
const hash = createHash("sha256").update(token).digest("hex");
const sql = neon(url);
const result = await sql`UPDATE dead_drop_invitations SET revoked = TRUE WHERE token_hash = ${hash} RETURNING id`;
console.log(result.length ? "Invitation revoked." : "Invitation unavailable.");
