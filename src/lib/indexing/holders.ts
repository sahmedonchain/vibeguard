import { zeroAddress } from "viem";

export const BURN_ADDRESSES = new Set<string>([zeroAddress, "0x000000000000000000000000000000000000dead"]);

export type HolderClass = "burn" | "creator" | "contract" | "eoa";

export type ClassifiedHolder = {
  address: string;
  balance: string;
  /** Share of on-chain total supply in basis points (1 bp = 0.01%). */
  bps: number;
  class: HolderClass;
  /** Set only when the address is a contract the scan can name from facts (this token, the contract that created it). */
  label?: string;
};

export type HolderAnalysis = {
  /** Total supply used as denominator. */
  totalSupply: string;
  /** Supply as derived from indexed transfers (minted - burned to zero). */
  indexedSupply: string;
  holderCount: number;
  /** How many top raw holders were classified (bounded by RPC budget). */
  classifiedCount: number;
  topHolders: ClassifiedHolder[];
  /** Amount excluded from concentration metrics, always reported. */
  exclusions: { burn: string; contract: string; burnBps: number; contractBps: number };
  /** Concentration among non-burn, non-contract holders (creator included), share of total supply. */
  eoaTop1Bps: number;
  eoaTop5Bps: number;
  eoaTop10Bps: number;
  eoaTop20Bps: number;
  creatorBps: number | null;
  /** True when fewer than 20 non-excluded holders were found among the classified set (metrics are lower bounds). */
  lowerBound: boolean;
};

const bps = (part: bigint, whole: bigint): number => (whole === 0n ? 0 : Number((part * 10_000n) / whole));

export type HolderInput = {
  balances: Map<string, bigint>;
  totalSupply: bigint;
  indexedSupply: bigint;
  creator: string | null;
  /** Contracts identified from facts (address equality), keyed by lowercase address. Not guesses about pools or vaults. */
  knownContracts?: Record<string, string>;
  /** Looks up whether an address has code. Called only for top holders. */
  isContract: (address: string) => Promise<boolean>;
  classifyLimit?: number;
};

/**
 * Classifies the largest holders and derives concentration metrics.
 * Burn addresses and contracts are excluded from the EOA concentration figures but are
 * returned in `exclusions` and `topHolders`; nothing is removed silently.
 */
export async function analyzeHolders(input: HolderInput): Promise<HolderAnalysis> {
  const { balances, totalSupply, indexedSupply, creator } = input;
  const limit = input.classifyLimit ?? 50;
  const sorted = [...balances.entries()].filter(([, b]) => b > 0n).sort((a, b) => (a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : a[1] > b[1] ? -1 : 1));
  const top = sorted.slice(0, limit);

  const classes = new Map<string, HolderClass>();
  const known = input.knownContracts ?? {};
  const queue = top.filter(([a]) => !BURN_ADDRESSES.has(a) && a !== creator && !known[a]).map(([a]) => a);
  const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
    for (let a = queue.shift(); a !== undefined; a = queue.shift()) classes.set(a, (await input.isContract(a)) ? "contract" : "eoa");
  });
  await Promise.all(workers);

  const topHolders: ClassifiedHolder[] = top.map(([address, balance]) => ({
    address,
    balance: balance.toString(),
    bps: bps(balance, totalSupply),
    class: BURN_ADDRESSES.has(address) ? "burn" : address === creator ? "creator" : known[address] ? "contract" : (classes.get(address) ?? "eoa"),
    ...(known[address] && !BURN_ADDRESSES.has(address) && address !== creator ? { label: known[address] } : {}),
  }));

  let burn = balances.get("0x000000000000000000000000000000000000dead") ?? 0n;
  let contract = 0n;
  for (const [a, b] of sorted) {
    if (BURN_ADDRESSES.has(a)) continue;
    if (classes.get(a) === "contract" || (known[a] && a !== creator)) contract += b;
  }
  // Burned to the zero address is not a balance entry; it is reflected in supply, not holders.
  const counted = topHolders.filter((h) => h.class === "eoa" || h.class === "creator");
  const sum = (n: number) => counted.slice(0, n).reduce((acc, h) => acc + BigInt(h.balance), 0n);
  const creatorBal = creator ? (balances.get(creator) ?? 0n) : null;
  burn = burn < 0n ? 0n : burn;

  return {
    totalSupply: totalSupply.toString(),
    indexedSupply: indexedSupply.toString(),
    holderCount: sorted.length,
    classifiedCount: top.length,
    topHolders,
    exclusions: { burn: burn.toString(), contract: contract.toString(), burnBps: bps(burn, totalSupply), contractBps: bps(contract, totalSupply) },
    eoaTop1Bps: bps(sum(1), totalSupply),
    eoaTop5Bps: bps(sum(5), totalSupply),
    eoaTop10Bps: bps(sum(10), totalSupply),
    eoaTop20Bps: bps(sum(20), totalSupply),
    creatorBps: creatorBal == null ? null : bps(creatorBal, totalSupply),
    lowerBound: counted.length < 20 && sorted.length > top.length,
  };
}
