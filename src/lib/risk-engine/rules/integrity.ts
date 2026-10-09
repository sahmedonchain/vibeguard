import type { Rule, RuleResult } from "../types";
import { unknown } from "./helpers";

export const integrityRules: Rule[] = [
  {
    id: "VG-INT-001",
    name: "Unverified source code",
    category: "integrity",
    description: "The explorer has no verified source code for the contract that was analyzed.",
    maxSeverity: "low",
    requires: ["explorer smart-contract record"],
    evidenceKinds: ["explorer_field", "address"],
    falsePositives: "Many testnet contracts are unverified. Unverified code limits VibeGuard to bytecode heuristics (lower confidence).",
    evaluate(ctx): RuleResult {
      const r = integrityRules[0];
      const c = ctx.contract;
      if (!c || !c.hasCode) return unknown(r, "Contract code was not available.");
      if (!c.source.checked) return unknown(r, "The explorer did not respond, so verification status is unknown.");
      const ev = [{ kind: "explorer_field" as const, label: "is_verified", address: c.bytecode.analyzedAddress ?? undefined, data: { is_verified: c.source.verified === true } }];
      if (c.source.verified) return { status: "not_detected", severity: "low", confidence: "high", title: "Source code is verified", explanation: "The explorer has verified source for the analyzed contract.", evidence: ev };
      return { status: "detected", severity: "low", confidence: "high", title: "Source code is not verified", explanation: "No verified source exists on the explorer for the analyzed contract. Capability checks use bytecode selector matching, which is less precise than reading source.", followUp: "Ask the creator to verify the source, or review the bytecode manually.", evidence: ev };
    },
  },
  {
    id: "VG-INT-002",
    name: "Supply reconciliation",
    category: "integrity",
    description: "Supply derived from indexed transfers matches totalSupply() at the analysis block.",
    maxSeverity: "medium",
    requires: ["indexed transfers (complete)", "totalSupply()"],
    evidenceKinds: ["metric"],
    falsePositives: "Rebasing or fee-adjusting tokens change balances without Transfer events and will not reconcile.",
    evaluate(ctx): RuleResult {
      const r = integrityRules[1];
      if (!ctx.reconciliation) return unknown(r, "The transfer index was incomplete or totalSupply() could not be read, so supply could not be reconciled.");
      const rec = ctx.reconciliation;
      const ev = [{ kind: "metric" as const, label: "Supply: indexed vs on-chain", data: { indexed: rec.indexedSupply, onChain: rec.onChainSupply } }];
      if (rec.supplyMatches) return { status: "not_detected", severity: "medium", confidence: "high", title: "Supply reconciles with the transfer index", explanation: "Supply derived from Transfer events equals totalSupply().", evidence: ev };
      return { status: "detected", severity: "medium", confidence: "high", title: "Indexed supply does not match totalSupply()", explanation: "Supply derived from Transfer events differs from totalSupply(). Holder figures may be unreliable (missing events, rebasing, or a nonstandard token).", followUp: "Treat holder metrics as unverified.", evidence: ev };
    },
  },
  {
    id: "VG-INT-003",
    name: "Balance reconciliation",
    category: "integrity",
    description: "Balances of the largest holders derived from transfers match balanceOf() at the analysis block.",
    maxSeverity: "medium",
    requires: ["indexed transfers (complete)", "balanceOf() for top holders"],
    evidenceKinds: ["address", "metric"],
    falsePositives: "Rebasing and fee-adjusting tokens will not reconcile.",
    evaluate(ctx): RuleResult {
      const r = integrityRules[2];
      if (!ctx.reconciliation || ctx.reconciliation.checked === 0) return unknown(r, "No holder balances could be checked against balanceOf().");
      const rec = ctx.reconciliation;
      if (rec.mismatches.length === 0) return { status: "not_detected", severity: "medium", confidence: "high", title: "Holder balances reconcile", explanation: `${rec.checked} largest balances match balanceOf().`, evidence: [{ kind: "metric", label: "Balances checked", data: { checked: rec.checked } }] };
      return {
        status: "detected", severity: "medium", confidence: "high",
        title: `${rec.mismatches.length} holder balance(s) do not match balanceOf()`,
        explanation: "Balances derived from transfers differ from on-chain balanceOf() for some top holders. Holder metrics may be unreliable.",
        followUp: "Treat holder metrics as unverified.",
        evidence: rec.mismatches.slice(0, 5).map((m) => ({ kind: "address" as const, label: "Mismatched balance", address: m.address, data: { indexed: m.indexed, onChain: m.onChain } })),
      };
    },
  },
];
