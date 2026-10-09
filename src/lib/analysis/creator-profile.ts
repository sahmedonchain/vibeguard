import { sql } from "drizzle-orm";
import type { PublicClient } from "viem";
import type { Db } from "@/db/client";
import { isContractAt, isErc20Like } from "@/lib/contracts/is-contract";
import { CREATOR_THRESHOLDS as T } from "@/lib/risk-engine/methodology";
import { cached } from "./cache";
import { analyzeCreator, tokenCreations, type CreationPattern, type CreatorAnalysis } from "./creator";

export type KnownToken = {
  address: string;
  name: string | null;
  symbol: string | null;
  creationBlock: number | null;
  creationTxHash: string | null;
  /** Latest finished VibeGuard scan of the token, if any. */
  scan: { id: string; finishedAt: string | null; level: string; overall: number | null; provisional: boolean } | null;
};

export type Inference = { id: string; statement: string; basis: string[]; alternatives: string[]; confidence: "low" | "medium" };
export type AssessmentSignal = { label: string; severity: "low" | "medium"; basis: string };
export type CreatorProfile = {
  address: string;
  isContract: boolean | null;
  explorerAvailable: boolean;
  /** Verified facts: transaction-backed observations. */
  facts: CreatorAnalysis;
  funder: { address: string; isContract: boolean | null } | null;
  /** Tokens this address created that VibeGuard has already recorded (a subset of its real history). */
  knownTokens: KnownToken[];
  /** Interpretations of the facts. Each lists its basis and alternative explanations. */
  inferences: Inference[];
  assessment: { level: "insufficient_data" | "no_signals_observed" | "signals_observed"; signals: AssessmentSignal[]; note: string };
  computedAt: string;
};

/** Creation paths (target contract + selector) seen in tokens this sender created, plus the subject's own. */
export async function creationPatterns(db: Db, chainId: number, sender: string, subject: { txTo: string | null; selector: string | null } | null): Promise<CreationPattern[]> {
  const rows = await db.execute<{ to: string; selector: string }>(sql`
    SELECT DISTINCT creation_to AS "to", creation_selector AS selector FROM tokens
    WHERE chain_id = ${chainId} AND creator_address = ${sender} AND creation_to IS NOT NULL AND creation_selector IS NOT NULL`);
  const list = rows.rows.map((r) => ({ to: r.to, selector: r.selector }));
  if (subject?.txTo && subject.selector) list.push({ to: subject.txTo, selector: subject.selector });
  const seen = new Set<string>();
  return list.filter((p) => !seen.has(p.to + p.selector) && seen.add(p.to + p.selector));
}

async function knownTokensOf(db: Db, chainId: number, creator: string): Promise<KnownToken[]> {
  const rows = await db.execute<{ address: string; name: string | null; symbol: string | null; creation_block: number | null; creation_tx_hash: string | null; scan_id: string | null; finished_at: Date | null; level: string | null; overall: string | null; provisional: boolean | null }>(sql`
    SELECT t.address, t.name, t.symbol, t.creation_block, t.creation_tx_hash, s.id AS scan_id, s.finished_at, r.level, r.overall, r.provisional
    FROM tokens t
    LEFT JOIN LATERAL (
      SELECT id, finished_at FROM scans
      WHERE chain_id = t.chain_id AND token_address = t.address AND status IN ('completed', 'partial')
      ORDER BY requested_at DESC LIMIT 1
    ) s ON true
    LEFT JOIN risk_scores r ON r.scan_id = s.id
    WHERE t.chain_id = ${chainId} AND t.creator_address = ${creator}
    ORDER BY t.creation_block DESC NULLS LAST LIMIT 50`);
  return rows.rows.map((r) => ({
    address: r.address,
    name: r.name,
    symbol: r.symbol,
    creationBlock: r.creation_block === null ? null : Number(r.creation_block),
    creationTxHash: r.creation_tx_hash,
    scan: r.scan_id && r.level ? { id: r.scan_id, finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null, level: r.level, overall: r.overall === null ? null : Number(r.overall), provisional: Boolean(r.provisional) } : null,
  }));
}

/** Pure: turns facts into inferences and a transparent signal list. Never labels a creator a scammer. */
export function interpretCreator(facts: CreatorAnalysis, funder: CreatorProfile["funder"], known: KnownToken[]): Pick<CreatorProfile, "inferences" | "assessment"> {
  const inferences: Inference[] = [];
  const found = tokenCreations(facts);
  const n = found.length + known.filter((k) => !found.some((c) => c.token === k.address)).length;
  if (facts.explorerAvailable && n >= T.repeatCreations.low) {
    inferences.push({
      id: "serial-launcher",
      statement: `This wallet appears to launch tokens repeatedly (at least ${n} observed).`,
      basis: [`${found.length} token creations found in the explorer history`, `${known.length} tokens recorded by VibeGuard with this wallet as creation sender`],
      alternatives: ["A builder or service launching on behalf of many projects.", "A user experimenting on a testnet where launches are free."],
      confidence: "medium",
    });
  }
  if (facts.funding && funder) {
    inferences.push({
      id: "funder-relationship",
      statement: `The wallet's first incoming funds came from ${facts.funding.from}, so that address may be related to the creator.`,
      basis: [`First inbound transfer with value: tx ${facts.funding.txHash}`],
      alternatives: funder.isContract ? ["The funder is a contract (faucet, bridge or router), common to many unrelated wallets."] : ["The funder may be an exchange or a friend; one transfer does not show shared ownership.", "The creator may have funded itself from another of its own wallets."],
      confidence: "low",
    });
  }

  const signals: AssessmentSignal[] = [];
  if (n >= T.repeatCreations.low) signals.push({ label: `At least ${n} tokens created by this wallet`, severity: n >= T.repeatCreations.medium ? "medium" : "low", basis: "Creation transactions (lower bound)" });
  const risky = known.filter((k) => k.scan && ["high", "critical"].includes(k.scan.level));
  if (risky.length > 0) signals.push({ label: `${risky.length} of ${known.filter((k) => k.scan).length} scanned tokens by this wallet scored High or Critical`, severity: "medium", basis: "VibeGuard scans of its tokens" });

  const insufficient = !facts.explorerAvailable || (facts.txCount === 0 && known.length === 0);
  return {
    inferences,
    assessment: {
      level: insufficient ? "insufficient_data" : signals.length ? "signals_observed" : "no_signals_observed",
      signals,
      note: "Signals come from the checks listed here and read a bounded part of the history. A failed or weak token does not make its creator a bad actor, and no signals is not an endorsement.",
    },
  };
}

export const CREATOR_CACHE_SECONDS = 600;

export async function getCreatorProfile(db: Db, client: Pick<PublicClient, "getCode" | "readContract">, chainId: number, explorerUrl: string, address: string): Promise<CreatorProfile> {
  const a = address.toLowerCase();
  return cached(db, chainId, "creator", a, CREATOR_CACHE_SECONDS, async () => {
    const [patterns, known, isContract] = await Promise.all([creationPatterns(db, chainId, a, null), knownTokensOf(db, chainId, a), isContractAt(client, a).catch(() => null)]);
    const facts = await analyzeCreator(explorerUrl, { address: a, subject: null, patterns }, { isToken: (t) => isErc20Like(client, t) });
    const funder = facts.funding ? { address: facts.funding.from, isContract: await isContractAt(client, facts.funding.from).catch(() => null) } : null;
    return { address: a, isContract, explorerAvailable: facts.explorerAvailable, facts, funder, knownTokens: known, ...interpretCreator(facts, funder, known), computedAt: new Date().toISOString() };
  });
}
