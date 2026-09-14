# HexOnion front page: recommended flow and copy

Review proposal, 14 September 2026. Application files have not been changed.

## Recommended message

Lead with the useful action. Keep technical terms, explaining each where the user first needs it. Preserve the olive LCD palette, Nokia fonts and terminal details as the visual identity.

The supplied project instructions define the current product as a browser hex encoder and decoder with deliberate sharing to X. They explicitly exclude a shipped Tor service. The source now also contains an encrypted dead-drop route, but its existence does not verify deployed Tor access or override that product boundary. The homepage should follow the approved scope until the capability and product description are reconciled.

## First screen

**Brand:** HexOnion

**Headline:** Turn text into hex. Find text in Bitcoin data.

**Description:** Convert a message into hexadecimal (hex), or inspect Bitcoin bytes for readable text. Conversion happens in your browser. Copy the result or preview an image to share on X.

**Visible example:**

```text
Text                    Hex
Hello                   48 65 6C 6C 6F
```

**Example caption:** Hex represents data using 0–9 and A–F. Each pair represents one byte. Anyone can decode it, so it does not keep a message secret.

**Primary action, disconnected:** Check wallet access

**Secondary action:** See a Bitcoin example

The primary action should lead to a visible, labeled gate and focus its heading. After access is granted, replace it with **Open hex tool** and focus the workspace. The secondary action should open a read-only Genesis example outside the gate. This demonstrates the product without changing the holding requirement.

**Access helper:** Access requires holding the configured token on Robinhood Chain. The balance check does not transfer funds.

Render the actual configured symbol and formatted threshold in that helper. Do not hardcode the development threshold into production copy. For a configuration that actually requires 0.01 USDG, the sentence can read: **Hold at least 0.01 USDG on Robinhood Chain to use the tool. Checking your balance does not transfer funds.**

## Suggested page order

1. Explain the tool, show the small example and distinguish encoding from encryption.
2. Offer **Text to hex (encode)** and **Hex to text (decode)** with one-sentence explanations and read-only examples.
3. Explain and perform the wallet holding check.
4. Open the selected workspace mode, with the input and useful output prominent.
5. Offer **Copy result** and **Preview sharing** after a valid conversion.
6. Explain advanced inspection options beside those controls.

On mobile, place the description, example and primary action before the session diagnostics. Collapse optional network details under **Access details**. Aim to make the tool's purpose and next action visible in the first screen at 390 × 844. Verify the final layout after increasing copy size; do not solve density by shrinking text further.

## Tool choices

| Heading | Description | Action after access |
|---|---|---|
| Text to hex (encode) | Turn a message into hexadecimal bytes. Supports emoji and international characters. | Encode text |
| Hex to text (decode) | Paste hexadecimal data to inspect its bytes and find readable passages. Some bytes are not text. | Decode hex |

Keep sharing optional. The current public/private choice makes a visitor choose a distribution method before understanding the core tool, and gives decoding no equivalent entry point.

## Gate copy

| State | Recommended wording |
|---|---|
| Disconnected | **Check wallet access.** Connect a wallet so HexOnion can check your token balance. |
| Wrong network | **Switch to Robinhood Chain.** This tool checks holdings on Robinhood Chain mainnet. |
| Checking | **Checking your balance…** |
| Insufficient balance | **More [token] is needed.** Required: [threshold]. Your balance: [balance]. |
| Read failed | **We couldn't check your balance.** Try again. |
| Invalid production setup | **The tool is temporarily unavailable.** Access checks are not configured. Please try again later. |
| Granted | **Ready to convert.** Your token holding has been verified. |

For invalid configuration, replace the gate's connection action with the unavailable state. A wallet connection cannot resolve missing deployment settings. Keep deployment details out of the normal visitor-facing message.

The current encoder gate reads a balance. Do not reuse its no-signature explanation for invitation creation: that separate flow actually requests a wallet signature.

## Plain language plus technical vocabulary

| Current label or term | Recommended label or explanation |
|---|---|
| Encoder / Decoder | Text to hex / Hex to text |
| Bitcoin hex | Hexadecimal data, including Bitcoin block bytes. Ordinary encoded text is not automatically written to Bitcoin. |
| YOUR TEXT | Your message |
| PASTE BITCOIN BYTES | Paste hex data |
| BYTE GRID | Byte inspector, each pair is one byte |
| UTF-8 | Text including emoji (UTF-8) |
| ASCII | Basic characters (ASCII) |
| Raw hex | Hex pairs, such as 48 65 6C 6C 6F |
| Offset dump | Hex with byte positions, positions label each row |
| Offsets are labels, not payload | Row addresses show byte positions. They are not part of your data. |
| 64 KiB maximum | Maximum 65,536 bytes (64 KiB) |
| Genesis block | Try Bitcoin's first block |
| Message only | Try the message from Bitcoin's first block |
| Readable text discovery | Readable passages found |
| Candidate | Possible text, binary data can sometimes look like letters |
| AWAITING COMMAND | Result updates as you type |
| Reset | Load Bitcoin example, if keeping the current behavior that switches to Decode |
| Share result | Preview sharing |
| TRANSMIT | Copy or share |

Use the explanation for the selected output view. The current output note always describes ASCII when decoding, including while UTF-8 or Hex dump is selected.

## Sharing copy

**Heading:** Preview your hex image

**Helper:** Review the image and post text before sharing. Posting on X is public. Hex can be decoded by anyone.

**Actions:** Download image · Copy post text · Download image and open X

**Composer helper:** Attach the downloaded image in X before posting.

If direct X posting is configured, show **Connect X** and explain the next step. Only show **Post to X** as the publishing action once connected. If direct posting is not configured, say **Direct posting is unavailable. Download the image and open X instead.** A user signing in cannot fix missing server configuration.

Keep Encode image and message payload free of the original plaintext. Preserve 1600 × 900 exports and byte fidelity.

## Onion and private-message wording

Within the supplied current product boundary, remove the active Onion-sharing promise from the main tool chooser. If a roadmap mention is useful, use: **Planned: private sharing through Tor.** It should not look like an available primary action.

If the private-message route is later confirmed as an approved, deployed feature, present it as a separate action rather than a way to transmit the hex result. Its source encrypts the message independently; it does not continue the encoder's data flow.

Before that flow is promoted, its introduction should explain the real sequence: create or enter an invitation code, write a message, encrypt and store it, then share the complete link. Explain that anyone with the complete link can open the message, and that an Onion link requires Tor Browser. Distinguish invitation expiry from the message's 24-hour expiry. Only advertise Onion access after the deployed service has been verified.

## Review acceptance checks

- A new visitor can state what HexOnion does and identify their next action from the first screen.
- Both encoding and decoding have understandable entry points.
- A disconnected visitor's primary action leads to a visible access step.
- A visitor can inspect a read-only example before connecting a wallet.
- The page explicitly says hex is reversible encoding and does not promise secrecy.
- Token requirements match the running production policy, and unavailable configuration does not encourage a futile connection attempt.
- Mobile text remains readable with the checked-in Nokia fonts; start with 14px explanatory copy and verify at actual size.
- Each technical term has a useful nearby explanation, without forcing experienced users through a tutorial.
- Conversion and sharing remain separate, with an explicit preview and deliberate publishing action.
- Current product claims match verified functionality; planned Tor access is clearly marked as planned.
