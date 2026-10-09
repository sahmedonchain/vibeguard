import { afterEach, describe, expect, it, vi } from "vitest";
import { mapLimit } from "@/lib/analysis/pool";
import { walletGraph } from "@/lib/analysis/graph";
import { buildWalletProfile, observePatterns, summarizeWallet } from "@/lib/analysis/wallet";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit, LIMITS } from "@/lib/api/rate-limit";
import { fetchAddressTransactions, fetchMintedTokens, type ExplorerTx } from "@/lib/chain/explorer-api";
import { computeHolderHistory } from "@/lib/indexing/holder-history";
import { analyzeHolders } from "@/lib/indexing/holders";
import { computeBalances } from "@/lib/indexing/transfers";
import { formatEth } from "@/lib/format";

const a = (n: number) => "0x" + n.toString(16).padStart(40, "0");
const Z = a(0);
const t = (blockNumber: number, from: string, to: string, value: bigint) => ({ blockNumber, from, to, value });

describe("analyzeHolders with known contracts", () => {
  const balances = new Map([[a(1), 600n], [a(2), 300n], [a(3), 100n]]);
  const isContract = vi.fn(async (x: string) => x === a(2));
  it("labels contracts identified by address equality, excludes them, and skips the RPC lookup", async () => {
    const r = await analyzeHolders({ balances, totalSupply: 1000n, indexedSupply: 1000n, creator: null, isContract, knownContracts: { [a(1)]: "This token's contract" } });
    const top = r.topHolders.find((h) => h.address === a(1))!;
    expect(top).toMatchObject({ class: "contract", label: "This token's contract" });
    expect(isContract).not.toHaveBeenCalledWith(a(1));
    expect(r.exclusions.contractBps).toBe(9000); // a(1) known + a(2) detected
    expect(r.eoaTop1Bps).toBe(1000);
    expect(r.topHolders.find((h) => h.address === a(3))!.label).toBeUndefined();
  });
});

describe("computeHolderHistory", () => {
  const rows = [t(10, Z, a(1), 1000n), t(20, a(1), a(2), 400n), t(30, a(1), a(3), 300n), t(80, a(2), a(4), 400n), t(95, a(3), a(5), 100n)];
  it("samples concentration at evenly spaced blocks up to the end block", () => {
    const h = computeHolderHistory(rows, { endBlock: 100, totalSupply: 1000n, excluded: new Set(), tracked: [a(1), a(2), a(4)], samples: 4 })!;
    expect(h.points.map((p) => p.block)).toEqual([33, 55, 78, 100]);
    expect(h.points[0]).toMatchObject({ holderCount: 3, top1Bps: 4000, top10Bps: 10000 });
    expect(h.points[3]).toMatchObject({ holderCount: 4, top1Bps: 4000 });
    expect(h.approximate).toBe(true);
  });
  it("excludes contract/burn addresses from wallet concentration at every point", () => {
    const h = computeHolderHistory(rows, { endBlock: 100, totalSupply: 1000n, excluded: new Set([a(1)]), tracked: [], samples: 4 })!;
    expect(h.points[0].top1Bps).toBe(400 * 10); // a(2) holds 400/1000 at block 33; a(1) is excluded
    expect(h.points[0].top10Bps).toBe(7000);
  });
  it("reports balance changes of tracked holders over the last quarter", () => {
    const h = computeHolderHistory(rows, { endBlock: 100, totalSupply: 1000n, excluded: new Set(), tracked: [a(2), a(4), a(5)], samples: 4 })!;
    expect(h.window).toMatchObject({ fromBlock: 78, toBlock: 100 });
    const by = Object.fromEntries(h.changes.map((c) => [c.address, c.deltaBps]));
    expect(by[a(2)]).toBe(-4000);
    expect(by[a(4)]).toBe(4000);
    expect(by[a(5)]).toBe(1000);
  });
  it("returns null for empty history or zero supply", () => {
    expect(computeHolderHistory([], { endBlock: 10, totalSupply: 1n, excluded: new Set(), tracked: [] })).toBeNull();
    expect(computeHolderHistory(rows, { endBlock: 10, totalSupply: 0n, excluded: new Set(), tracked: [] })).toBeNull();
  });
  it("final point agrees with computeBalances", () => {
    const h = computeHolderHistory(rows, { endBlock: 100, totalSupply: 1000n, excluded: new Set(), tracked: [] })!;
    const final = computeBalances(rows);
    expect(h.points.at(-1)!.holderCount).toBe(final.balances.size);
  });
});

const tx = (over: Partial<ExplorerTx> = {}): ExplorerTx => ({
  hash: "0x" + Math.random().toString(16).slice(2).padEnd(64, "0"), block: 100, time: Date.parse("2026-09-01T10:00:00Z"), from: a(1), to: a(2),
  fromIsContract: false, toIsContract: false, value: 10n ** 18n, method: null, ok: true, createdContract: null, ...over,
});

describe("summarizeWallet", () => {
  const ME = a(1);
  const newest = [
    tx({ hash: "0xn1", from: ME, to: a(2), value: 3n * 10n ** 18n, time: Date.parse("2026-09-03T10:00:00Z"), block: 30 }),
    tx({ hash: "0xn2", from: a(2), to: ME, value: 10n ** 18n, time: Date.parse("2026-09-02T22:00:00Z"), block: 20 }),
    tx({ hash: "0xn3", from: ME, to: null, createdContract: a(9), value: 0n, time: Date.parse("2026-09-02T09:00:00Z"), block: 15 }),
    tx({ hash: "0xn4", from: ME, to: a(3), value: 1n, ok: false, time: Date.parse("2026-09-02T08:00:00Z"), block: 14 }),
  ];
  const oldest = [tx({ hash: "0xo1", from: a(7), to: ME, value: 5n * 10n ** 18n, time: Date.parse("2026-09-01T00:00:00Z"), block: 1 }), newest[3]];
  const s = summarizeWallet(ME, { newest, oldest, inbound: [oldest[0]], tokenTransfers: [], sampleComplete: true, tokenTransfersComplete: true, counters: { transactions: 5, tokenTransfers: 0 } });

  it("merges samples without double counting and reports first and last activity", () => {
    expect(s.sample.transactions).toBe(5);
    expect(s.firstSeen?.txHash).toBe("0xo1");
    expect(s.lastActive?.txHash).toBe("0xn1");
    expect(s.funding).toMatchObject({ from: a(7), value: (5n * 10n ** 18n).toString() });
  });
  it("computes flows from successful transfers only and counts failures", () => {
    expect(s.flows).toMatchObject({ txIn: 2, txOut: 3, failed: 1 });
    expect(s.flows.valueOut).toBe((3n * 10n ** 18n).toString());
    expect(s.flows.valueIn).toBe((6n * 10n ** 18n).toString());
  });
  it("ranks counterparties and lists direct deployments", () => {
    expect(s.counterparties[0].address).toBe(a(2));
    expect(s.counterparties[0]).toMatchObject({ txIn: 1, txOut: 1 });
    expect(s.deployments.map((d) => d.token)).toEqual([a(9)]);
  });
  it("lists the largest transfers first and builds the hour histogram", () => {
    expect(s.largeTransfers[0].txHash).toBe("0xo1");
    expect(s.timing.byHourUtc.reduce((x, y) => x + y, 0)).toBe(5);
    expect(s.timing.byHourUtc[10]).toBe(1);
    expect(s.timing.activeDays).toBe(3);
  });
});

describe("observePatterns", () => {
  const base = { sample: { transactions: 40, from: null, to: null, complete: true, tokenTransfers: 0, tokenTransfersComplete: true }, flows: { txIn: 0, txOut: 0, valueIn: "0", valueOut: "0", failed: 0 }, counterparties: [], timing: { byHourUtc: [], activeDays: 1, medianGapSeconds: 60, avgPerActiveDay: 40 }, deployments: [], isContract: false };
  it("is empty for unremarkable activity", () => expect(observePatterns(base)).toEqual([]));
  it("describes automation-like cadence, single-counterparty focus, failures and deployments", () => {
    const ids = observePatterns({ ...base, timing: { ...base.timing, medianGapSeconds: 3 }, counterparties: [{ address: a(2), isContract: true, txIn: 0, txOut: 38, valueIn: "0", valueOut: "0", lastTime: "x" }], flows: { ...base.flows, failed: 20 }, deployments: [{ token: a(9), txHash: "0x1", block: 1, time: "x", via: "direct", kind: "unchecked" }] }).map((o) => o.id);
    expect(ids).toEqual(["deployer", "cadence", "single-counterparty", "failures"]);
  });
  it("does not make claims from tiny samples", () => {
    expect(observePatterns({ ...base, sample: { ...base.sample, transactions: 5 }, timing: { ...base.timing, medianGapSeconds: 1 } })).toEqual([]);
  });
});

describe("walletGraph", () => {
  it("builds a star with the funding edge marked", () => {
    const g = walletGraph({ address: a(1), funding: { from: a(7), txHash: "0xf", block: 1, time: "x", value: "1" }, counterparties: [{ address: a(2), isContract: true, txIn: 1, txOut: 2, valueIn: "0", valueOut: "0", lastTime: "x" }] } as never);
    expect(g.nodes.map((n) => [n.id, n.kind])).toEqual([[a(1), "subject"], [a(2), "contract"], [a(7), "funder"]]);
    expect(g.edges.map((e) => e.kind).sort()).toEqual(["funding", "received", "sent"]);
  });
});

describe("explorer adapter (mocked fetch)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const page = (n: number, next: Record<string, unknown> | null) => ({ items: Array.from({ length: n }, (_, i) => ({ hash: "0x" + i, block_number: i, timestamp: "2026-09-01T00:00:00Z", from: { hash: a(1) }, to: { hash: a(2) }, value: "1", method: "0xAB", status: "ok" })), next_page_params: next });
  it("follows page cursors up to maxPages and reports truncation", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { urls.push(u); return new Response(JSON.stringify(page(2, { block_number: 5, index: 1 })), { status: 200 }); }));
    const r = await fetchAddressTransactions("https://x", a(1), { order: "desc", maxPages: 2 });
    expect(r?.items).toHaveLength(4);
    expect(r?.truncated).toBe(true);
    expect(urls[1]).toContain("block_number=5");
    expect(r?.items[0].method).toBe("0xab");
  });
  it("returns null for a failed first page and for malformed data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    expect(await fetchAddressTransactions("https://x", a(1), { order: "asc" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ hash: "nope" }] }), { status: 200 })));
    expect(await fetchAddressTransactions("https://x", a(1), { order: "asc" })).toBeNull();
  });
  it("extracts only ERC-20 tokens minted from the zero address (not NFTs or ordinary transfers)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token_transfers: [{ type: "token_minting", from: { hash: Z }, token: { address_hash: a(5), type: "ERC-20" } }, { type: "token_transfer", from: { hash: a(3) }, token: { address_hash: a(6), type: "ERC-20" } }, { type: "token_minting", from: { hash: Z }, token: { address_hash: a(5), type: "ERC-20" } }, { type: "token_minting", from: { hash: Z }, token: { address_hash: a(7), type: "ERC-721" } }] }), { status: 200 })));
    expect(await fetchMintedTokens("https://x", "0x1")).toEqual([a(5)]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 404 })));
    expect(await fetchMintedTokens("https://x", "0x1")).toBeNull();
  });
  it("buildWalletProfile marks the explorer unavailable instead of returning an empty history", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 503 })));
    const p = await buildWalletProfile({ getCode: async () => "0x", getBalance: async () => 5n } as never, "https://x", a(1));
    expect(p.explorerAvailable).toBe(false);
    expect(p.balanceWei).toBe("5");
    expect(p.counterparties).toEqual([]);
  });
});

describe("rate limiter store failure", () => {
  const brokenDb = { insert: () => { throw new Error("connection refused"); } } as never;
  it("fails closed for scan creation and explorer-backed analysis", async () => {
    for (const limit of [LIMITS.createScan, LIMITS.analyze]) {
      await expect(enforceRateLimit(brokenDb, "k", limit)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
      await expect(enforceRateLimit(brokenDb, "k", limit)).rejects.toBeInstanceOf(ApiError);
    }
  });
  it("fails open for plain reads", async () => {
    const s = await enforceRateLimit(brokenDb, "k", LIMITS.read);
    expect(s.remaining).toBe(LIMITS.read.max);
  });
  it("only the intended limits are fail-closed", () => {
    expect(Object.entries(LIMITS).filter(([, l]) => "failClosed" in l && l.failClosed).map(([k]) => k).sort()).toEqual(["analyze", "createScan"]);
  });
});

describe("mapLimit", () => {
  it("bounds concurrency, keeps order, and turns a rejection into null", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (n === 3) throw new Error("x");
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(out).toEqual([2, 4, null, 8, 10, 12]);
  });
  it("starts no new work after the deadline", async () => {
    const out = await mapLimit([1, 2, 3], 1, async (n) => n, Date.now() - 1);
    expect(out).toEqual([]);
  });
});

describe("formatEth", () => {
  it("truncates exactly and handles null", () => {
    expect(formatEth((12n * 10n ** 18n + 345_678_000_000_000_000n).toString())).toBe("12.3456 ETH");
    expect(formatEth("0")).toBe("0 ETH");
    expect(formatEth(null)).toBe("Unknown");
  });
});
