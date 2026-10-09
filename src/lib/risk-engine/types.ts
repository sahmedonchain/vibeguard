import type { CreatorAnalysis } from "@/lib/analysis/creator";
import type { SybilAnalysis } from "@/lib/analysis/sybil";
import type { ContractAnalysis } from "@/lib/contracts/analyze";
import type { HolderAnalysis } from "@/lib/indexing/holders";

export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = ["contract", "holders", "creator", "liquidity", "suspicious", "integrity"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Confidence = "low" | "medium" | "high";
export type FindingStatus = "detected" | "not_detected" | "unknown";

export const EVIDENCE_KINDS = ["address", "transaction", "block", "selector", "storage_slot", "metric", "explorer_field"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type EvidenceItem = {
  kind: EvidenceKind;
  label: string;
  address?: string;
  txHash?: string;
  blockNumber?: number;
  /** Small JSON-serializable detail (selector, signature, value). */
  data?: Record<string, string | number | boolean | null>;
};

/** Everything a rule may read. Fields are null when the data could not be obtained. */
export type RuleContext = {
  token: { address: string; creationBlock: number | null; creator: string | null; creationTxHash: string | null };
  analysisBlock: number;
  contract: ContractAnalysis | null;
  /** Null unless the transfer index covered the full history up to analysisBlock. */
  holders: HolderAnalysis | null;
  /** Creator history; null when it was not attempted. `explorerAvailable` is false when the explorer failed. */
  creator: CreatorAnalysis | null;
  /** Coordination analysis of the largest wallet holders; null unless holders were computed. */
  sybil: SybilAnalysis | null;
  /** Result of reconciling indexed balances against on-chain reads; null if not performed. */
  reconciliation: { supplyMatches: boolean; indexedSupply: string; onChainSupply: string; checked: number; mismatches: { address: string; indexed: string; onChain: string }[] } | null;
};

export type RuleResult = {
  status: FindingStatus;
  /** Severity if detected. For not_detected/unknown, the rule's declared severity is kept for display. */
  severity: Severity;
  confidence: Confidence;
  title: string;
  explanation: string;
  followUp?: string;
  evidence: EvidenceItem[];
};

export type Rule = {
  id: string;
  name: string;
  category: Category;
  description: string;
  /** Highest severity this rule can produce. */
  maxSeverity: Severity;
  /** Data the rule needs; documented in the methodology page. */
  requires: string[];
  /** Rules sharing a group count once (highest points) so overlapping evidence is not double counted. */
  dedupGroup?: string;
  evidenceKinds: EvidenceKind[];
  falsePositives: string;
  evaluate: (ctx: RuleContext) => RuleResult;
};

export type EvaluatedRule = { rule: Pick<Rule, "id" | "name" | "category" | "dedupGroup" | "maxSeverity">; result: RuleResult };
