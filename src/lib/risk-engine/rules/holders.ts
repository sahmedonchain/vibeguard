import { HOLDER_THRESHOLDS } from "../methodology";
import type { EvidenceItem, Rule, RuleContext, RuleResult, Severity } from "../types";
import { pct, unknown } from "./helpers";

const NEED = "Holder balances need the full transfer history up to the analysis block. The index did not cover it, so this was not checked.";

function tier(value: number, t: { medium: number; high: number; critical: number }): Severity | null {
  return value >= t.critical ? "critical" : value >= t.high ? "high" : value >= t.medium ? "medium" : null;
}

function holderEvidence(ctx: RuleContext, n: number): EvidenceItem[] {
  return (ctx.holders?.topHolders ?? [])
    .filter((h) => h.class === "eoa" || h.class === "creator")
    .slice(0, n)
    .map((h) => ({ kind: "address" as const, label: `${h.class === "creator" ? "Creator" : "Holder"} ${pct(h.bps)} of supply`, address: h.address, data: { bps: h.bps, class: h.class } }));
}

const lowerBoundNote = (ctx: RuleContext) => (ctx.holders?.lowerBound ? " Only the largest 50 holders were classified, so shares are lower bounds." : "");

export const holderRules: Rule[] = [
  {
    id: "VG-HLD-001",
    name: "Top holder concentration",
    category: "holders",
    description: "Share of total supply held by the single largest non-contract, non-burn holder.",
    maxSeverity: "critical",
    requires: ["indexed transfers (complete)", "totalSupply()", "eth_getCode for top holders"],
    dedupGroup: "holder-concentration",
    evidenceKinds: ["address", "metric"],
    falsePositives: "A holder may be an exchange, vesting wallet, or the project treasury. Contracts (including bonding curves) are excluded and reported separately.",
    evaluate(ctx): RuleResult {
      const r = holderRules[0];
      if (!ctx.holders) return unknown(r, NEED);
      const v = ctx.holders.eoaTop1Bps;
      const sev = tier(v, HOLDER_THRESHOLDS.top1);
      const base = { confidence: "high" as const, evidence: [...holderEvidence(ctx, 1), { kind: "metric" as const, label: "Top holder share (basis points)", data: { bps: v } }] };
      if (!sev) return { ...base, status: "not_detected", severity: r.maxSeverity, title: "Top holder concentration: below thresholds", explanation: `The largest non-contract holder owns ${pct(v)} of supply.${lowerBoundNote(ctx)}` };
      return { ...base, status: "detected", severity: sev, title: `Largest holder owns ${pct(v)} of supply`, explanation: `One non-contract, non-burn address holds ${pct(v)} of total supply. Large single holders can move the price or exit abruptly.${lowerBoundNote(ctx)}`, followUp: "Check whether this address is a treasury, vesting wallet, or the creator." };
    },
  },
  {
    id: "VG-HLD-002",
    name: "Top 10 holder concentration",
    category: "holders",
    description: "Combined share of total supply held by the ten largest non-contract, non-burn holders.",
    maxSeverity: "critical",
    requires: ["indexed transfers (complete)", "totalSupply()", "eth_getCode for top holders"],
    dedupGroup: "holder-concentration",
    evidenceKinds: ["address", "metric"],
    falsePositives: "Early-stage tokens are naturally concentrated. Related wallets may be one entity or unrelated.",
    evaluate(ctx): RuleResult {
      const r = holderRules[1];
      if (!ctx.holders) return unknown(r, NEED);
      const v = ctx.holders.eoaTop10Bps;
      const sev = tier(v, HOLDER_THRESHOLDS.top10);
      const base = { confidence: "high" as const, evidence: [...holderEvidence(ctx, 10), { kind: "metric" as const, label: "Top 10 share (basis points)", data: { bps: v } }] };
      if (!sev) return { ...base, status: "not_detected", severity: r.maxSeverity, title: "Top 10 concentration: below thresholds", explanation: `The ten largest non-contract holders own ${pct(v)} of supply.${lowerBoundNote(ctx)}` };
      return { ...base, status: "detected", severity: sev, title: `Top 10 holders own ${pct(v)} of supply`, explanation: `Ten non-contract, non-burn addresses hold ${pct(v)} of total supply.${lowerBoundNote(ctx)}`, followUp: "Look for shared funding between these wallets." };
    },
  },
  {
    id: "VG-HLD-003",
    name: "Creator holdings",
    category: "holders",
    description: "Share of total supply held by the address that sent the token creation transaction.",
    maxSeverity: "critical",
    requires: ["creation transaction", "indexed transfers (complete)", "totalSupply()"],
    evidenceKinds: ["address", "metric", "transaction"],
    falsePositives: "A creator holding supply is normal early on. The creation sender may be a user acting through a launchpad contract.",
    evaluate(ctx): RuleResult {
      const r = holderRules[2];
      if (!ctx.holders) return unknown(r, NEED);
      if (ctx.holders.creatorBps === null) return unknown(r, "The creator could not be identified from the creation transaction, so creator holdings were not checked.");
      const v = ctx.holders.creatorBps;
      const sev = tier(v, HOLDER_THRESHOLDS.creator);
      const ev: EvidenceItem[] = [{ kind: "address", label: `Creation transaction sender holds ${pct(v)}`, address: ctx.token.creator ?? undefined, data: { bps: v } }];
      if (ctx.token.creationTxHash) ev.push({ kind: "transaction", label: "Creation transaction", txHash: ctx.token.creationTxHash });
      if (!sev) return { status: "not_detected", severity: r.maxSeverity, confidence: "high", title: "Creator holdings: below thresholds", explanation: `The creation transaction sender holds ${pct(v)} of supply.`, evidence: ev };
      return { status: "detected", severity: sev, confidence: "medium", title: `Creator holds ${pct(v)} of supply`, explanation: `The address that sent the creation transaction holds ${pct(v)} of total supply.`, followUp: "Review the creator's transfers for sales into the market.", evidence: ev };
    },
  },
  {
    id: "VG-HLD-004",
    name: "Supply held by contracts",
    category: "holders",
    description: "Share of supply held by contract addresses (pools, bonding curves, vaults, or other contracts).",
    maxSeverity: "info",
    requires: ["indexed transfers (complete)", "eth_getCode for top holders"],
    evidenceKinds: ["address", "metric"],
    falsePositives: "Bonding-curve and liquidity contracts legitimately hold most supply. VibeGuard cannot yet verify what a contract is, so this is context, not a score input.",
    evaluate(ctx): RuleResult {
      const r = holderRules[3];
      if (!ctx.holders) return unknown(r, NEED);
      const v = ctx.holders.exclusions.contractBps;
      const contracts = ctx.holders.topHolders.filter((h) => h.class === "contract").slice(0, 5);
      const ev: EvidenceItem[] = contracts.map((h) => ({ kind: "address", label: `Contract holds ${pct(h.bps)}`, address: h.address, data: { bps: h.bps } }));
      if (v < HOLDER_THRESHOLDS.contractHeldInfo) return { status: "not_detected", severity: "info", confidence: "high", title: "Supply held by contracts: minor", explanation: `Contracts among the largest holders own ${pct(v)} of supply.`, evidence: ev };
      return { status: "detected", severity: "info", confidence: "high", title: `Contracts hold ${pct(v)} of supply`, explanation: `Contract addresses hold ${pct(v)} of supply. This is excluded from concentration figures. It may be a bonding curve or liquidity pool, but VibeGuard has not verified that. Review these contracts.`, followUp: "Open each contract on the explorer and check what it is and who controls it.", evidence: ev };
    },
  },
];
