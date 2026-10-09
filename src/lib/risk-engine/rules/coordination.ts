import type { Cluster } from "@/lib/analysis/sybil";
import { fundingCoverage } from "@/lib/analysis/sybil";
import { SYBIL_THRESHOLDS as T } from "../methodology";
import type { EvidenceItem, Rule, RuleResult, Severity } from "../types";
import { pct, unknown } from "./helpers";

const NEED = "Coordination analysis needs the full transfer history to identify the largest wallet holders. The index did not cover it, so this was not checked.";
const FUNDING_KINDS = new Set(["shared_funder", "funding_time_correlation", "funding_amount_similarity"]);
const BEHAVIOR_KINDS = new Set(["coordinated_acquisition", "token_consolidation"]);
const RANK: Severity[] = ["info", "low", "medium", "high", "critical"];

/** Behavioral inference never reaches critical, and a low-confidence cluster is at most low. */
function severityOf(c: Cluster): Severity | null {
  if (!c.scored) return null;
  if (c.confidence === "low") return "low";
  return c.combinedBps >= T.highClusterShareBps ? "high" : "medium";
}

function strongest(clusters: Cluster[]): Cluster | null {
  return [...clusters].filter((c) => severityOf(c) !== null).sort((a, b) => RANK.indexOf(severityOf(b)!) - RANK.indexOf(severityOf(a)!) || b.combinedBps - a.combinedBps || a.id.localeCompare(b.id))[0] ?? null;
}

function evidenceFor(c: Cluster): EvidenceItem[] {
  const ev: EvidenceItem[] = c.members.slice(0, 6).map((m) => ({ kind: "address", label: `Cluster member holding ${pct(m.balanceBps)} of supply`, address: m.address, data: { bps: m.balanceBps, cluster: c.id } }));
  for (const e of c.evidence.filter((x) => x.txHash).slice(0, 3)) ev.push({ kind: "transaction", label: e.detail, txHash: e.txHash, blockNumber: e.block });
  ev.push({ kind: "metric", label: "Cluster combined share of supply (basis points)", data: { bps: c.combinedBps, members: c.members.length, confidence: c.confidence, cluster: c.id } });
  return ev;
}

function detected(r: Pick<Rule, "name">, c: Cluster, what: string): RuleResult {
  const sev = severityOf(c)!;
  return {
    status: "detected",
    severity: sev,
    confidence: c.confidence,
    title: `${c.label}: ${c.members.length} top holders hold ${pct(c.combinedBps)} of supply`,
    explanation: `${c.members.length} wallets among the largest holders show ${what}, together holding ${pct(c.combinedBps)} of supply. This describes similar behavior, not a shared owner. Signals: ${c.signals.map((s) => s.label.toLowerCase()).join("; ")}.`,
    followUp: "Open the sybil view to see the evidence and the alternative explanations for each signal.",
    evidence: evidenceFor(c),
  };
}

export const coordinationRules: Rule[] = [
  {
    id: "VG-SUS-001",
    name: "Funding coordination among top holders",
    category: "suspicious",
    description: "Several of the largest wallet holders were first funded by the same non-hub wallet, with correlated timing or amounts.",
    maxSeverity: "high",
    requires: ["indexed transfers (complete)", "explorer transaction history of top holders", "eth_getCode of funders"],
    dedupGroup: "coordination",
    evidenceKinds: ["address", "transaction", "metric"],
    falsePositives: "Exchanges, faucets, bridges and people funding their own separate wallets all create shared funding. Hub and contract funders are not used as evidence. A shared funder never proves one owner.",
    evaluate(ctx): RuleResult {
      const r = coordinationRules[0];
      if (!ctx.sybil || !ctx.holders) return unknown(r, NEED);
      const s = ctx.sybil;
      const hit = strongest(s.clusters.filter((c) => c.signals.some((x) => FUNDING_KINDS.has(x.kind))));
      if (hit) return detected(r, hit, "a shared funding source");
      if (s.candidates < 2) return { status: "not_detected", severity: "high", confidence: "high", title: "Too few wallet holders to compare", explanation: `Only ${s.candidates} non-contract holder(s) were examined, so no cluster can exist.`, evidence: [] };
      if (fundingCoverage(s) < 0.5) return unknown(r, `Funding history could be read for only ${s.fundingResolved} of ${s.candidates} top wallet holders${s.budgetExceeded ? " before the time budget ran out" : ""}, which is too few to rule out shared funding.`);
      const small = s.clusters.filter((c) => c.signals.some((x) => FUNDING_KINDS.has(x.kind))).length;
      return { status: "not_detected", severity: "high", confidence: s.fundingResolved === s.candidates ? "medium" : "low", title: "No funding coordination among top holders", explanation: `Funding was read for ${s.fundingResolved} of ${s.candidates} top wallet holders; no group sharing a funder reached ${pct(T.minClusterShareBps)} of supply${small ? ` (${small} smaller group${small === 1 ? "" : "s"} shown on the sybil view)` : ""}. Wallets funded through exchanges or bridges cannot be linked this way.`, evidence: [{ kind: "metric", label: "Wallets examined / funding resolved", data: { candidates: s.candidates, resolved: s.fundingResolved } }] };
    },
  },
  {
    id: "VG-SUS-002",
    name: "Synchronized acquisition or consolidation",
    category: "suspicious",
    description: "Several of the largest wallet holders first received the token in the same minute, or sent tokens to the same wallet.",
    maxSeverity: "high",
    requires: ["indexed transfers (complete)"],
    dedupGroup: "coordination",
    evidenceKinds: ["address", "transaction", "metric"],
    falsePositives: "Launches and social posts make unrelated buyers act together, and exchange deposit addresses receive from many users. Bursts of more than 10 wallets are ignored as launch-wide activity.",
    evaluate(ctx): RuleResult {
      const r = coordinationRules[1];
      if (!ctx.sybil || !ctx.holders) return unknown(r, NEED);
      const s = ctx.sybil;
      const hit = strongest(s.clusters.filter((c) => c.signals.some((x) => BEHAVIOR_KINDS.has(x.kind))));
      if (hit) return detected(r, hit, "synchronized acquisition or token consolidation");
      return { status: "not_detected", severity: "high", confidence: "medium", title: "No synchronized acquisition or consolidation", explanation: `The ${s.candidates} largest wallet holders showed no group of ${T.acquisitionMinGroup}–${T.acquisitionMaxGroup} first buyers in the same ${T.acquisitionWindowSeconds}s, and no common recipient of their tokens, that reaches ${pct(T.minClusterShareBps)} of supply.`, evidence: [{ kind: "metric", label: "Wallets examined", data: { candidates: s.candidates } }] };
    },
  },
];
