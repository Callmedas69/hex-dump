# Homepage message coherence review

Date: 2026-09-14
Follow-up: the approved changes are complete. See [implementation verification](2026-09-14_homepage-two-tools-verification.md).

Scope: Focused source review of homepage messaging and the existing production screenshots at `docs/audits/assets/2026-09-14-fixes/unavailable-390.png` and `docs/audits/assets/2026-09-14-fixes/unavailable-1440.png`. This is not a new browser run, overall 40-point frontend audit, performance audit, or user study.

## Verdict

The homepage currently introduces HexOnion as a hex encoder and decoder, then switches to a long Dead drop explanation before returning to conversion choices. The two products need one shared introduction and two peer entry paths. Keep detailed invitation and privacy instructions on `/dead-drop`.

## Quick wins

1. Replace the codec-only hero with: **“Work with hex. Share private messages.”**
2. Follow it with: **“HexOnion has two browser tools: convert text and inspect Bitcoin bytes with the hex tool, or share an encrypted message through a link that expires after 24 hours.”**
3. Put two peer choices immediately after the hero: **Hex tool** and **Dead drop**. Keep encode and decode as actions inside the Hex tool choice.

## Findings

### P1. The hero defines HexOnion as a hex-only product

Evidence: The homepage identity says “Turn text into hex. Find text in Bitcoin data” at `components/TerminalHeader.tsx:99-100`. Its supporting copy describes only hexadecimal conversion and Bitcoin byte inspection at `components/TerminalHeader.tsx:101-110`. The Dead drop capability is introduced later at `app/page.tsx:144-156`.

-> do: Replace the hero headline and intro with the two-tool message above, then let the following choices explain the hex tool and Dead drop separately.

### P1. The section hierarchy alternates between unrelated product levels

Evidence: `app/page.tsx:144-156` renders a full Dead drop explanation first. `app/page.tsx:157-172` then renders a conversion-only “What would you like to convert?” section with separate encode and decode cards. `app/page.tsx:173` follows with the Bitcoin Genesis example. The header workflow still says “CHOOSE A TASK”, “CONVERT”, and “COPY OR SHARE” at `components/TerminalHeader.tsx:153-156`, which does not account for the Dead drop path.

-> do: Render a unified two-tool choice directly after the hero, move the Hello example, Genesis walkthrough, wallet details, and encode/decode actions into the Hex tool section, and keep the Dead drop choice brief with its route action.

### P2. Access wording does not identify which tool the wallet gate controls

Evidence: The header’s expandable access panel labels processing “LOCAL / IN BROWSER” and capability “ENCODE · DECODE” at `components/TerminalHeader.tsx:128-151`. The shared gate then presents “Access unavailable” or wallet access messaging at `components/SecurityGate.tsx:96-135`. With Dead drop now presented on the same homepage, neither block names the hex tool as its scope. The Dead drop copy does correctly say that a recipient opens the complete link without a wallet or invitation code at `app/page.tsx:149-153`.

-> do: Label the wallet panel and gate explicitly as **Hex tool access**, and add the peer Dead drop choice copy: sender needs an invitation code, recipient needs the complete link only.

### P2. Root metadata describes only the hex tool

Evidence: The root title is “HexOnion | Hex Encoder & Decoder” and the description mentions encoding, decoding, and readable Bitcoin messages only at `app/layout.tsx:20-22`. The recipient route already overrides its title and prevents indexing at `app/dead-drop/[id]/page.tsx:3`, so this finding concerns the root homepage metadata.

-> do: Update the root title and description to name both local hex inspection and expiring private message links, while retaining the recipient route’s no-index metadata.

## Proposed homepage flow

1. Hero: “Work with hex. Share private messages.” State both tools in plain language, with technical terms beside them: hexadecimal (hex), encryption, and the decryption key only where needed.
2. Tool choices: two equal cards before any wallet prompt.
   - **Hex tool:** Convert text to hexadecimal and inspect Bitcoin bytes locally. Hex does not hide a message. Entry actions: Encode text and Decode hex.
   - **Dead drop:** Create an encrypted message link that expires after 24 hours. Invitation code required to create; a recipient reads with the complete link and no wallet. Entry action: Open Dead drop.
3. Hex tool detail: Hello example, Genesis walkthrough, wallet access details, then the gated workspace.
4. Dead drop detail: Keep sender setup, invitation signing, key handling, expiry, and privacy explanations on `/dead-drop`.

## Acceptance criteria

- On desktop and mobile, the first viewport identifies both tools and offers both entry actions before the wallet prompt.
- The page presents Hex tool and Dead drop as peer products. Encode and decode are grouped inside Hex tool.
- Copy never implies that hex is encryption.
- Dead drop remains independently navigable, and its recipient path remains usable without a wallet.
- Configuration errors are labeled as Hex tool access errors.
- Homepage metadata matches the two-tool product, while the recipient route keeps its existing no-index metadata.
- Existing gate behavior, draft preservation, motion toggle, and reduced-motion behavior remain intact.
