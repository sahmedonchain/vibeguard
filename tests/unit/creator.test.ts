import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeCreator, creatorSellDown, reconcileTxCount, directCreations, emptyCreatorAnalysis, launchCandidates, pickFirstSeen, pickFunding } from "@/lib/analysis/creator";
import { interpretCreator, type KnownToken } from "@/lib/analysis/creator-profile";
import type { ExplorerTx } from "@/lib/chain/explorer-api";

const a = (n: number) => "0x" + n.toString(16).padStart(40, "0");
const ME = a(1);
const LAUNCHPAD = a(50);
const tx = (over: Partial<ExplorerTx> = {}): ExplorerTx => ({
  hash: "0x" + Math.random().toString(16).slice(2).padEnd(64, "0"), block: 100, time: Date.parse("2026-09-01T00:00:00Z"), from: ME, to: LAUNCHPAD,
  fromIsContract: false, toIsContract: true, value: 0n, method: "0xaabbccdd", ok: true, createdContract: null, ...over,
});

describe("creator facts", () => {
  it("picks the earliest transaction as first seen", () => {
    const first = pickFirstSeen([tx({ time: 3000, block: 3 }), tx({ time: 1000, block: 1, hash: "0x1" }), tx({ time: 2000, block: 2 })]);
    expect(first?.hash).toBe("0x1");
    expect(pickFirstSeen([])).toBeNull();
  });
  it("funding is the first successful inbound transfer with value from someone else", () => {
    const inbound = [
      tx({ from: ME, to: ME, value: 5n }),                       // self transfer
      tx({ from: a(7), to: ME, value: 0n }),                     // no value
      tx({ from: a(8), to: ME, value: 9n, ok: false }),          // failed
      tx({ from: a(9), to: ME, value: 12n, hash: "0xfund", block: 7 }),
      tx({ from: a(10), to: ME, value: 20n }),
    ];
    const f = pickFunding(ME, inbound);
    expect(f).toMatchObject({ from: a(9), txHash: "0xfund", value: "12", block: 7 });
    expect(pickFunding(ME, [])).toBeNull();
  });
  it("lists direct deployments made by the address only", () => {
    const txs = [tx({ to: null, createdContract: a(60), hash: "0xd1" }), tx({ from: a(2), to: null, createdContract: a(61) }), tx({ to: null, createdContract: a(62), ok: false })];
    expect(directCreations(ME, txs).map((c) => c.token)).toEqual([a(60)]);
  });
  it("finds launches by creation path, dedupes, skips the subject and orders newest first", () => {
    const p = [{ to: LAUNCHPAD, selector: "0xaabbccdd" }];
    const txs = [
      tx({ hash: "0x1", block: 10 }), tx({ hash: "0x2", block: 30 }), tx({ hash: "0x2", block: 30 }),
      tx({ hash: "0x3", block: 20, method: "0x11111111" }), tx({ hash: "0x4", block: 25, to: a(51) }), tx({ hash: "0x5", block: 40 }),
    ];
    expect(launchCandidates(ME, txs, p, ["0x5"]).map((t) => t.hash)).toEqual(["0x2", "0x1"]);
    expect(launchCandidates(ME, txs, [], [])).toEqual([]);
  });
});

describe("reconcileTxCount", () => {
  it("keeps a plausible counter, repairs a lagging one from a complete list, and gives up on a truncated list", () => {
    expect(reconcileTxCount(354, 150, false)).toBe(354);
    expect(reconcileTxCount(0, 40, true)).toBe(40);
    expect(reconcileTxCount(0, 150, false)).toBeNull();
    expect(reconcileTxCount(null, 12, true)).toBe(12);
    expect(reconcileTxCount(null, 12, false)).toBeNull();
  });
});

describe("creatorSellDown", () => {
  const t = (blockNumber: number, from: string, to: string, value: bigint) => ({ blockNumber, from, to, value });
  const Z = a(0);
  it("tracks the peak and the current balance in basis points of supply", () => {
    const r = creatorSellDown([t(1, Z, ME, 300n), t(2, ME, a(5), 100n), t(3, a(6), ME, 500n), t(4, ME, a(7), 700n)], ME, 1000n);
    expect(r).toEqual({ peakBps: 7000, currentBps: 0, peakBlock: 3 });
  });
  it("returns null when the creator never held anything or supply is zero", () => {
    expect(creatorSellDown([t(1, Z, a(5), 10n)], ME, 100n)).toBeNull();
    expect(creatorSellDown([], ME, 0n)).toBeNull();
  });
  it("ignores zero-value transfers", () => {
    expect(creatorSellDown([t(1, Z, ME, 0n)], ME, 100n)).toBeNull();
  });
});

describe("analyzeCreator (explorer mocked)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const item = (t: ExplorerTx) => ({ hash: t.hash, block_number: t.block, timestamp: new Date(t.time).toISOString(), from: { hash: t.from }, to: t.to ? { hash: t.to } : null, value: t.value.toString(), method: t.method, status: t.ok ? "ok" : "error", created_contract: t.createdContract ? { hash: t.createdContract } : null });
  const BASE = "https://explorer.test";

  it("returns explorerAvailable=false (not an empty history) when the explorer fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const r = await analyzeCreator(BASE, { address: ME, subject: null, patterns: [] });
    expect(r.explorerAvailable).toBe(false);
    expect(r.firstSeen).toBeNull();
    expect(r.creations).toEqual([]);
  });

  it("derives first seen, funding, age and launchpad creations from explorer data", async () => {
    const first = tx({ hash: "0x" + "a1".repeat(32), from: a(9), to: ME, value: 10n, method: null, time: Date.parse("2026-09-01T00:00:00Z"), block: 5 });
    const subject = tx({ hash: "0x" + "b2".repeat(32), time: Date.parse("2026-09-01T12:00:00Z"), block: 50 });
    const other = tx({ hash: "0x" + "c3".repeat(32), time: Date.parse("2026-09-02T00:00:00Z"), block: 60 });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = new URL(url);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (u.pathname.endsWith("/counters")) return json({ transactions_count: "3", token_transfers_count: "0" });
      if (u.pathname.includes("/transactions/")) return json({ token_transfers: [{ type: "token_minting", from: { hash: "0x" + "0".repeat(40) }, token: { address_hash: a(70), type: "ERC-20" } }] });
      if (u.pathname.endsWith("/transactions")) {
        if (u.searchParams.get("filter") === "to") return json({ items: [item(first)], next_page_params: null });
        return json({ items: u.searchParams.get("order") === "asc" ? [item(first), item(subject), item(other)] : [item(other), item(subject), item(first)], next_page_params: null });
      }
      return new Response("", { status: 404 });
    }));
    const r = await analyzeCreator(BASE, { address: ME, subject: { token: a(80), txHash: subject.hash, time: new Date(subject.time) }, patterns: [{ to: LAUNCHPAD, selector: "0xaabbccdd" }] });
    expect(r.explorerAvailable).toBe(true);
    expect(r.txCount).toBe(3);
    expect(r.firstSeen?.txHash).toBe(first.hash);
    expect(r.funding?.from).toBe(a(9));
    expect(r.ageAtCreationSeconds).toBe(12 * 3600);
    expect(r.creations.map((c) => c.token)).toEqual([a(70)]);
    expect(r.creations[0].via).toBe("launchpad");
    expect(r.creationSearch.possiblyIncomplete).toBe(false);
  });
});

describe("direct deployments are classified by an ERC-20 probe", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("marks probed deployments as token or contract and leaves the rest unchecked", async () => {
    const dep = (n: number) => ({ hash: "0x" + String(n).repeat(64), block_number: n, timestamp: "2026-09-01T00:00:00Z", from: { hash: ME }, to: null, value: "0", method: null, status: "ok", created_contract: { hash: a(100 + n) } });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = new URL(url);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
      if (u.pathname.endsWith("/counters")) return json({ transactions_count: "2" });
      return json({ items: [dep(1), dep(2)], next_page_params: null });
    }));
    const probed: string[] = [];
    const r = await analyzeCreator("https://x", { address: ME, subject: null, patterns: [] }, { isToken: async (t) => { probed.push(t); return t === a(101); } });
    expect(Object.fromEntries(r.creations.map((c) => [c.token, c.kind]))).toEqual({ [a(101)]: "token", [a(102)]: "contract" });
    const unchecked = await analyzeCreator("https://x", { address: ME, subject: null, patterns: [] });
    expect(unchecked.creations.every((c) => c.kind === "unchecked")).toBe(true);
  });
});

describe("interpretCreator", () => {
  const base = { ...emptyCreatorAnalysis(ME), explorerAvailable: true, txCount: 10 };
  const creations = (n: number) => Array.from({ length: n }, (_, i) => ({ token: a(100 + i), txHash: "0x" + i, block: i, time: "2026-09-01T00:00:00.000Z", via: "launchpad" as const, kind: "token" as const }));
  const known = (level: string): KnownToken => ({ address: a(200), name: "X", symbol: "X", creationBlock: 1, creationTxHash: null, scan: { id: "s", finishedAt: null, level, overall: 70, coverage: 0.85 } });

  it("separates facts from inferences and attaches alternatives to every inference", () => {
    const r = interpretCreator({ ...base, creations: creations(4), funding: { txHash: "0xf", block: 1, time: "2026-09-01T00:00:00.000Z", from: a(9), value: "5" } }, { address: a(9), isContract: false }, []);
    expect(r.inferences.map((i) => i.id)).toEqual(["serial-launcher", "funder-relationship"]);
    for (const i of r.inferences) {
      expect(i.alternatives.length).toBeGreaterThan(0);
      expect(i.basis.length).toBeGreaterThan(0);
    }
  });
  it("reports insufficient data when the explorer failed, and no signals only with data", () => {
    expect(interpretCreator(emptyCreatorAnalysis(ME), null, []).assessment.level).toBe("insufficient_data");
    expect(interpretCreator(base, null, []).assessment.level).toBe("no_signals_observed");
  });
  it("raises signals for serial creation and for prior high-risk scans", () => {
    expect(interpretCreator({ ...base, creations: creations(12) }, null, []).assessment.signals[0].severity).toBe("medium");
    const r = interpretCreator(base, null, [known("critical"), known("low")]);
    expect(r.assessment.level).toBe("signals_observed");
    expect(r.assessment.signals[0].label).toMatch(/1 of 2 scanned tokens/);
  });
  it("never calls a creator a scammer", () => {
    const r = interpretCreator({ ...base, creations: creations(30) }, null, [known("critical")]);
    expect(JSON.stringify(r)).not.toMatch(/scam|rug|fraud|criminal/i);
  });
});
