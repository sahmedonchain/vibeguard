import { tokenCreations } from "@/lib/analysis/creator";
import { CREATOR_THRESHOLDS as T } from "../methodology";
import type { EvidenceItem, Rule, RuleContext, RuleResult } from "../types";
import { pct, unknown } from "./helpers";

const NO_CREATOR = "The creation transaction sender could not be identified, so creator history was not checked.";
const NO_EXPLORER = "The explorer did not return the creator's transaction history, so this was not checked. Unknown is not treated as safe.";

/** Returns the creator analysis if it is usable for explorer-derived rules, else the reason it is not. */
function explorerData(ctx: RuleContext): { c: NonNullable<RuleContext["creator"]> } | { why: string } {
  if (!ctx.token.creator) return { why: NO_CREATOR };
  if (!ctx.creator || !ctx.creator.explorerAvailable) return { why: NO_EXPLORER };
  return { c: ctx.creator };
}

const hours = (s: number) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} minutes` : s < 172_800 ? `${(s / 3600).toFixed(1)} hours` : `${Math.round(s / 86_400)} days`);

export const creatorRules: Rule[] = [
  {
    id: "VG-CRT-001",
    name: "New creator wallet",
    category: "creator",
    description: "The wallet that sent the creation transaction first appeared on chain shortly before creating the token.",
    maxSeverity: "low",
    requires: ["creation transaction", "explorer transaction history for the creator"],
    evidenceKinds: ["address", "transaction", "metric"],
    falsePositives: "New users create wallets to launch their first token. A new wallet is not evidence of bad intent; it only means there is no track record.",
    evaluate(ctx): RuleResult {
      const r = creatorRules[0];
      const d = explorerData(ctx);
      if ("why" in d) return unknown(r, d.why);
      const age = d.c.ageAtCreationSeconds;
      if (age === null || !d.c.firstSeen) return unknown(r, "The creator's first transaction or the token creation time was unavailable, so wallet age could not be computed.");
      const ev: EvidenceItem[] = [
        { kind: "address", label: "Creation transaction sender", address: d.c.address },
        { kind: "transaction", label: "Wallet's first observed transaction", txHash: d.c.firstSeen.txHash, blockNumber: d.c.firstSeen.block },
        { kind: "metric", label: "Wallet age at token creation (seconds)", data: { seconds: age } },
      ];
      if (age < T.freshWalletSeconds) {
        return { status: "detected", severity: "low", confidence: "medium", title: `Creator wallet was ${hours(age)} old at creation`, explanation: `The wallet's first observed transaction was ${hours(age)} before it created this token, so it has no earlier track record.`, followUp: "Check what else the wallet has done on its creator page.", evidence: ev };
      }
      return { status: "not_detected", severity: "low", confidence: "medium", title: "Creator wallet had prior history", explanation: `The wallet's first observed transaction was ${hours(age)} before it created this token.`, evidence: ev };
    },
  },
  {
    id: "VG-CRT-002",
    name: "Repeated token creation",
    category: "creator",
    description: "The same sender created several other tokens through the same creation path.",
    maxSeverity: "medium",
    requires: ["explorer transaction history for the creator", "creation path of this token"],
    evidenceKinds: ["address", "transaction", "metric"],
    falsePositives: "Prolific builders and token-launch services create many tokens legitimately. Counts are lower bounds because only a bounded window of history is read.",
    evaluate(ctx): RuleResult {
      const r = creatorRules[1];
      const d = explorerData(ctx);
      if ("why" in d) return unknown(r, d.why);
      const tokens = tokenCreations(d.c);
      const n = tokens.length;
      const ev: EvidenceItem[] = [
        { kind: "metric", label: "Other tokens created (lower bound)", data: { count: n, unresolvedCandidates: d.c.creationSearch.unresolved } },
        ...tokens.slice(0, 5).map((c) => ({ kind: "transaction" as const, label: `Created ${c.token}`, txHash: c.txHash, blockNumber: c.block, address: c.token })),
      ];
      if (n >= T.repeatCreations.low) {
        const sev = n >= T.repeatCreations.medium ? "medium" : "low";
        return { status: "detected", severity: sev, confidence: "medium", title: `Creator launched at least ${n} other token${n === 1 ? "" : "s"}`, explanation: `The same sender created at least ${n} other token${n === 1 ? "" : "s"} through the same creation path. Serial launching is common for legitimate builders and for abuse; the creator page lists each one.`, followUp: "Review the creator's earlier tokens before relying on this one.", evidence: ev };
      }
      if (d.c.creationSearch.possiblyIncomplete) {
        return unknown(r, `Only part of the creator's history was read (${d.c.txCount ?? "an unknown number of"} transactions exist; the latest 100 and earliest 50 were checked${d.c.creationSearch.unresolved ? `, ${d.c.creationSearch.unresolved} candidate launches could not be resolved` : ""}), so repeated creation can be neither confirmed nor ruled out.`);
      }
      return { status: "not_detected", severity: "medium", confidence: "medium", title: "No repeated token creation observed", explanation: `The creator's full history was read and shows ${n} other confirmed token${n === 1 ? "" : "s"} created through the same path.`, evidence: ev };
    },
  },
  {
    id: "VG-CRT-003",
    name: "Creator sold down position",
    category: "creator",
    description: "The creation transaction sender once held a meaningful share of supply and now holds a small fraction of that peak.",
    maxSeverity: "medium",
    requires: ["indexed transfers (complete)", "creation transaction sender"],
    evidenceKinds: ["address", "metric"],
    falsePositives: "Creators often distribute supply on purpose (liquidity, rewards, treasury moves). Selling is not wrongdoing by itself; the transfer index does not show where the tokens went.",
    evaluate(ctx): RuleResult {
      const r = creatorRules[2];
      if (!ctx.token.creator) return unknown(r, NO_CREATOR);
      if (!ctx.holders || !ctx.creator) return unknown(r, "Creator balance history needs the full transfer history up to the analysis block. The index did not cover it, so this was not checked.");
      const s = ctx.creator.sellDown;
      if (!s) return { status: "not_detected", severity: "medium", confidence: "high", title: "Creator never held a balance", explanation: "The creation transaction sender never received tokens in the indexed history.", evidence: [{ kind: "address", label: "Creation transaction sender", address: ctx.token.creator }] };
      const remainingBps = s.peakBps === 0 ? 0 : Math.round((s.currentBps * 10_000) / s.peakBps);
      const ev: EvidenceItem[] = [
        { kind: "address", label: "Creation transaction sender", address: ctx.token.creator },
        { kind: "metric", label: "Peak vs current share of supply (basis points)", blockNumber: s.peakBlock, data: { peakBps: s.peakBps, currentBps: s.currentBps } },
      ];
      if (s.peakBps >= T.sellDown.minPeakBps && remainingBps <= T.sellDown.remainingRatioBps) {
        const sev = s.peakBps >= 2000 ? "medium" : "low";
        return { status: "detected", severity: sev, confidence: "medium", title: `Creator went from ${pct(s.peakBps)} to ${pct(s.currentBps)} of supply`, explanation: `The creation transaction sender held up to ${pct(s.peakBps)} of supply and now holds ${pct(s.currentBps)}. The tokens left the wallet; the index does not say whether they were sold.`, followUp: "Open the creator's token transfers and check the destination addresses.", evidence: ev };
      }
      return { status: "not_detected", severity: "medium", confidence: "medium", title: "Creator position not sold down", explanation: `The creator's peak share was ${pct(s.peakBps)} and it now holds ${pct(s.currentBps)}.`, evidence: ev };
    },
  },
];
