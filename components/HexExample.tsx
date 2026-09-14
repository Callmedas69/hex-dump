import { decodeUtf8, formatDump, parseRawHex } from "../lib/hexCodec";
import { GENESIS_BLOCK_HEX, GENESIS_MESSAGE_HEX } from "../lib/fixtures/bitcoinGenesis";

const bytes = parseRawHex(GENESIS_BLOCK_HEX).bytes;
const messageStart = GENESIS_BLOCK_HEX.indexOf(GENESIS_MESSAGE_HEX) / 2;
const messageEnd = messageStart + GENESIS_MESSAGE_HEX.length / 2;

export function HexExample() {
  return (
    <details className="bitcoin-example" id="bitcoin-example">
      <summary>Explore Bitcoin&apos;s first block <span>Read-only example · no wallet needed</span></summary>
      <div className="example-content">
        <h2>A newspaper headline inside Bitcoin data</h2>
        <p>Bitcoin&apos;s first block, the Genesis block, contains this readable passage:</p>
        <blockquote>{decodeUtf8(bytes.slice(messageStart, messageEnd))}</blockquote>
        <p>The passage starts at byte {messageStart} (hex position {messageStart.toString(16).padStart(8, "0").toUpperCase()}).
          Some bytes describe binary data rather than text. This example preserves all {bytes.length} original bytes.</p>
        <pre tabIndex={0} aria-label="Bitcoin Genesis block bytes with row positions">{formatDump(bytes)}</pre>
        <p>Numbers on the left label the starting byte position of each row. They are not part of the data.
          Encoding your own message does not write it to Bitcoin.</p>
      </div>
    </details>
  );
}
