import { fetchAddressCounters, fetchAddressTransactions, fetchMintedTokens, type ExplorerTx } from "@/lib/chain/explorer-api";
import { CREATOR_THRESHOLDS } from "@/lib/risk-engine/methodology";
import { mapLimit } from "./pool";

/** A creation path: the contract a creator calls and the method selector that launches a token. */
export type CreationPattern = { to: string; selector: string };

export type TxRef = { txHash: string; block: number; time: string };
export type Funding = TxRef & { from: string; value: string };
/**
 * `kind`: "token" = confirmed ERC-20 (minted in the launch transaction, or answers the ERC-20 probe);
 * "contract" = deployed but not an ERC-20; "unchecked" = not examined.
 */
export type Creation = TxRef & { token: string; via: "direct" | "launchpad"; kind: "token" | "contract" | "unchecked" };

export type CreatorAnalysis = {
  address: string;
  /** False when the explorer could not be reached: every explorer-derived field is then null, not "none". */
  explorerAvailable: boolean;
  txCount: number | null;
  /** Oldest transaction the explorer reports for the address, in either direction. */
  firstSeen: TxRef | null;
  lastActive: TxRef | null;
  /** First inbound transaction that carried native value. A fact about one transfer, not proof of who controls the sender. */
  funding: Funding | null;
  /** Other tokens/contracts this address created. Lower bounds: only a bounded window of history is read. */
  creations: Creation[];
  creationSearch: {
    /** "direct" = contract deployments by the address only; "launchpad" = also transactions matching a known creation path. */
    scope: "direct" | "direct+launchpad";
    patterns: CreationPattern[];
    candidates: number;
    resolved: number;
    unresolved: number;
    /** True when history beyond the window may hold more creations. */
    possiblyIncomplete: boolean;
  };
  /** Seconds between first seen and the subject token's creation; null without both timestamps. */
  ageAtCreationSeconds: number | null;
  /** Peak and current share of supply, from the transfer index (scan only). */
  sellDown: { peakBps: number; currentBps: number; peakBlock: number } | null;
};

const iso = (ms: number) => new Date(ms).toISOString();
const ref = (t: ExplorerTx): TxRef => ({ txHash: t.hash, block: t.block, time: iso(t.time) });

/** Oldest transaction in either direction. */
export function pickFirstSeen(oldest: ExplorerTx[]): ExplorerTx | null {
  return oldest.length ? oldest.reduce((a, b) => (b.time < a.time || (b.time === a.time && b.block < a.block) ? b : a)) : null;
}

/** First successful inbound transfer with value > 0, from someone else. `inbound` is ordered oldest first. */
export function pickFunding(address: string, inbound: ExplorerTx[]): Funding | null {
  const a = address.toLowerCase();
  const tx = inbound.find((t) => t.ok && t.to === a && t.from !== a && t.value > 0n);
  return tx ? { ...ref(tx), from: tx.from, value: tx.value.toString() } : null;
}

/** Contracts the address deployed directly (a CREATE transaction). */
export function directCreations(address: string, txs: ExplorerTx[]): Creation[] {
  const a = address.toLowerCase();
  return txs
    .filter((t) => t.ok && t.from === a && t.createdContract)
    .map((t) => ({ ...ref(t), token: t.createdContract as string, via: "direct" as const, kind: "unchecked" as const }));
}

/** Transactions that look like a launch through a known creation path, newest first, deduplicated. */
export function launchCandidates(address: string, txs: ExplorerTx[], patterns: CreationPattern[], excludeTx: string[]): ExplorerTx[] {
  const a = address.toLowerCase();
  const skip = new Set(excludeTx.map((h) => h.toLowerCase()));
  const seen = new Set<string>();
  return txs
    .filter((t) => t.ok && t.from === a && t.to && t.method && patterns.some((p) => p.to === t.to && p.selector === t.method))
    .filter((t) => !skip.has(t.hash) && !seen.has(t.hash) && seen.add(t.hash))
    .sort((x, y) => y.block - x.block);
}

export type CreatorInput = {
  address: string;
  /** The subject token's creation, when analysing within a scan. Excluded from "other creations". */
  subject: { token: string; txHash: string | null; time: Date | null } | null;
  patterns: CreationPattern[];
};

/**
 * Reads the creator's public history from the explorer and derives facts only.
 * Inferences and judgments are built elsewhere (profile, rules) and must cite these facts.
 */
/**
 * The explorer's counters can lag (observed: 0 for an address with 40 transactions). A count below what was
 * actually listed is discarded; if the list was complete its length is exact, otherwise the count is unknown.
 */
export function reconcileTxCount(reported: number | null, observed: number, listComplete: boolean): number | null {
  if (reported !== null && reported >= observed) return reported;
  return listComplete ? observed : null;
}

export function emptyCreatorAnalysis(address: string, patterns: CreationPattern[] = []): CreatorAnalysis {
  return {
    address: address.toLowerCase(),
    explorerAvailable: false,
    txCount: null,
    firstSeen: null,
    lastActive: null,
    funding: null,
    creations: [],
    creationSearch: { scope: patterns.length ? "direct+launchpad" : "direct", patterns, candidates: 0, resolved: 0, unresolved: 0, possiblyIncomplete: true },
    ageAtCreationSeconds: null,
    sellDown: null,
  };
}

export async function analyzeCreator(explorerUrl: string, input: CreatorInput, opts: { deadline?: number; isToken?: (address: string) => Promise<boolean> } = {}): Promise<CreatorAnalysis> {
  const address = input.address.toLowerCase();
  const empty = emptyCreatorAnalysis(address, input.patterns);

  const [counters, newest, oldest, inbound] = await Promise.all([
    fetchAddressCounters(explorerUrl, address),
    fetchAddressTransactions(explorerUrl, address, { order: "desc", maxPages: 2 }),
    fetchAddressTransactions(explorerUrl, address, { order: "asc", maxPages: 1 }),
    fetchAddressTransactions(explorerUrl, address, { order: "asc", filter: "to", maxPages: 1 }),
  ]);
  // Without the transaction lists nothing can be concluded.
  if (!newest || !oldest) return empty;

  const first = pickFirstSeen(oldest.items);
  const last = newest.items[0] ?? null;
  const funding = inbound ? pickFunding(address, inbound.items) : null;

  const window = [...newest.items, ...oldest.items];
  const subjectTx = input.subject?.txHash ?? null;
  const direct = directCreations(address, window).filter((c) => c.token !== input.subject?.token);

  const candidates = launchCandidates(address, window, input.patterns, subjectTx ? [subjectTx] : []);
  const toResolve = candidates.slice(0, CREATOR_THRESHOLDS.maxCreationLookups);
  const minted = await mapLimit(toResolve, 4, async (t) => ({ t, tokens: await fetchMintedTokens(explorerUrl, t.hash) }), opts.deadline);
  const launched: Creation[] = [];
  let resolved = 0;
  for (const m of minted) {
    if (!m || m.tokens === null) continue;
    resolved++;
    for (const token of m.tokens) if (token !== input.subject?.token) launched.push({ ...ref(m.t), token, via: "launchpad", kind: "token" });
  }
  // Candidates beyond the lookup cap, failed lookups and lookups skipped at the deadline are all unresolved.
  const unresolved = candidates.length - resolved;

  // Direct deployments are counted as tokens only once confirmed ERC-20; otherwise they stay "unchecked".
  const checkedDirect = opts.isToken
    ? await mapLimit(direct.slice(0, CREATOR_THRESHOLDS.maxCreationLookups), 4, async (c) => ({ ...c, kind: ((await opts.isToken!(c.token)) ? "token" : "contract") as Creation["kind"] }), opts.deadline)
    : [];
  const resolvedDirect = new Map(checkedDirect.filter((c): c is Creation => c !== null).map((c) => [c.token, c]));
  const creations = dedupeCreations([...direct.map((c) => resolvedDirect.get(c.token) ?? c), ...launched]);
  const observed = new Set(window.map((t) => t.hash)).size;
  // The window covers at most newest 100 + oldest 50 transactions; it is complete when the newest list ended on its own.
  const covered = !newest.truncated;
  const total = reconcileTxCount(counters?.transactions ?? null, observed, covered);
  const possiblyIncomplete = !covered && (total === null || total > observed) ? true : unresolved > 0;

  const creationMs = input.subject?.time?.getTime() ?? null;
  return {
    address,
    explorerAvailable: true,
    txCount: total,
    firstSeen: first ? ref(first) : null,
    lastActive: last ? ref(last) : null,
    funding,
    creations,
    creationSearch: { scope: input.patterns.length ? "direct+launchpad" : "direct", patterns: input.patterns, candidates: candidates.length, resolved, unresolved, possiblyIncomplete },
    ageAtCreationSeconds: first && creationMs !== null ? Math.max(0, Math.round((creationMs - first.time) / 1000)) : null,
    sellDown: null,
  };
}

function dedupeCreations(list: Creation[]): Creation[] {
  const seen = new Set<string>();
  return list.filter((c) => !seen.has(c.token) && seen.add(c.token)).sort((a, b) => b.block - a.block);
}

/**
 * Peak share and current share of the creator's balance, from an ordered transfer history.
 * Returns null when the creator never held a balance.
 */
export function creatorSellDown(
  transfers: Iterable<{ blockNumber: number; from: string; to: string; value: bigint }>,
  creator: string,
  totalSupply: bigint,
): { peakBps: number; currentBps: number; peakBlock: number } | null {
  if (totalSupply === 0n) return null;
  let balance = 0n;
  let peak = 0n;
  let peakBlock = 0;
  for (const t of transfers) {
    if (t.value === 0n) continue;
    if (t.to === creator) balance += t.value;
    if (t.from === creator) balance -= t.value;
    if (balance > peak) {
      peak = balance;
      peakBlock = t.blockNumber;
    }
  }
  if (peak === 0n) return null;
  const bps = (v: bigint) => Number((v * 10_000n) / totalSupply);
  return { peakBps: bps(peak), currentBps: bps(balance < 0n ? 0n : balance), peakBlock };
}

/** Confirmed token creations: the only kind that counts toward repeated-launch signals. */
export const tokenCreations = (c: Pick<CreatorAnalysis, "creations">) => c.creations.filter((x) => x.kind === "token");
