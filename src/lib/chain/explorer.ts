import { isAddress } from "viem";

/** Blockscout URL formats, verified live on explorer.testnet.chain.robinhood.com. */
export function explorerUrls(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    address: (a: string) => `${base}/address/${a}`,
    tx: (h: string) => `${base}/tx/${h}`,
    token: (a: string) => `${base}/token/${a}`,
    block: (n: number | bigint | string) => `${base}/block/${n}`,
  };
}

export function isEvmAddress(value: string): value is `0x${string}` {
  return isAddress(value, { strict: false });
}

export function isTxHash(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
