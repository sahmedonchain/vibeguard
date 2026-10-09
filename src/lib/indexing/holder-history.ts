import { zeroAddress } from "viem";

export type HistoryPoint = { block: number; time: string | null; holderCount: number; top1Bps: number; top10Bps: number };
export type HolderChange = { address: string; fromBps: number; toBps: number; deltaBps: number };
export type HolderHistory = {
  points: HistoryPoint[];
  /** Largest balance changes among the final top holders over the last quarter of the observed period. */
  changes: HolderChange[];
  window: { fromBlock: number; toBlock: number; fromTime: string | null; toTime: string | null } | null;
  /** Exclusions use the classification at the analysis block, so earlier points are approximate. */
  approximate: true;
};

type Tr = { blockNumber: number; from: string; to: string; value: bigint };
const bps = (part: bigint, whole: bigint) => (whole === 0n ? 0 : Number((part * 10_000n) / whole));

/**
 * Replays an ordered transfer history and samples concentration at evenly spaced blocks.
 * `excluded` are addresses left out of the wallet-concentration figures (contracts, burn), as in the headline metrics.
 * `tracked` are the addresses whose balance change over the last quarter is reported.
 */
export function computeHolderHistory(
  transfers: Iterable<Tr>,
  opts: { endBlock: number; totalSupply: bigint; excluded: ReadonlySet<string>; tracked: string[]; samples?: number },
): HolderHistory | null {
  const balances = new Map<string, bigint>();
  const sampleCount = opts.samples ?? 8;
  const rows: Tr[] = [...transfers];
  if (rows.length === 0 || opts.totalSupply === 0n) return null;
  const first = rows[0].blockNumber;
  const span = Math.max(1, opts.endBlock - first);
  const sampleBlocks = Array.from({ length: sampleCount }, (_, k) => (k === sampleCount - 1 ? opts.endBlock : first + Math.round((span * (k + 1)) / sampleCount)));
  const windowIdx = Math.max(0, Math.round(sampleCount * 0.75) - 1);

  const points: HistoryPoint[] = [];
  let windowStart: { block: number; balances: Map<string, bigint> } | null = null;

  const snapshot = (block: number, k: number) => {
    const wallets = [...balances.entries()].filter(([a, b]) => b > 0n && !opts.excluded.has(a)).map(([, b]) => b).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    const top10 = wallets.slice(0, 10).reduce((a, b) => a + b, 0n);
    points.push({ block, time: null, holderCount: [...balances.values()].filter((b) => b > 0n).length, top1Bps: bps(wallets[0] ?? 0n, opts.totalSupply), top10Bps: bps(top10, opts.totalSupply) });
    if (k === windowIdx) windowStart = { block, balances: new Map(opts.tracked.map((a) => [a, balances.get(a) ?? 0n])) };
  };

  let k = 0;
  for (const t of rows) {
    while (k < sampleBlocks.length && t.blockNumber > sampleBlocks[k]) snapshot(sampleBlocks[k], k++);
    if (t.value === 0n) continue;
    if (t.from !== zeroAddress) balances.set(t.from, (balances.get(t.from) ?? 0n) - t.value);
    if (t.to !== zeroAddress) balances.set(t.to, (balances.get(t.to) ?? 0n) + t.value);
  }
  while (k < sampleBlocks.length) snapshot(sampleBlocks[k], k++);

  const ws = windowStart as { block: number; balances: Map<string, bigint> } | null;
  const changes: HolderChange[] = ws
    ? opts.tracked
        .map((address) => {
          const fromBal = ws.balances.get(address) ?? 0n;
          const toBal = balances.get(address) ?? 0n;
          return { address, fromBps: bps(fromBal, opts.totalSupply), toBps: bps(toBal, opts.totalSupply), deltaBps: bps(toBal, opts.totalSupply) - bps(fromBal, opts.totalSupply) };
        })
        .filter((c) => c.deltaBps !== 0)
        .sort((a, b) => Math.abs(b.deltaBps) - Math.abs(a.deltaBps) || a.address.localeCompare(b.address))
        .slice(0, 10)
    : [];

  return { points, changes, window: ws ? { fromBlock: ws.block, toBlock: opts.endBlock, fromTime: null, toTime: null } : null, approximate: true };
}
