import type { ContractAnalysis, DetectedCapability } from "@/lib/contracts/analyze";
import type { CapabilityKey } from "@/lib/contracts/selectors";
import type { Confidence, EvidenceItem, Rule, RuleContext, RuleResult, Severity } from "../types";

export const unknown = (r: Pick<Rule, "name" | "maxSeverity">, why: string): RuleResult => ({
  status: "unknown",
  severity: r.maxSeverity,
  confidence: "low",
  title: `${r.name}: could not be checked`,
  explanation: why,
  evidence: [],
});

/** Contract data is usable only when code exists and no provider read failed in a way that hides capabilities. */
export function contractUsable(c: ContractAnalysis | null): c is ContractAnalysis {
  return c !== null && c.hasCode && c.bytecode.analyzedFrom !== "unavailable";
}

export function capsOf(c: ContractAnalysis, keys: CapabilityKey[]): DetectedCapability[] {
  return c.capabilities.filter((x) => keys.includes(x.capability));
}

export function capEvidence(c: ContractAnalysis, caps: DetectedCapability[]): EvidenceItem[] {
  const ev: EvidenceItem[] = caps.map((x) => ({
    kind: "selector",
    label: `${x.signature} (${x.via === "abi" ? "verified ABI" : "bytecode selector"})`,
    address: c.bytecode.analyzedAddress ?? undefined,
    data: { signature: x.signature, selector: x.selector, via: x.via },
  }));
  return ev;
}

export const bestConfidence = (caps: DetectedCapability[]): Confidence => (caps.some((x) => x.confidence === "high") ? "high" : "medium");

export function scanScope(c: ContractAnalysis): string {
  return c.bytecode.analyzedFrom === "implementation" ? "the proxy's implementation bytecode" : "the token's bytecode";
}

export const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

export function severityAtLeast(a: Severity, b: Severity): Severity {
  const order: Severity[] = ["info", "low", "medium", "high", "critical"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export type { RuleContext };
