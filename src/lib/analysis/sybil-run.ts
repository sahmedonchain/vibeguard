import { sql } from "drizzle-orm";
import type { PublicClient } from "viem";
import type { Db } from "@/db/client";
import { fetchAddressCounters, fetchAddressTransactions } from "@/lib/chain/explorer-api";
import { isContractAt } from "@/lib/contracts/is-contract";
import { SYBIL_THRESHOLDS as T } from "@/lib/risk-engine/methodology";
import { withRetry } from "@/lib/retry";
import { pickFunding } from "./creator";
import { mapLimit } from "./pool";
import { detectClusters, type MemberFunding, type Sink, type SybilAnalysis, type SybilMember } from "./sybil";

export type SybilCandidate = { address: string; balanceBps: number };

export type SybilRunInput = {
  chainId: number;
  explorerUrl: string;
  token: string;
  analysisBlock: number;
  candidates: SybilCandidate[];
  /** Addresses never treated as a common recipient (burn addresses, the token itself). */
  ignoredSinks: string[];
  /** Epoch ms after which no new lookups start. */
  deadline: number;
};

/** Parameterized `(a, b, c)` list; drizzle expands a bare JS array into a row, which Postgres cannot cast to an array. Never call with an empty list. */
const inList = (values: string[]) => sql`(${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;

type Reader = Pick<PublicClient, "getCode" | "getBlock">;

/**
 * Gathers the funding, first-receipt and consolidation evidence for the largest wallet holders
 * and clusters them. Explorer and RPC failures leave data unresolved (never "none observed").
 */
export async function runSybilAnalysis(db: Db, client: Reader, input: SybilRunInput): Promise<SybilAnalysis> {
  const cands = input.candidates.slice(0, T.candidateLimit);
  const addrs = cands.map((c) => c.address);
  const base = { candidates: cands.length, thresholds: T };
  if (cands.length < 2) return { ...base, fundingResolved: 0, explorerAvailable: true, budgetExceeded: false, clusters: [] };

  // Funding: first inbound native transfer per candidate (explorer).
  // undefined = unresolved (explorer failure or deadline); null = resolved, no funding transfer observed.
  const fundingOf = new Map<string, ReturnType<typeof pickFunding> | undefined>();
  await mapLimit(cands, 5, async (c) => {
    const page = await fetchAddressTransactions(input.explorerUrl, c.address, { order: "asc", filter: "to", maxPages: 1 });
    if (page !== null) fundingOf.set(c.address, pickFunding(c.address, page.items));
  }, input.deadline);
  const resolved = cands.filter((c) => fundingOf.get(c.address) !== undefined).length;
  const explorerAvailable = resolved > 0;

  // Funder properties: contract? high-volume hub?
  const funders = [...new Set([...fundingOf.values()].flatMap((f) => (f ? [f.from] : [])))];
  const props = new Map<string, { isContract: boolean | null; txCount: number | null }>();
  await mapLimit(funders, 5, async (f) => {
    const [isContract, counters] = await Promise.all([isContractAt(client, f, input.analysisBlock).catch(() => null), fetchAddressCounters(input.explorerUrl, f)]);
    props.set(f, { isContract, txCount: counters?.transactions ?? null });
  }, input.deadline);

  // First token receipt per candidate and common recipients (index).
  const receipts = await db.execute<{ to_address: string; tx_hash: string; block_number: number }>(sql`
    SELECT DISTINCT ON (to_address) to_address, tx_hash, block_number
    FROM token_transfers
    WHERE chain_id = ${input.chainId} AND token_address = ${input.token} AND block_number <= ${input.analysisBlock}
      AND value > 0 AND to_address IN ${inList(addrs)}
    ORDER BY to_address, id`);
  const sinkRows = await db.execute<{ to_address: string; senders: string[]; tx_hash: string; block_number: number }>(sql`
    SELECT to_address, array_agg(DISTINCT from_address) AS senders,
           (array_agg(tx_hash ORDER BY id))[1] AS tx_hash, (array_agg(block_number ORDER BY id))[1] AS block_number
    FROM token_transfers
    WHERE chain_id = ${input.chainId} AND token_address = ${input.token} AND block_number <= ${input.analysisBlock}
      AND value > 0 AND from_address IN ${inList(addrs)}
      AND to_address NOT IN ${inList(addrs)} AND to_address NOT IN ${inList(input.ignoredSinks)}
    GROUP BY to_address HAVING count(DISTINCT from_address) >= 2
    ORDER BY count(DISTINCT from_address) DESC, to_address LIMIT 10`);

  const blocks = [...new Set(receipts.rows.map((r) => Number(r.block_number)))];
  const blockTimes = new Map<number, number>();
  await mapLimit(blocks, 5, async (n) => {
    const b = await withRetry(() => client.getBlock({ blockNumber: BigInt(n) }));
    blockTimes.set(n, Number(b.timestamp) * 1000);
  }, input.deadline);

  const sinks: Sink[] = [];
  const checked = await mapLimit(sinkRows.rows, 5, async (r) => ({ r, isContract: await isContractAt(client, r.to_address, input.analysisBlock).catch(() => null) }), input.deadline);
  for (const c of checked) {
    if (!c) continue;
    sinks.push({ address: c.r.to_address, senders: c.r.senders, isContract: c.isContract, txHash: c.r.tx_hash, block: Number(c.r.block_number) });
  }

  const receiptOf = new Map(receipts.rows.map((r) => [r.to_address, { txHash: r.tx_hash, block: Number(r.block_number), time: blockTimes.get(Number(r.block_number)) ?? null }]));
  const members: SybilMember[] = cands.map((c) => {
    const f = fundingOf.get(c.address);
    const funding: MemberFunding | null | undefined =
      f === undefined ? undefined : f === null ? null : { from: f.from, txHash: f.txHash, block: f.block, time: Date.parse(f.time), value: BigInt(f.value), funderIsContract: props.get(f.from)?.isContract ?? null, funderTxCount: props.get(f.from)?.txCount ?? null };
    return { address: c.address, balanceBps: c.balanceBps, funding, firstReceipt: receiptOf.get(c.address) ?? null };
  });

  return { ...base, fundingResolved: resolved, explorerAvailable, budgetExceeded: Date.now() > input.deadline, clusters: detectClusters(members, sinks) };
}
