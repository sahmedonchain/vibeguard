import { createHash } from "node:crypto";
import { SYBIL_THRESHOLDS as T } from "@/lib/risk-engine/methodology";

/**
 * Coordinated-wallet heuristics (SRS 12). Everything here describes behavioral similarity that
 * the chain data shows. It never asserts that wallets share an owner.
 */

export type SignalKind = "shared_funder" | "funding_time_correlation" | "funding_amount_similarity" | "coordinated_acquisition" | "token_consolidation";
/** Independent evidence families: signals from one family are not independent of each other. */
export type SignalFamily = "funding" | "acquisition" | "consolidation";

export const SIGNAL_FAMILY: Record<SignalKind, SignalFamily> = {
  shared_funder: "funding",
  funding_time_correlation: "funding",
  funding_amount_similarity: "funding",
  coordinated_acquisition: "acquisition",
  token_consolidation: "consolidation",
};

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  shared_funder: "Shared funding source",
  funding_time_correlation: "Funded within minutes of each other",
  funding_amount_similarity: "Similar funding amounts",
  coordinated_acquisition: "Acquired the token in the same minute",
  token_consolidation: "Sent tokens to a common wallet",
};

/** Alternative explanations shown with every signal. */
export const SIGNAL_ALTERNATIVES: Record<SignalKind, string> = {
  shared_funder: "The funder may be an exchange, faucet, bridge, or a person funding several unrelated friends or their own separate wallets for legitimate reasons.",
  funding_time_correlation: "Funding at the same time often follows a faucet drip, a campaign, or one user preparing wallets in a batch.",
  funding_amount_similarity: "Standard faucet or airdrop amounts look identical across unrelated recipients.",
  coordinated_acquisition: "Many unrelated buyers act in the same minute right after a launch or a social post.",
  token_consolidation: "A common recipient can be a shared exchange deposit address, a vesting service, or a public sink.",
};

export type MemberFunding = {
  from: string;
  txHash: string;
  block: number;
  /** Unix ms. */
  time: number;
  value: bigint;
  /** Whether the funder is a contract / a high-volume hub. Null when the check failed. */
  funderIsContract: boolean | null;
  funderTxCount: number | null;
};

export type SybilMember = {
  address: string;
  balanceBps: number;
  /** undefined = not resolved (explorer failure or budget); null = resolved, none observed. */
  funding: MemberFunding | null | undefined;
  firstReceipt: { txHash: string; block: number; time: number | null } | null;
};

export type Sink = { address: string; senders: string[]; isContract: boolean | null; txHash: string; block: number };

export type Evidence = { kind: SignalKind; txHash?: string; block?: number; time?: string; wallets: string[]; detail: string };
export type Signal = { kind: SignalKind; family: SignalFamily; label: string; detail: string; alternative: string };
export type Edge = { from: string; to: string; kind: SignalKind; txHash?: string; block?: number };
export type ClusterConfidence = "low" | "medium" | "high";

export type Cluster = {
  id: string;
  label: "Possible Coordination" | "High Behavioral Similarity";
  confidence: ClusterConfidence;
  members: { address: string; balanceBps: number }[];
  combinedBps: number;
  signals: Signal[];
  edges: Edge[];
  evidence: Evidence[];
  firstObserved: string | null;
  lastObserved: string | null;
  alternatives: string[];
  /** Cluster is large enough to feed the risk engine. */
  scored: boolean;
};

export type SybilAnalysis = {
  candidates: number;
  fundingResolved: number;
  explorerAvailable: boolean;
  /** True when work stopped early because the analysis time budget ran out. */
  budgetExceeded: boolean;
  clusters: Cluster[];
  thresholds: typeof T;
};

const iso = (ms: number) => new Date(ms).toISOString();

const isHub = (f: MemberFunding) => f.funderIsContract === true || (f.funderTxCount !== null && f.funderTxCount >= T.hubFunderTxCount);

/** Deterministic, order-independent cluster ID. */
export function clusterId(addresses: string[]): string {
  return "cl_" + createHash("sha256").update([...addresses].sort().join(",")).digest("hex").slice(0, 12);
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }
}

type Group = { kind: SignalKind; members: string[]; evidence: Evidence; edges: Edge[]; time?: number };

/** Members that share one funder. Hub/contract funders are common infrastructure and form no group on their own. */
function fundingGroups(members: SybilMember[]): { groups: Group[]; hubShared: number } {
  const byFunder = new Map<string, SybilMember[]>();
  for (const m of members) if (m.funding) byFunder.set(m.funding.from, [...(byFunder.get(m.funding.from) ?? []), m]);
  const groups: Group[] = [];
  let hubShared = 0;
  for (const [funder, ms] of [...byFunder.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (ms.length < 2) continue;
    if (isHub(ms[0].funding!)) {
      hubShared++;
      continue;
    }
    const wallets = ms.map((m) => m.address).sort();
    const earliest = ms.reduce((x, y) => (y.funding!.time < x.funding!.time || (y.funding!.time === x.funding!.time && y.address < x.address) ? y : x));
    groups.push({
      kind: "shared_funder",
      members: wallets,
      evidence: { kind: "shared_funder", wallets, txHash: earliest.funding!.txHash, block: earliest.funding!.block, time: iso(earliest.funding!.time), detail: `${wallets.length} wallets were first funded by ${funder}.` },
      edges: ms.map((m) => ({ from: funder, to: m.address, kind: "shared_funder" as const, txHash: m.funding!.txHash, block: m.funding!.block })),
    });
    // Timing and amount are evaluated within a shared-funder group only.
    const times = ms.map((m) => m.funding!.time);
    if (Math.max(...times) - Math.min(...times) <= T.fundingWindowSeconds * 1000) {
      groups.push({
        kind: "funding_time_correlation",
        members: wallets,
        evidence: { kind: "funding_time_correlation", wallets, time: iso(Math.min(...times)), detail: `All ${wallets.length} were funded within ${Math.round((Math.max(...times) - Math.min(...times)) / 1000)}s of each other.` },
        edges: [],
      });
    }
    const values = ms.map((m) => m.funding!.value);
    const min = values.reduce((a, b) => (b < a ? b : a));
    const max = values.reduce((a, b) => (b > a ? b : a));
    if (max > 0n && Number((min * 1000n) / max) / 1000 >= T.amountSimilarityMinRatio) {
      groups.push({
        kind: "funding_amount_similarity",
        members: wallets,
        evidence: { kind: "funding_amount_similarity", wallets, detail: `Funding amounts differ by at most ${(100 - Number((min * 100n) / max)).toFixed(0)}%.` },
        edges: [],
      });
    }
  }
  return { groups, hubShared };
}

/** Greedy, deterministic grouping of first receipts that fall in one window. Launch-wide bursts are ignored. */
function acquisitionGroups(members: SybilMember[]): Group[] {
  const timed = members.filter((m) => m.firstReceipt?.time != null).sort((a, b) => a.firstReceipt!.time! - b.firstReceipt!.time! || a.address.localeCompare(b.address));
  const groups: Group[] = [];
  let i = 0;
  while (i < timed.length) {
    const t0 = timed[i].firstReceipt!.time!;
    let j = i;
    while (j < timed.length && timed[j].firstReceipt!.time! - t0 <= T.acquisitionWindowSeconds * 1000) j++;
    const slice = timed.slice(i, j);
    if (slice.length >= T.acquisitionMinGroup && slice.length <= T.acquisitionMaxGroup) {
      const wallets = slice.map((m) => m.address).sort();
      groups.push({
        kind: "coordinated_acquisition",
        members: wallets,
        evidence: { kind: "coordinated_acquisition", wallets, txHash: slice[0].firstReceipt!.txHash, block: slice[0].firstReceipt!.block, time: iso(t0), detail: `${wallets.length} wallets first received the token within ${T.acquisitionWindowSeconds}s.` },
        edges: [],
      });
    }
    i = j;
  }
  return groups;
}

function consolidationGroups(sinks: Sink[]): Group[] {
  return sinks
    .filter((s) => s.isContract === false && s.senders.length >= 2)
    .sort((a, b) => a.address.localeCompare(b.address))
    .map((s) => {
      const wallets = [...s.senders].sort();
      return {
        kind: "token_consolidation" as const,
        members: wallets,
        evidence: { kind: "token_consolidation" as const, wallets, txHash: s.txHash, block: s.block, detail: `${wallets.length} wallets sent tokens to ${s.address}.` },
        edges: wallets.map((w) => ({ from: w, to: s.address, kind: "token_consolidation" as const, txHash: s.txHash, block: s.block })),
      };
    });
}

/** points: 2 per independent family, +1 each for timing and amount similarity within the funding family. */
export function confidenceOf(kinds: Set<SignalKind>): ClusterConfidence {
  const families = new Set([...kinds].map((k) => SIGNAL_FAMILY[k]));
  let points = families.size * 2;
  if (kinds.has("funding_time_correlation")) points++;
  if (kinds.has("funding_amount_similarity")) points++;
  return points >= 6 ? "high" : points >= 4 ? "medium" : "low";
}

/**
 * Builds clusters: members joined by any qualifying group form one connected component.
 * Confidence reflects how many independent families support it; labels never claim identity.
 */
export function detectClusters(members: SybilMember[], sinks: Sink[]): Cluster[] {
  const byAddr = new Map(members.map((m) => [m.address, m]));
  const { groups: funding } = fundingGroups(members);
  const groups = [...funding, ...acquisitionGroups(members), ...consolidationGroups(sinks)];
  const uf = new UnionFind();
  for (const g of groups) for (let k = 1; k < g.members.length; k++) uf.union(g.members[0], g.members[k]);

  const comps = new Map<string, string[]>();
  for (const g of groups) for (const a of g.members) comps.set(uf.find(a), [...new Set([...(comps.get(uf.find(a)) ?? []), a])]);

  const clusters: Cluster[] = [];
  for (const [root, addrs] of comps) {
    const wallets = [...addrs].sort();
    const mine = groups.filter((g) => uf.find(g.members[0]) === root);
    const kinds = new Set(mine.map((g) => g.kind));
    const confidence = confidenceOf(kinds);
    const combinedBps = wallets.reduce((a, w) => a + (byAddr.get(w)?.balanceBps ?? 0), 0);
    const times = mine.flatMap((g) => g.evidence.time ? [Date.parse(g.evidence.time)] : []).concat(
      wallets.flatMap((w) => {
        const m = byAddr.get(w);
        return [m?.funding?.time, m?.firstReceipt?.time].filter((t): t is number => typeof t === "number");
      }),
    );
    const kindOrder = Object.keys(SIGNAL_FAMILY) as SignalKind[];
    clusters.push({
      id: clusterId(wallets),
      label: confidence === "high" ? "High Behavioral Similarity" : "Possible Coordination",
      confidence,
      members: wallets.map((address) => ({ address, balanceBps: byAddr.get(address)?.balanceBps ?? 0 })).sort((a, b) => b.balanceBps - a.balanceBps),
      combinedBps,
      signals: kindOrder.filter((k) => kinds.has(k)).map((kind) => {
        const g = mine.find((x) => x.kind === kind)!;
        return { kind, family: SIGNAL_FAMILY[kind], label: SIGNAL_LABEL[kind], detail: g.evidence.detail, alternative: SIGNAL_ALTERNATIVES[kind] };
      }),
      // Sorted so the output does not depend on input order.
      edges: mine.flatMap((g) => g.edges).sort((x, y) => x.kind.localeCompare(y.kind) || x.from.localeCompare(y.from) || x.to.localeCompare(y.to)),
      evidence: mine.map((g) => g.evidence).sort((x, y) => x.kind.localeCompare(y.kind) || x.wallets.join().localeCompare(y.wallets.join())),
      firstObserved: times.length ? iso(Math.min(...times)) : null,
      lastObserved: times.length ? iso(Math.max(...times)) : null,
      alternatives: kindOrder.filter((k) => kinds.has(k)).map((k) => SIGNAL_ALTERNATIVES[k]),
      scored: combinedBps >= T.minClusterShareBps,
    });
  }
  return clusters.sort((a, b) => b.combinedBps - a.combinedBps || a.id.localeCompare(b.id));
}

/** Resolved-funding coverage as a fraction of candidates. */
export const fundingCoverage = (a: Pick<SybilAnalysis, "candidates" | "fundingResolved">) => (a.candidates === 0 ? 0 : a.fundingResolved / a.candidates);
