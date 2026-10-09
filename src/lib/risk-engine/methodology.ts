import type { Category, Confidence, Severity } from "./types";

/**
 * Methodology 1.0.0. Constants here are the single source of truth: the DB row, the API,
 * the /methodology page and docs/RISK_METHODOLOGY.md are all derived from or checked against them.
 * Every number is an initial product default (SRS 8.2-8.3), not a validated constant.
 */
export const METHODOLOGY_VERSION = "1.0.0";

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  contract: 0.3,
  holders: 0.2,
  creator: 0.15,
  liquidity: 0.15,
  suspicious: 0.15,
  integrity: 0.05,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  contract: "Contract permissions and behavior",
  holders: "Holder concentration",
  creator: "Creator/deployer history",
  liquidity: "Liquidity and market structure",
  suspicious: "Suspicious transaction behavior",
  integrity: "Data integrity and provenance",
};

/** Points a detected finding adds to its category (before the confidence multiplier). */
export const SEVERITY_POINTS: Record<Severity, number> = { info: 0, low: 8, medium: 20, high: 40, critical: 70 };

export const CONFIDENCE_MULTIPLIER: Record<Confidence, number> = { low: 0.5, medium: 0.75, high: 1 };

/** SRS 8.2 bands on the 0-100 risk scale. Upper bounds are exclusive except the last. */
export const RISK_LEVELS = [
  { level: "low", label: "Low observed risk", min: 0, max: 19 },
  { level: "moderate", label: "Moderate observed risk", min: 20, max: 39 },
  { level: "elevated", label: "Elevated risk", min: 40, max: 59 },
  { level: "high", label: "High risk", min: 60, max: 79 },
  { level: "critical", label: "Critical risk", min: 80, max: 100 },
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number]["level"] | "insufficient";

/** Coverage below this: the score is marked provisional. */
export const PROVISIONAL_BELOW_COVERAGE = 0.8;
/** Coverage below this: no numeric score is produced (INSUFFICIENT_DATA). */
export const INSUFFICIENT_BELOW_COVERAGE = 0.25;

/** Holder concentration thresholds, in basis points of total supply (EOA/creator holders only). */
export const HOLDER_THRESHOLDS = {
  top1: { medium: 1500, high: 3000, critical: 5000 },
  top10: { medium: 5000, high: 7500, critical: 9000 },
  creator: { medium: 1500, high: 3000, critical: 5000 },
  contractHeldInfo: 5000,
} as const;

export const METHODOLOGY_DESCRIPTION =
  "Weighted category model. Unknown data never counts as safe: coverage is reported separately and a score below 80% coverage is provisional.";
