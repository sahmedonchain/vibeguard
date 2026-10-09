import { describe, expect, it } from "vitest";
import type { ContractAnalysis } from "@/lib/contracts/analyze";
import type { HolderAnalysis } from "@/lib/indexing/holders";
import { CATEGORY_WEIGHTS, METHODOLOGY_VERSION } from "@/lib/risk-engine/methodology";
import { RULES } from "@/lib/risk-engine/registry";
import { computeScore, evaluateRules } from "@/lib/risk-engine/score";
import { CATEGORIES, EVIDENCE_KINDS, SEVERITIES, type RuleContext } from "@/lib/risk-engine/types";

const addr = (c: string) => "0x" + c.repeat(40);

function contract(over: Partial<ContractAnalysis> = {}): ContractAnalysis {
  return {
    analysisBlock: 100, hasCode: true, codeSize: 1000, codeHash: "0x" + "1".repeat(64),
    erc20: { isErc20Like: true, name: "T", symbol: "T", decimals: 18, totalSupply: "1000", missing: [] },
    owner: { state: "none", address: null, isContract: null },
    proxy: { type: "none", implementation: null, admin: null, upgradeable: false },
    capabilities: [],
    source: { checked: true, verified: false, name: null },
    bytecode: { analyzedAddress: addr("a"), analyzedFrom: "token" },
    failures: [],
    ...over,
  };
}
function holders(over: Partial<HolderAnalysis> = {}): HolderAnalysis {
  return {
    totalSupply: "10000", indexedSupply: "10000", holderCount: 10, classifiedCount: 10, topHolders: [],
    exclusions: { burn: "0", contract: "0", burnBps: 0, contractBps: 0 },
    eoaTop1Bps: 500, eoaTop5Bps: 1000, eoaTop10Bps: 2000, eoaTop20Bps: 2500, creatorBps: 100, lowerBound: false,
    ...over,
  };
}
const recon = { supplyMatches: true, indexedSupply: "10000", onChainSupply: "10000", checked: 5, mismatches: [] };
function ctx(over: Partial<RuleContext> = {}): RuleContext {
  return { token: { address: addr("a"), creationBlock: 1, creator: addr("c"), creationTxHash: "0x" + "9".repeat(64) }, analysisBlock: 100, contract: contract(), holders: holders(), creator: null, sybil: null, reconciliation: recon, ...over };
}
const cap = (capability: never, signature: string) => ({ capability, signature, selector: "0x12345678", via: "bytecode_selector" as const, confidence: "medium" as const });

describe("rule registry", () => {
  it("has unique IDs and well-formed metadata", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const r of RULES) {
      expect(r.id).toMatch(/^VG-[A-Z]{3}-\d{3}$/);
      expect(CATEGORIES).toContain(r.category);
      expect(SEVERITIES).toContain(r.maxSeverity);
      expect(r.requires.length).toBeGreaterThan(0);
      expect(r.falsePositives.length).toBeGreaterThan(10);
      expect(r.evidenceKinds.every((k) => EVIDENCE_KINDS.includes(k))).toBe(true);
    }
  });
  it("category weights sum to 1", () => {
    expect(Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it("every rule only emits declared evidence kinds, across varied contexts", () => {
    const contexts = [
      ctx(),
      ctx({ contract: contract({ owner: { state: "active", address: addr("e"), isContract: false }, capabilities: [cap("mint" as never, "mint(address,uint256)"), cap("pause" as never, "pause()"), cap("blacklist" as never, "blacklist(address)"), cap("fee_control" as never, "setFee(uint256)")], proxy: { type: "eip1967", implementation: addr("f"), admin: addr("d"), upgradeable: true } }), holders: holders({ eoaTop1Bps: 6000, eoaTop10Bps: 9500, creatorBps: 5500, topHolders: [{ address: addr("b"), balance: "1", bps: 6000, class: "eoa" }] }), reconciliation: { ...recon, supplyMatches: false, mismatches: [{ address: addr("b"), indexed: "1", onChain: "2" }] } }),
      ctx({ contract: null, holders: null, reconciliation: null }),
    ];
    for (const c of contexts) {
      for (const e of evaluateRules(c)) {
        const rule = RULES.find((r) => r.id === e.rule.id)!;
        for (const ev of e.result.evidence) expect(rule.evidenceKinds).toContain(ev.kind);
        if (e.result.status === "detected") expect(e.result.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("rules", () => {
  const run = (c: RuleContext, id: string) => evaluateRules(c).find((e) => e.rule.id === id)!.result;

  it("mint selector is detected with owner context and reduced when ownership is renounced", () => {
    const active = ctx({ contract: contract({ owner: { state: "active", address: addr("e"), isContract: false }, capabilities: [cap("mint" as never, "mint(address,uint256)")] }) });
    expect(run(active, "VG-CFG-002")).toMatchObject({ status: "detected", severity: "medium", confidence: "medium" });
    const renounced = ctx({ contract: contract({ owner: { state: "renounced", address: "0x" + "0".repeat(40), isContract: null }, capabilities: [cap("mint" as never, "mint(address,uint256)")] }) });
    expect(run(renounced, "VG-CFG-002").severity).toBe("low");
  });
  it("upgradeable proxies are high severity and raise capability severity", () => {
    const c = ctx({ contract: contract({ owner: { state: "renounced", address: "0x" + "0".repeat(40), isContract: null }, proxy: { type: "eip1967", implementation: addr("f"), admin: null, upgradeable: true }, capabilities: [cap("pause" as never, "pause()")] }) });
    expect(run(c, "VG-CFG-007")).toMatchObject({ status: "detected", severity: "high", confidence: "high" });
    expect(run(c, "VG-CFG-003").severity).toBe("medium");
  });
  it("minimal proxy clones are not reported as upgradeable", () => {
    const c = ctx({ contract: contract({ proxy: { type: "minimal", implementation: addr("f"), admin: null, upgradeable: false } }) });
    expect(run(c, "VG-CFG-007").status).toBe("not_detected");
  });
  it("capability checks are unknown, not clear, when bytecode was unavailable", () => {
    const c = ctx({ contract: contract({ bytecode: { analyzedAddress: null, analyzedFrom: "unavailable" } }) });
    for (const id of ["VG-CFG-002", "VG-CFG-003", "VG-CFG-004", "VG-CFG-005", "VG-CFG-006", "VG-CFG-008"]) expect(run(c, id).status).toBe("unknown");
  });
  it("holder rules are unknown without a complete index", () => {
    const c = ctx({ holders: null, reconciliation: null });
    for (const id of ["VG-HLD-001", "VG-HLD-002", "VG-HLD-003", "VG-HLD-004", "VG-INT-002", "VG-INT-003"]) expect(run(c, id).status).toBe("unknown");
  });
  it("holder thresholds map to severities at their boundaries", () => {
    const sev = (bps: number) => run(ctx({ holders: holders({ eoaTop1Bps: bps }) }), "VG-HLD-001");
    expect(sev(1499).status).toBe("not_detected");
    expect(sev(1500)).toMatchObject({ status: "detected", severity: "medium" });
    expect(sev(3000).severity).toBe("high");
    expect(sev(5000).severity).toBe("critical");
  });
  it("unknown creator makes creator holdings unknown", () => {
    expect(run(ctx({ holders: holders({ creatorBps: null }) }), "VG-HLD-003").status).toBe("unknown");
  });
  it("supply mismatch is an integrity finding", () => {
    expect(run(ctx({ reconciliation: { ...recon, supplyMatches: false } }), "VG-INT-002").status).toBe("detected");
  });
  it("a throwing rule yields unknown instead of crashing the scan", () => {
    const bad = { ...RULES[0], evaluate: () => { throw new Error("boom"); } };
    const [e] = evaluateRules(ctx(), [bad]);
    expect(e.result.status).toBe("unknown");
  });
});

describe("score", () => {
  it("is deterministic and carries the methodology version", () => {
    const a = computeScore(evaluateRules(ctx()));
    const b = computeScore(evaluateRules(ctx()));
    expect(a).toEqual(b);
    expect(a.methodologyVersion).toBe(METHODOLOGY_VERSION);
  });
  it("reports coverage separately and marks results provisional", () => {
    const s = computeScore(evaluateRules(ctx()));
    // creator and suspicious rules cannot run without creator/sybil data and liquidity has no rules: 0.30 + 0.20 + 0.05
    expect(s.coverage).toBe(0.55);
    expect(s.provisional).toBe(true);
    const unavailable = s.categories.filter((c) => c.score === null).map((c) => c.category).sort();
    expect(unavailable).toEqual(["creator", "liquidity", "suspicious"]);
    expect(s.categories.find((c) => c.category === "liquidity")!.unavailableReason).toBeTruthy();
    expect(s.categories.find((c) => c.category === "creator")!.unknown).toEqual(["VG-CRT-001", "VG-CRT-002", "VG-CRT-003"]);
  });
  it("missing data lowers coverage and never lowers risk", () => {
    const full = computeScore(evaluateRules(ctx({ contract: contract({ owner: { state: "active", address: addr("e"), isContract: false }, capabilities: [cap("mint" as never, "mint(address,uint256)")] }) })));
    const missing = computeScore(evaluateRules(ctx({ holders: null, reconciliation: null, contract: contract({ owner: { state: "active", address: addr("e"), isContract: false }, capabilities: [cap("mint" as never, "mint(address,uint256)")] }) })));
    expect(missing.coverage).toBeLessThan(full.coverage);
    const holdersCat = missing.categories.find((c) => c.category === "holders")!;
    expect(holdersCat.score).toBeNull();
    expect(holdersCat.unknown.length).toBe(4);
  });
  it("produces no numeric score when coverage is insufficient", () => {
    const s = computeScore(evaluateRules(ctx({ contract: null, holders: null, reconciliation: null })));
    expect(s.overall).toBeNull();
    expect(s.level).toBe("insufficient");
    expect(s.coverage).toBe(0);
  });
  it("does not double count rules in the same overlap group", () => {
    const base = contract({ owner: { state: "renounced", address: "0x" + "0".repeat(40), isContract: null } });
    const one = computeScore(evaluateRules(ctx({ contract: { ...base, capabilities: [cap("blacklist" as never, "blacklist(address)")] } })));
    const both = computeScore(evaluateRules(ctx({ contract: { ...base, capabilities: [cap("blacklist" as never, "blacklist(address)"), cap("trading_control" as never, "enableTrading()")] } })));
    const pts = (s: ReturnType<typeof computeScore>) => s.categories.find((c) => c.category === "contract")!.score!;
    // CFG-004 (low, reduced) and CFG-006 (low, reduced) share "transfer-restriction": counted once.
    expect(pts(both)).toBe(pts(one));
  });
  it("a critical finding forces a critical level independent of the aggregate", () => {
    const s = computeScore(evaluateRules(ctx({ holders: holders({ eoaTop1Bps: 9000 }) })));
    expect(s.criticalOverride).toBe(true);
    expect(s.level).toBe("critical");
    expect(s.overall!).toBeLessThan(80);
  });
  it("clean token is low risk but still provisional", () => {
    const s = computeScore(evaluateRules(ctx({ contract: contract({ source: { checked: true, verified: true, name: "T" } }) })));
    expect(s.level).toBe("low");
    expect(s.overall).toBe(0);
    expect(s.provisional).toBe(true);
  });
});
