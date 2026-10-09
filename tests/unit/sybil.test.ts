import { describe, expect, it } from "vitest";
import { clusterId, confidenceOf, detectClusters, type MemberFunding, type Sink, type SybilMember } from "@/lib/analysis/sybil";

const a = (n: number) => "0x" + n.toString(16).padStart(40, "0");
const T0 = Date.parse("2026-09-01T00:00:00Z");
const funding = (from: string, offsetSec: number, value = 1_000_000_000_000_000_000n, over: Partial<MemberFunding> = {}): MemberFunding => ({
  from, txHash: "0x" + offsetSec.toString(16).padStart(64, "0"), block: 100 + offsetSec, time: T0 + offsetSec * 1000, value, funderIsContract: false, funderTxCount: 12, ...over,
});
const member = (n: number, over: Partial<SybilMember> = {}): SybilMember => ({ address: a(n), balanceBps: 500, funding: null, firstReceipt: null, ...over });
const receipt = (offsetSec: number | null) => ({ txHash: "0x" + "ab".repeat(32), block: 1000, time: offsetSec === null ? null : T0 + 86_400_000 + offsetSec * 1000 });
const FUNDER = a(900);

describe("shared funder", () => {
  it("clusters wallets first funded by the same EOA, with timing and amount signals", () => {
    const ms = [member(1, { funding: funding(FUNDER, 0) }), member(2, { funding: funding(FUNDER, 60) }), member(3, { funding: funding(a(901), 0) })];
    const [c] = detectClusters(ms, []);
    expect(c.members.map((m) => m.address)).toEqual([a(1), a(2)]);
    expect(c.signals.map((s) => s.kind)).toEqual(["shared_funder", "funding_time_correlation", "funding_amount_similarity"]);
    expect(c.combinedBps).toBe(1000);
    expect(c.confidence).toBe("medium");
    expect(c.label).toBe("Possible Coordination");
    expect(c.evidence.some((e) => e.txHash)).toBe(true);
    expect(c.edges.every((e) => e.from === FUNDER)).toBe(true);
  });
  it("does not report timing when funding is far apart or amounts differ", () => {
    const ms = [member(1, { funding: funding(FUNDER, 0, 1_000n) }), member(2, { funding: funding(FUNDER, 7200, 100n) })];
    const [c] = detectClusters(ms, []);
    expect(c.signals.map((s) => s.kind)).toEqual(["shared_funder"]);
    expect(c.confidence).toBe("low");
  });
  it("ignores contract and high-volume hub funders (faucets, exchanges, bridges)", () => {
    const viaContract = [member(1, { funding: funding(FUNDER, 0, 1n, { funderIsContract: true }) }), member(2, { funding: funding(FUNDER, 1, 1n, { funderIsContract: true }) })];
    expect(detectClusters(viaContract, [])).toEqual([]);
    const viaHub = [member(1, { funding: funding(FUNDER, 0, 1n, { funderTxCount: 50_000 }) }), member(2, { funding: funding(FUNDER, 1, 1n, { funderTxCount: 50_000 }) })];
    expect(detectClusters(viaHub, [])).toEqual([]);
  });
  it("treats unresolved funding as no evidence, not as a shared funder", () => {
    expect(detectClusters([member(1, { funding: undefined }), member(2, { funding: undefined })], [])).toEqual([]);
  });
  it("a single wallet never forms a cluster", () => {
    expect(detectClusters([member(1, { funding: funding(FUNDER, 0) })], [])).toEqual([]);
  });
});

describe("coordinated acquisition", () => {
  it("groups 3 to 10 first receipts inside the window", () => {
    const ms = [1, 2, 3].map((n) => member(n, { firstReceipt: receipt(n * 10) }));
    const [c] = detectClusters(ms, []);
    expect(c.signals.map((s) => s.kind)).toEqual(["coordinated_acquisition"]);
    expect(c.confidence).toBe("low");
  });
  it("needs at least 3 wallets", () => {
    expect(detectClusters([1, 2].map((n) => member(n, { firstReceipt: receipt(n) })), [])).toEqual([]);
  });
  it("ignores launch-wide bursts of more than 10 wallets", () => {
    expect(detectClusters(Array.from({ length: 11 }, (_, i) => member(i + 1, { firstReceipt: receipt(i) })), [])).toEqual([]);
  });
  it("ignores wallets whose receipt time could not be read", () => {
    expect(detectClusters([1, 2, 3].map((n) => member(n, { firstReceipt: receipt(null) })), [])).toEqual([]);
  });
  it("does not group receipts spread over more than the window", () => {
    expect(detectClusters([0, 100, 200].map((s, i) => member(i + 1, { firstReceipt: receipt(s) })), [])).toEqual([]);
  });
});

describe("token consolidation", () => {
  const sink = (over: Partial<Sink> = {}): Sink => ({ address: a(800), senders: [a(1), a(2)], isContract: false, txHash: "0x" + "cd".repeat(32), block: 2000, ...over });
  it("clusters wallets that sent tokens to the same wallet", () => {
    const [c] = detectClusters([member(1), member(2), member(3)], [sink()]);
    expect(c.members.map((m) => m.address)).toEqual([a(1), a(2)]);
    expect(c.signals.map((s) => s.kind)).toEqual(["token_consolidation"]);
    expect(c.edges.map((e) => e.to)).toEqual([a(800), a(800)]);
  });
  it("ignores contract recipients and recipients whose type is unknown", () => {
    expect(detectClusters([member(1), member(2)], [sink({ isContract: true })])).toEqual([]);
    expect(detectClusters([member(1), member(2)], [sink({ isContract: null })])).toEqual([]);
  });
});

describe("confidence and clustering", () => {
  it("scores independent families higher than correlated signals within one family", () => {
    expect(confidenceOf(new Set(["shared_funder"]))).toBe("low");
    expect(confidenceOf(new Set(["shared_funder", "funding_time_correlation", "funding_amount_similarity"]))).toBe("medium");
    expect(confidenceOf(new Set(["shared_funder", "coordinated_acquisition"]))).toBe("medium");
    expect(confidenceOf(new Set(["shared_funder", "coordinated_acquisition", "token_consolidation"]))).toBe("high");
  });
  it("merges overlapping groups into one cluster and labels strong ones High Behavioral Similarity", () => {
    const ms = [
      member(1, { funding: funding(FUNDER, 0), firstReceipt: receipt(0) }),
      member(2, { funding: funding(FUNDER, 30), firstReceipt: receipt(10) }),
      member(3, { funding: funding(FUNDER, 45), firstReceipt: receipt(20) }),
    ];
    const sinks: Sink[] = [{ address: a(800), senders: [a(2), a(3)], isContract: false, txHash: "0x" + "cd".repeat(32), block: 2000 }];
    const cs = detectClusters(ms, sinks);
    expect(cs).toHaveLength(1);
    expect(cs[0].confidence).toBe("high");
    expect(cs[0].label).toBe("High Behavioral Similarity");
    expect(cs[0].members).toHaveLength(3);
    expect(cs[0].alternatives.length).toBe(cs[0].signals.length);
  });
  it("is deterministic and independent of input order", () => {
    const ms = [member(1, { funding: funding(FUNDER, 0) }), member(2, { funding: funding(FUNDER, 5) }), member(3, { funding: funding(FUNDER, 9) })];
    expect(detectClusters([...ms].reverse(), [])).toEqual(detectClusters(ms, []));
    expect(clusterId([a(2), a(1)])).toBe(clusterId([a(1), a(2)]));
    expect(clusterId([a(1), a(2)])).toMatch(/^cl_[0-9a-f]{12}$/);
  });
  it("never uses identity language", () => {
    const [c] = detectClusters([member(1, { funding: funding(FUNDER, 0) }), member(2, { funding: funding(FUNDER, 5) })], []);
    expect(JSON.stringify(c)).not.toMatch(/same (person|owner|entity)|belong to|sybil attacker|scammer/i);
    expect(["Possible Coordination", "High Behavioral Similarity"]).toContain(c.label);
  });
});
