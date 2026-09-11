import type { Address } from "viem";
export type TokenPolicy = { chainId:number; address:Address; symbol:string; decimals:number; minimumRawBalance:bigint };
export const usdgRobinhood:TokenPolicy={chainId:4663,address:"0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",symbol:"USDG",decimals:6,minimumRawBalance:BigInt(10000)};
export function developmentPolicy(profile?: string): TokenPolicy | null {
  if (!profile || profile === "robinhood-mainnet") return usdgRobinhood;
  return null;
}
export function hasTokenAccess(balance:bigint|undefined,minimum:bigint){return balance!==undefined&&balance>BigInt(0)&&balance>=minimum;}
export function productionPolicy(env:Partial<NodeJS.ProcessEnv>={}){const address=env.NEXT_PUBLIC_MEME_TOKEN_ADDRESS,chainId=Number(env.NEXT_PUBLIC_MEME_TOKEN_CHAIN_ID),decimals=Number(env.NEXT_PUBLIC_MEME_TOKEN_DECIMALS||18);let minimum:bigint;try{minimum=BigInt(env.NEXT_PUBLIC_MEME_TOKEN_MIN_RAW||"1")}catch{return null}if(!address||!/^[0-9a-f]{40}$/i.test(address.replace(/^0x/,""))||!Number.isSafeInteger(chainId)||chainId!==4663||!Number.isInteger(decimals)||decimals<0||decimals>255||minimum<BigInt(0))return null;return{chainId,address:(address.startsWith("0x")?address:`0x${address}`)as Address,symbol:env.NEXT_PUBLIC_MEME_TOKEN_SYMBOL||"MEME",decimals,minimumRawBalance:minimum};}
