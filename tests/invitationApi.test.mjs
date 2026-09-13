import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("invitation APIs require signed, one-time token-holder authorization", async () => {
  const challenge = await readFile(new URL("../app/api/invitations/challenge/route.ts", import.meta.url), "utf8");
  const create = await readFile(new URL("../app/api/invitations/route.ts", import.meta.url), "utf8");
  assert.match(challenge, /randomBytes\(32\)/);
  assert.match(challenge, /createInvitationChallenge/);
  assert.match(create, /verifyMessage/);
  assert.match(create, /consumeInvitationChallenge/);
  assert.match(create, /productionPolicy\(process\.env\)/);
  assert.match(create, /developmentPolicy\(process\.env\.NEXT_PUBLIC_USDG_PROFILE\)/);
  assert.match(create, /balanceOf/);
  assert.match(create, /createHash\("sha256"\)/);
  assert.doesNotMatch(create, /console\.log/);
});

test("invitation creator explains one-time token handling", async () => {
  const ui = await readFile(new URL("../components/InvitationCreator.tsx", import.meta.url), "utf8");
  assert.match(ui, /signMessageAsync/);
  assert.match(ui, /Create invitation/);
  assert.match(ui, /onCreated/);
  assert.match(ui, /ready in the sending field/);
  assert.doesNotMatch(ui, /Copy invitation code/);
});
