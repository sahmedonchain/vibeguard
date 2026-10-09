import { describe, expect, it } from "vitest";
import { emptyCreatorAnalysis, type CreatorAnalysis } from "@/lib/analysis/creator";
import type { Cluster, SybilAnalysis } from "@/lib/analysis/sybil";
import type { ContractAnalysis } from "@/lib/contracts/analyze";
import type { HolderAnalysis } from "@/lib/indexing/holders";
import { CREATOR_THRESHOLDS, SYBIL_THRESHOLDS } from "@/lib/risk-engine/methodology";
import { computeScore, evaluateRules } from "@/lib/risk-engine/score";
import type { RuleContext } from "@/lib/risk-engine/types";

const addr = (c: string) => "0x" + c.repeat(40);
const tx = (c: string) => "0x" + c.repeat(64);

const contract = (): ContractAnalysis => ({
  analysisBlock: 100, hasCode: true, codeSize: 1000, codeHash: tx("1"),
  erc20: { isErc20Like: true, name: "T", symbol: "T", decimals: 18, totalSupply: "1000", missing: [] },
  owner: { state: "none", address: null, isContract: null },
  proxy: { type: "none", implementation: null, admin: null, upgradeable: false },
  capabilities: [], source: { checked: true, verified: true, name: "T" }, bytecode: { analyzedAddress: addr("a"), analyzedFrom: "token" }, failures: [],
});
const holders = (): HolderAnalysis => ({
  totalSupply: "10000", indexedSupply: "10000", holderCount: 10, classifiedCount: 10, topHolders: [],
  exclusions: { burn: "0", contract: "0", burnBps: 0, contractBps: 0 },
  eoaTop1Bps: 500, eoaTop5Bps: 1000, eoaTop10Bps: 2000, eoaTop20Bps: 2500, creatorBps: 100, lowerBound: false,
});
const recon = { supplyMatches: true, indexedSupply: "10000", onChainSupply: "10000", checked: 5, mismatches: [] };

const creator = (over: Partial<CreatorAnalysis> = {}): CreatorAnalysis => ({
  ...emptyCreatorAnalysis(addr("c")),
  explorerAvailable: true,
  txCount: 20,
  firstSeen: { txHash: tx("5"), block: 10, time: "2026-09-01T00:00:00.000Z" },
  lastActive: { txHash: tx("6"), block: 90, time: "2026-09-30T00:00:00.000Z" },
  ageAtCreationSeconds: 30 * 86_400,
  creationSearch: { scope: "direct+launchpad", patterns: [{ to: addr("d"), selector: "0x12345678" }], candidates: 0, resolved: 0, unresolved: 0, possiblyIncomplete: false },
  ...over,
});
const created = (n: number): CreatorAnalysis["creations"] => Array.from({ length: n }, (_, i) => ({ token: addr(String(i)), txHash: tx(String(i)), block: 20 + i, time: "2026-09-10T00:00:00.000Z", via: "launchpad" as const, kind: "token" as const }));

const cluster = (over: Partial<Cluster> = {}): Cluster => ({
  id: "cl_abc", label: "Possible Coordination", confidence: "medium",
  members: [{ address: addr("1"), balanceBps: 800 }, { address: addr("2"), balanceBps: 700 }],
  combinedBps: 1500, scored: true,
  signals: [{ kind: "shared_funder", family: "funding", label: "Shared funding source", detail: "d", alternative: "a" }],
  edges: [], evidence: [{ kind: "shared_funder", wallets: [addr("1"), addr("2")], txHash: tx("7"), block: 15, detail: "2 wallets were first funded by 0x…" }],
  firstObserved: null, lastObserved: null, alternatives: [], ...over,
});
const sybil = (over: Partial<SybilAnalysis> = {}): SybilAnalysis => ({ candidates: 20, fundingResolved: 20, explorerAvailable: true, budgetExceeded: false, clusters: [], thresholds: SYBIL_THRESHOLDS, ...over });

const ctx = (over: Partial<RuleContext> = {}): RuleContext => ({
  token: { address: addr("a"), creationBlock: 1, creator: addr("c"), creationTxHash: tx("9") },
  analysisBlock: 100, contract: contract(), holders: holders(), creator: creator(), sybil: sybil(), reconciliation: recon, ...over,
});
const run = (c: RuleContext, id: string) => evaluateRules(c).find((e) => e.rule.id === id)!.result;

describe("VG-CRT-001 new creator wallet", () => {
  it("detects a wallet younger than the threshold", () => {
    const r = run(ctx({ creator: creator({ ageAtCreationSeconds: CREATOR_THRESHOLDS.freshWalletSeconds - 1 }) }), "VG-CRT-001");
    expect(r.status).toBe("detected");
    expect(r.severity).toBe("low");
    expect(r.evidence.some((e) => e.kind === "transaction")).toBe(true);
  });
  it("passes at exactly the threshold", () => {
    expect(run(ctx({ creator: creator({ ageAtCreationSeconds: CREATOR_THRESHOLDS.freshWalletSeconds }) }), "VG-CRT-001").status).toBe("not_detected");
  });
  it("is unknown without explorer data, without a creator, or without an age", () => {
    expect(run(ctx({ creator: creator({ explorerAvailable: false }) }), "VG-CRT-001").status).toBe("unknown");
    expect(run(ctx({ token: { address: addr("a"), creationBlock: 1, creator: null, creationTxHash: null } }), "VG-CRT-001").status).toBe("unknown");
    expect(run(ctx({ creator: creator({ ageAtCreationSeconds: null }) }), "VG-CRT-001").status).toBe("unknown");
    expect(run(ctx({ creator: null }), "VG-CRT-001").status).toBe("unknown");
  });
});

describe("VG-CRT-002 repeated token creation", () => {
  it.each([[3, "low"], [9, "low"], [10, "medium"], [40, "medium"]])("%i other creations -> %s", (n, sev) => {
    const r = run(ctx({ creator: creator({ creations: created(n) }) }), "VG-CRT-002");
    expect(r.status).toBe("detected");
    expect(r.severity).toBe(sev);
  });
  it("counts confirmed tokens only; plain contracts and unchecked deployments do not count", () => {
    const mixed = [...created(2), ...created(5).map((c, i) => ({ ...c, token: addr("f") + i, kind: (i % 2 ? "contract" : "unchecked") as "contract" | "unchecked", via: "direct" as const }))];
    expect(run(ctx({ creator: creator({ creations: mixed }) }), "VG-CRT-002").status).toBe("not_detected");
  });
  it("is not detected only when the history was read completely", () => {
    expect(run(ctx({ creator: creator({ creations: created(1) }) }), "VG-CRT-002").status).toBe("not_detected");
  });
  it("is unknown (not safe) when the history window may hide launches", () => {
    const partial = creator({ creations: created(1), creationSearch: { ...creator().creationSearch, possiblyIncomplete: true, unresolved: 2 } });
    expect(run(ctx({ creator: partial }), "VG-CRT-002").status).toBe("unknown");
  });
  it("is detected from a partial window when the count already passes the threshold", () => {
    const partial = creator({ creations: created(4), creationSearch: { ...creator().creationSearch, possiblyIncomplete: true } });
    expect(run(ctx({ creator: partial }), "VG-CRT-002").status).toBe("detected");
  });
});

describe("VG-CRT-003 creator sold down", () => {
  it("detects a large position reduced to under a tenth of its peak", () => {
    const r = run(ctx({ creator: creator({ sellDown: { peakBps: 3000, currentBps: 100, peakBlock: 30 } }) }), "VG-CRT-003");
    expect(r.status).toBe("detected");
    expect(r.severity).toBe("medium");
  });
  it("uses low severity for a modest peak", () => {
    expect(run(ctx({ creator: creator({ sellDown: { peakBps: 800, currentBps: 10, peakBlock: 30 } }) }), "VG-CRT-003").severity).toBe("low");
  });
  it("does not flag small peaks or retained positions", () => {
    expect(run(ctx({ creator: creator({ sellDown: { peakBps: 400, currentBps: 0, peakBlock: 30 } }) }), "VG-CRT-003").status).toBe("not_detected");
    expect(run(ctx({ creator: creator({ sellDown: { peakBps: 3000, currentBps: 1500, peakBlock: 30 } }) }), "VG-CRT-003").status).toBe("not_detected");
  });
  it("a creator that never held a balance is a known, clean result", () => {
    expect(run(ctx({ creator: creator({ sellDown: null }) }), "VG-CRT-003").status).toBe("not_detected");
  });
  it("is unknown when the index was incomplete (no holders)", () => {
    expect(run(ctx({ holders: null }), "VG-CRT-003").status).toBe("unknown");
  });
  it("works without the explorer because it only needs the transfer index", () => {
    expect(run(ctx({ creator: creator({ explorerAvailable: false, sellDown: { peakBps: 3000, currentBps: 0, peakBlock: 30 } }) }), "VG-CRT-003").status).toBe("detected");
  });
});

describe("VG-SUS-001 / VG-SUS-002 coordination", () => {
  const behavior = { kind: "coordinated_acquisition" as const, family: "acquisition" as const, label: "Acquired the token in the same minute", detail: "d", alternative: "a" };
  it("flags a funding cluster over the share threshold, never above high", () => {
    const r = run(ctx({ sybil: sybil({ clusters: [cluster({ combinedBps: 6000, confidence: "high" })] }) }), "VG-SUS-001");
    expect(r.status).toBe("detected");
    expect(r.severity).toBe("high");
    expect(r.confidence).toBe("high");
    expect(r.explanation).toMatch(/not a shared owner/);
  });
  it("medium confidence under the high-share threshold is medium severity; low confidence is low", () => {
    expect(run(ctx({ sybil: sybil({ clusters: [cluster()] }) }), "VG-SUS-001").severity).toBe("medium");
    expect(run(ctx({ sybil: sybil({ clusters: [cluster({ confidence: "low" })] }) }), "VG-SUS-001").severity).toBe("low");
  });
  it("does not score a cluster below the share threshold", () => {
    expect(run(ctx({ sybil: sybil({ clusters: [cluster({ scored: false, combinedBps: 300 })] }) }), "VG-SUS-001").status).toBe("not_detected");
  });
  it("funding rule is unknown when funding was readable for under half of the wallets", () => {
    expect(run(ctx({ sybil: sybil({ fundingResolved: 5 }) }), "VG-SUS-001").status).toBe("unknown");
    expect(run(ctx({ sybil: sybil({ fundingResolved: 10 }) }), "VG-SUS-001").status).toBe("not_detected");
  });
  it("behavior rule needs no explorer and routes by signal family", () => {
    const c = cluster({ signals: [behavior] });
    expect(run(ctx({ sybil: sybil({ fundingResolved: 0, explorerAvailable: false, clusters: [c] }) }), "VG-SUS-002").status).toBe("detected");
    expect(run(ctx({ sybil: sybil({ clusters: [c] }) }), "VG-SUS-001").status).toBe("not_detected");
    expect(run(ctx({ sybil: sybil({ fundingResolved: 0, clusters: [] }) }), "VG-SUS-002").status).toBe("not_detected");
  });
  it("both rules are unknown without holders or sybil data", () => {
    for (const id of ["VG-SUS-001", "VG-SUS-002"]) {
      expect(run(ctx({ sybil: null }), id).status).toBe("unknown");
      expect(run(ctx({ holders: null }), id).status).toBe("unknown");
    }
  });
  it("one cluster seen by both rules is counted once", () => {
    const c = cluster({ signals: [cluster().signals[0], behavior] });
    const both = computeScore(evaluateRules(ctx({ sybil: sybil({ clusters: [c] }) })));
    const funding = computeScore(evaluateRules(ctx({ sybil: sybil({ clusters: [cluster()] }) })));
    const pts = (s: ReturnType<typeof computeScore>) => s.categories.find((x) => x.category === "suspicious")!.score!;
    expect(pts(both)).toBe(pts(funding));
  });
});

describe("coverage with phase 3 rules", () => {
  it("rises to 85% and is still provisional because coverage is below 100%", () => {
    const s = computeScore(evaluateRules(ctx({ creator: creator({ sellDown: null }) })));
    expect(s.coverage).toBe(0.85);
    expect(s.provisional).toBe(true);
    expect(s.categories.find((c) => c.category === "creator")!.coverage).toBe(1);
    expect(s.categories.find((c) => c.category === "suspicious")!.coverage).toBe(1);
  });
  it("falls back to provisional when the explorer fails (creator and funding unknown)", () => {
    const s = computeScore(evaluateRules(ctx({ creator: creator({ explorerAvailable: false }), sybil: sybil({ fundingResolved: 0, explorerAvailable: false }) })));
    expect(s.provisional).toBe(true);
    expect(s.coverage).toBeLessThan(0.85);
    expect(s.categories.find((c) => c.category === "creator")!.unknown).toEqual(["VG-CRT-001", "VG-CRT-002"]);
  });
  it("detected creator and coordination findings raise the score", () => {
    const clean = computeScore(evaluateRules(ctx({ creator: creator({ sellDown: null }) })));
    const risky = computeScore(evaluateRules(ctx({ creator: creator({ creations: created(12), sellDown: null }), sybil: sybil({ clusters: [cluster({ combinedBps: 4000, confidence: "high" })] }) })));
    expect(risky.overall!).toBeGreaterThan(clean.overall!);
  });
});
