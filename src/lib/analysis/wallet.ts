import type { PublicClient } from "viem";
import type { Db } from "@/db/client";
import { fetchAddressCounters, fetchAddressTokenTransfers, fetchAddressTransactions, type ExplorerTokenTransfer, type ExplorerTx } from "@/lib/chain/explorer-api";
import { isContractAt } from "@/lib/contracts/is-contract";
import { pickFirstSeen, pickFunding, directCreations, reconcileTxCount, type Creation, type Funding, type TxRef } from "./creator";
import { cached } from "./cache";

export type Counterparty = { address: string; isContract: boolean | null; txIn: number; txOut: number; valueIn: string; valueOut: string; lastTime: string };
export type TokenActivity = { token: string; name: string | null; symbol: string | null; transfersIn: number; transfersOut: number };
export type LargeTransfer = TxRef & { direction: "in" | "out"; counterparty: string | null; value: string };

export type WalletProfile = {
  address: string;
  isContract: boolean | null;
  /** Native balance in wei at the time of analysis (latest block). */
  balanceWei: string | null;
  explorerAvailable: boolean;
  counters: { transactions: number | null; tokenTransfers: number | null };
  firstSeen: TxRef | null;
  lastActive: TxRef | null;
  funding: Funding | null;
  /** What the activity figures below are computed from. They describe a sample, not the full history. */
  sample: { transactions: number; from: string | null; to: string | null; complete: boolean; tokenTransfers: number; tokenTransfersComplete: boolean };
  flows: { txIn: number; txOut: number; valueIn: string; valueOut: string; failed: number };
  counterparties: Counterparty[];
  tokens: TokenActivity[];
  deployments: Creation[];
  largeTransfers: LargeTransfer[];
  timing: { byHourUtc: number[]; activeDays: number; medianGapSeconds: number | null; avgPerActiveDay: number | null };
  computedAt: string;
};

const iso = (ms: number) => new Date(ms).toISOString();
const ref = (t: ExplorerTx): TxRef => ({ txHash: t.hash, block: t.block, time: iso(t.time) });

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Derives the activity profile from a sample of transactions. Pure; all inputs come from the explorer. */
export function summarizeWallet(
  address: string,
  input: { newest: ExplorerTx[]; oldest: ExplorerTx[]; inbound: ExplorerTx[]; tokenTransfers: ExplorerTokenTransfer[]; sampleComplete: boolean; tokenTransfersComplete: boolean; counters: { transactions: number | null; tokenTransfers: number | null } },
): Omit<WalletProfile, "isContract" | "balanceWei" | "explorerAvailable" | "computedAt" | "counterparties"> & { counterparties: Omit<Counterparty, "isContract">[] } {
  const a = address.toLowerCase();
  const byHash = new Map<string, ExplorerTx>();
  for (const t of [...input.newest, ...input.oldest]) byHash.set(t.hash, t);
  const all = [...byHash.values()].sort((x, y) => y.time - x.time || y.block - x.block);

  const cp = new Map<string, { txIn: number; txOut: number; valueIn: bigint; valueOut: bigint; last: number }>();
  const touch = (peer: string | null, dir: "in" | "out", value: bigint, time: number) => {
    if (!peer || peer === a) return;
    const e = cp.get(peer) ?? { txIn: 0, txOut: 0, valueIn: 0n, valueOut: 0n, last: 0 };
    if (dir === "in") {
      e.txIn++;
      e.valueIn += value;
    } else {
      e.txOut++;
      e.valueOut += value;
    }
    e.last = Math.max(e.last, time);
    cp.set(peer, e);
  };

  let txIn = 0;
  let txOut = 0;
  let valueIn = 0n;
  let valueOut = 0n;
  let failed = 0;
  const byHour = new Array<number>(24).fill(0);
  const days = new Set<string>();
  for (const t of all) {
    if (!t.ok) failed++;
    const d = new Date(t.time);
    byHour[d.getUTCHours()]++;
    days.add(d.toISOString().slice(0, 10));
    if (t.from === a) {
      txOut++;
      if (t.ok) valueOut += t.value;
      touch(t.to ?? t.createdContract, "out", t.ok ? t.value : 0n, t.time);
    } else if (t.to === a) {
      txIn++;
      if (t.ok) valueIn += t.value;
      touch(t.from, "in", t.ok ? t.value : 0n, t.time);
    }
  }

  const times = all.map((t) => t.time).sort((x, y) => x - y);
  const gaps = times.slice(1).map((t, i) => Math.round((t - times[i]) / 1000));
  const first = pickFirstSeen(input.oldest);

  const tokens = new Map<string, TokenActivity>();
  for (const t of input.tokenTransfers) {
    const e = tokens.get(t.token) ?? { token: t.token, name: t.tokenName, symbol: t.tokenSymbol, transfersIn: 0, transfersOut: 0 };
    if (t.to === a) e.transfersIn++;
    if (t.from === a) e.transfersOut++;
    tokens.set(t.token, e);
  }

  const large: LargeTransfer[] = all
    .filter((t) => t.ok && t.value > 0n && (t.from === a || t.to === a))
    .sort((x, y) => (x.value === y.value ? y.time - x.time : x.value > y.value ? -1 : 1))
    .slice(0, 5)
    .map((t) => ({ ...ref(t), direction: t.from === a ? ("out" as const) : ("in" as const), counterparty: t.from === a ? (t.to ?? t.createdContract) : t.from, value: t.value.toString() }));

  return {
    address: a,
    counters: input.counters,
    firstSeen: first ? ref(first) : null,
    lastActive: all[0] ? ref(all[0]) : null,
    funding: pickFunding(a, input.inbound),
    sample: {
      transactions: all.length,
      from: times.length ? iso(times[0]) : null,
      to: times.length ? iso(times[times.length - 1]) : null,
      complete: input.sampleComplete,
      tokenTransfers: input.tokenTransfers.length,
      tokenTransfersComplete: input.tokenTransfersComplete,
    },
    flows: { txIn, txOut, valueIn: valueIn.toString(), valueOut: valueOut.toString(), failed },
    counterparties: [...cp.entries()]
      .map(([address, e]) => ({ address, txIn: e.txIn, txOut: e.txOut, valueIn: e.valueIn.toString(), valueOut: e.valueOut.toString(), lastTime: iso(e.last) }))
      .sort((x, y) => y.txIn + y.txOut - (x.txIn + x.txOut) || x.address.localeCompare(y.address))
      .slice(0, 15),
    tokens: [...tokens.values()].sort((x, y) => y.transfersIn + y.transfersOut - (x.transfersIn + x.transfersOut) || x.token.localeCompare(y.token)).slice(0, 10),
    deployments: directCreations(a, all),
    largeTransfers: large,
    timing: { byHourUtc: byHour, activeDays: days.size, medianGapSeconds: median(gaps), avgPerActiveDay: days.size ? Math.round((all.length / days.size) * 10) / 10 : null },
  };
}

export const WALLET_CACHE_SECONDS = 600;

/** Builds the wallet profile, using a short-lived DB cache. Returns the explorer-unavailable shape instead of throwing. */
export async function getWalletProfile(db: Db, client: Pick<PublicClient, "getCode" | "getBalance">, chainId: number, explorerUrl: string, address: string): Promise<WalletProfile> {
  const a = address.toLowerCase();
  return cached(db, chainId, "wallet", a, WALLET_CACHE_SECONDS, () => buildWalletProfile(client, explorerUrl, a));
}

export async function buildWalletProfile(client: Pick<PublicClient, "getCode" | "getBalance">, explorerUrl: string, address: string): Promise<WalletProfile> {
  const [counters, newestPage, oldestPage, inboundPage, tokenPage, isContract, balance] = await Promise.all([
    fetchAddressCounters(explorerUrl, address),
    fetchAddressTransactions(explorerUrl, address, { order: "desc", maxPages: 3 }),
    fetchAddressTransactions(explorerUrl, address, { order: "asc", maxPages: 1 }),
    fetchAddressTransactions(explorerUrl, address, { order: "asc", filter: "to", maxPages: 1 }),
    fetchAddressTokenTransfers(explorerUrl, address, 2),
    isContractAt(client, address).catch(() => null),
    client.getBalance({ address: address as `0x${string}` }).catch(() => null),
  ]);
  const computedAt = new Date().toISOString();
  if (!newestPage || !oldestPage) {
    return {
      address, isContract, balanceWei: balance === null ? null : balance.toString(), explorerAvailable: false,
      counters: { transactions: null, tokenTransfers: null }, firstSeen: null, lastActive: null, funding: null,
      sample: { transactions: 0, from: null, to: null, complete: false, tokenTransfers: 0, tokenTransfersComplete: false },
      flows: { txIn: 0, txOut: 0, valueIn: "0", valueOut: "0", failed: 0 }, counterparties: [], tokens: [], deployments: [], largeTransfers: [],
      timing: { byHourUtc: new Array<number>(24).fill(0), activeDays: 0, medianGapSeconds: null, avgPerActiveDay: null }, computedAt,
    };
  }
  const s = summarizeWallet(address, {
    newest: newestPage.items, oldest: oldestPage.items, inbound: inboundPage?.items ?? [], tokenTransfers: tokenPage?.items ?? [],
    sampleComplete: !newestPage.truncated, tokenTransfersComplete: tokenPage !== null && !tokenPage.truncated,
    counters: { transactions: null, tokenTransfers: counters?.tokenTransfers ?? null },
  });
  // Reconcile the explorer counter with what was listed (counters can lag).
  s.counters.transactions = reconcileTxCount(counters?.transactions ?? null, s.sample.transactions, !newestPage.truncated);
  // Contract-ness of the busiest counterparties (bounded lookups).
  const cps = await Promise.all(s.counterparties.slice(0, 10).map(async (c) => ({ ...c, isContract: await isContractAt(client, c.address).catch(() => null) })));
  const rest = s.counterparties.slice(10).map((c) => ({ ...c, isContract: null }));
  return { ...s, isContract, balanceWei: balance === null ? null : balance.toString(), explorerAvailable: true, counterparties: [...cps, ...rest], computedAt };
}

export type Observation = { id: string; text: string };

/**
 * Plain-language behavior patterns derived from the sampled activity. They describe what the sample shows;
 * none identifies an owner or implies wrongdoing.
 */
export function observePatterns(p: Pick<WalletProfile, "sample" | "flows" | "counterparties" | "timing" | "deployments" | "isContract">): Observation[] {
  const out: Observation[] = [];
  const n = p.sample.transactions;
  if (p.deployments.length > 0) out.push({ id: "deployer", text: `Deployed ${p.deployments.length} contract${p.deployments.length === 1 ? "" : "s"} directly in the sampled transactions.` });
  if (n >= 30 && p.timing.medianGapSeconds !== null && p.timing.medianGapSeconds <= 10) out.push({ id: "cadence", text: `Median gap between sampled transactions is ${p.timing.medianGapSeconds}s, a cadence typical of automated or scripted activity.` });
  const top = p.counterparties[0];
  if (n >= 10 && top && (top.txIn + top.txOut) / n >= 0.8) out.push({ id: "single-counterparty", text: `${Math.round(((top.txIn + top.txOut) / n) * 100)}% of sampled transactions involve a single address.` });
  if (n >= 10 && p.flows.failed / n >= 0.3) out.push({ id: "failures", text: `${Math.round((p.flows.failed / n) * 100)}% of sampled transactions failed.` });
  if (p.isContract) out.push({ id: "contract", text: "This address is a contract, not an externally owned wallet." });
  return out;
}
