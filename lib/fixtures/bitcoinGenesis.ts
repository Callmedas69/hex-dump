/** Bitcoin mainnet's original 285-byte genesis block, serialized on the wire.
 * Values correspond to Bitcoin Core's chainparams.cpp genesis definition:
 * https://raw.githubusercontent.com/bitcoin/bitcoin/master/src/kernel/chainparams.cpp
 */
export const GENESIS_HEADER_HEX =
  "01000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a" +
  "29ab5f49ffff001d1dac2b7c";

export const GENESIS_MESSAGE = "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks";
export const GENESIS_MESSAGE_HEX = Array.from(new TextEncoder().encode(GENESIS_MESSAGE), (byte) =>
  byte.toString(16).padStart(2, "0"),
).join("");

export const GENESIS_TRANSACTION_HEX =
  "01000000" +
  "01" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "ffffffff" +
  "4d" +
  "04ffff001d010445" +
  GENESIS_MESSAGE_HEX +
  "ffffffff" +
  "01" +
  "00f2052a01000000" +
  "43" +
  "4104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5f" +
  "ac" +
  "00000000";

/** Full block serialization includes the one-transaction count between header and tx. */
export const GENESIS_BLOCK_HEX = GENESIS_HEADER_HEX + "01" + GENESIS_TRANSACTION_HEX;
