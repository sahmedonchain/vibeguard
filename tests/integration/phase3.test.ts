import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getDb, isDatabaseConfigured } from "@/db/client";
import { analysisCache, tokenTransfers } from "@/db/schema";
import { cached } from "@/lib/analysis/cache";
import { analyzeCreator } from "@/lib/analysis/creator";
import { runSybilAnalysis } from "@/lib/analysis/sybil-run";
import { buildWalletProfile, observePatterns } from "@/lib/analysis/wallet";
import { enforceRateLimit, LIMITS } from "@/lib/api/rate-limit";
import { createChainClient } from "@/lib/chain/client";
import { getChainConfig } from "@/lib/chain/config";
import { fetchAddressTransactions, fetchMintedTokens } from "@/lib/chain/explorer-api";
import { isErc20Like } from "@/lib/contracts/is-contract";

/** Live Robinhood Chain Testnet + Blockscout. VIBE COOK and its creation-transaction sender are immutable history. */
const TOKEN = "0xb2b489a0bb87bc2e8a1c11913c66ac0ac040e344";
const CREATOR = "0xab70588b24203e245bcee352d050975931b16e20";
const CREATION_TX = "0xf9fadebab7fda2263ed7922e88286703b47e56d631d5c63dd6d259b1308e8172";
const LAUNCHPAD = "0x2784448c519d01d3aE257C0aac0b7cDAd8AccEB1".toLowerCase();
const cfg = getChainConfig();
const client = createChainClient(cfg);

describe("explorer adapter (live)", () => {
  it("reads the creator's earliest transactions and the funding transfer", async () => {
    const oldest = await fetchAddressTransactions(cfg.explorerUrl, CREATOR, { order: "asc", maxPages: 1 });
    expect(oldest?.items.length).toBeGreaterThan(0);
    expect(oldest!.items[0].time).toBe(Date.parse("2026-08-14T16:41:17Z"));
    const inbound = await fetchAddressTransactions(cfg.explorerUrl, CREATOR, { order: "asc", filter: "to", maxPages: 1 });
    expect(inbound?.items[0].to).toBe(CREATOR);
  });
  it("attributes the token to the creation transaction by its ERC-20 mint", async () => {
    expect(await fetchMintedTokens(cfg.explorerUrl, CREATION_TX)).toContain(TOKEN);
  });
  it("tells an ERC-20 from a non-token contract", async () => {
    expect(await isErc20Like(client, TOKEN)).toBe(true);
    expect(await isErc20Like(client, LAUNCHPAD)).toBe(false);
  });
});

describe("creator analysis (live)", () => {
  it("builds facts for the VIBE COOK creator and excludes the subject token from other creations", async () => {
    const r = await analyzeCreator(cfg.explorerUrl, { address: CREATOR, subject: { token: TOKEN, txHash: CREATION_TX, time: new Date("2026-09-29T08:11:01Z") }, patterns: [{ to: LAUNCHPAD, selector: "0x0f5a5d1a" }] }, { isToken: (t) => isErc20Like(client, t) });
    expect(r.explorerAvailable).toBe(true);
    expect(r.firstSeen?.time).toBe("2026-08-14T16:41:17.000Z");
    expect(r.funding?.from).toBe("0xdaf94d6912dfe57a7200cbf2f0c871d3c9bc9b0f");
    expect(r.ageAtCreationSeconds).toBeGreaterThan(30 * 86_400);
    expect(r.creations.some((c) => c.token === TOKEN)).toBe(false);
    expect(r.txCount).toBeGreaterThanOrEqual(354);
  });
});

describe("wallet profile (live)", () => {
  it("summarizes a real wallet from explorer data and keeps limitations explicit", async () => {
    const p = await buildWalletProfile(client, cfg.explorerUrl, CREATOR);
    expect(p.explorerAvailable).toBe(true);
    expect(p.isContract).toBe(false);
    expect(p.sample.transactions).toBeGreaterThan(50);
    expect(p.sample.complete).toBe(false); // 354 transactions, sample capped
    expect(p.counterparties.length).toBeGreaterThan(0);
    expect(p.counterparties.every((c) => c.isContract !== undefined)).toBe(true);
    expect(p.timing.byHourUtc.reduce((a, b) => a + b, 0)).toBe(p.sample.transactions);
    expect(Array.isArray(observePatterns(p))).toBe(true);
  });
});

const db = isDatabaseConfigured() ? describe : describe.skip;

db("database-backed phase 3", () => {
  afterAll(async () => {
    await getDb().delete(analysisCache).where(eq(analysisCache.chainId, 987_654_322));
    await closeDb();
  });

  it("sybil queries run against Postgres with the indexed VIBE COOK transfers", async (t) => {
    const [{ n }] = await getDb().select({ n: sql<number>`count(*)::int` }).from(tokenTransfers).where(and(eq(tokenTransfers.chainId, cfg.chainId), eq(tokenTransfers.tokenAddress, TOKEN)));
    if (n === 0) t.skip();
    const rows = await getDb().execute<{ a: string; b: string }>(sql`SELECT to_address AS a, to_address AS b FROM token_transfers WHERE chain_id = ${cfg.chainId} AND token_address = ${TOKEN} GROUP BY to_address ORDER BY sum(value::numeric) DESC LIMIT 12`);
    const candidates = rows.rows.map((r, i) => ({ address: r.a, balanceBps: 100 - i }));
    const head = Number(await client.getBlockNumber()) - 2;
    const res = await runSybilAnalysis(getDb(), client, { chainId: cfg.chainId, explorerUrl: cfg.explorerUrl, token: TOKEN, analysisBlock: head, candidates, ignoredSinks: ["0x0000000000000000000000000000000000000000", TOKEN], deadline: Date.now() + 60_000 });
    expect(res.candidates).toBe(12);
    expect(res.fundingResolved).toBeGreaterThan(0);
    expect(Array.isArray(res.clusters)).toBe(true);
  });

  it("caches explorer-derived payloads, but never caches an outage", async () => {
    let calls = 0;
    const ok = () => cached(getDb(), 987_654_322, "wallet", "0x" + "ee".repeat(20), 60, async () => { calls++; return { explorerAvailable: true, v: calls }; });
    expect((await ok()).v).toBe(1);
    expect((await ok()).v).toBe(1);
    expect(calls).toBe(1);
    const down = () => cached(getDb(), 987_654_322, "wallet", "0x" + "dd".repeat(20), 60, async () => { calls++; return { explorerAvailable: false, v: calls }; });
    await down();
    await down();
    expect(calls).toBe(3);
  });

  it("enforces the analyze limit and reports the window", async () => {
    const key = "itest-" + Math.random().toString(16).slice(2);
    const limit = { ...LIMITS.analyze, max: 2 };
    expect((await enforceRateLimit(getDb(), key, limit)).remaining).toBe(1);
    await enforceRateLimit(getDb(), key, limit);
    await expect(enforceRateLimit(getDb(), key, limit)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
