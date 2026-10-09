import type { Category, Confidence, Severity } from "./types";

/**
 * Methodology 1.0.0. Constants here are the single source of truth: the DB row, the API,
 * the /methodology page and docs/RISK_METHODOLOGY.md are all derived from or checked against them.
 * Every number is an initial product default (SRS 8.2-8.3), not a validated constant.
 */
export const METHODOLOGY_VERSION = "1.1.1";

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

/** Coverage below this: the score is marked provisional (any coverage under 100%). */
export const PROVISIONAL_BELOW_COVERAGE = 1;
/** Coverage below this: no numeric score is produced (INSUFFICIENT_DATA). */
export const INSUFFICIENT_BELOW_COVERAGE = 0.25;

/** The one provisional rule: engine, report banner, band label and creator table all use it. */
export const isProvisional = (coverage: number | undefined) => coverage !== undefined && coverage < PROVISIONAL_BELOW_COVERAGE;

/** Holder concentration thresholds, in basis points of total supply (EOA/creator holders only). */
export const HOLDER_THRESHOLDS = {
  top1: { medium: 1500, high: 3000, critical: 5000 },
  top10: { medium: 5000, high: 7500, critical: 9000 },
  creator: { medium: 1500, high: 3000, critical: 5000 },
  contractHeldInfo: 5000,
} as const;

/**
 * Creator/deployer thresholds (VG-CRT-*). Initial product defaults, uncalibrated.
 * "Other creations" counts are lower bounds: only a bounded window of the creator's history is read.
 */
export const CREATOR_THRESHOLDS = {
  /** Creator wallet first seen less than this long before the token creation. */
  freshWalletSeconds: 24 * 3600,
  /** Other tokens created by the same sender through the same creation path. */
  repeatCreations: { low: 3, medium: 10 },
  /** Creator held at least this share at its peak and kept at most `remainingRatioBps` of that peak. */
  sellDown: { minPeakBps: 500, remainingRatioBps: 1000 },
  /** History pages read per scan (50 transactions each) and token-creation lookups resolved. */
  maxCreationLookups: 20,
} as const;

/**
 * Coordination thresholds (VG-SUS-001/002). Heuristics for behavioral similarity, not identity.
 * Signals are grouped into independent families (funding, acquisition, consolidation).
 */
export const SYBIL_THRESHOLDS = {
  /** Largest non-contract, non-burn holders examined. */
  candidateLimit: 30,
  /** Funding events of one funder this close together count as correlated. */
  fundingWindowSeconds: 600,
  /** smaller/larger funding amount must reach this ratio to count as similar. */
  amountSimilarityMinRatio: 0.75,
  /** Holders whose first receipt of the token falls in one window of this length. */
  acquisitionWindowSeconds: 60,
  acquisitionMinGroup: 3,
  /** Larger groups are treated as launch-wide activity, not coordination. */
  acquisitionMaxGroup: 10,
  /** Funders with this many transactions or more are treated as hubs (exchange, faucet, bridge). */
  hubFunderTxCount: 1000,
  /** Cluster share of total supply (bps) below which a cluster is shown but not scored. */
  minClusterShareBps: 1000,
  highClusterShareBps: 2500,
} as const;

export const METHODOLOGY_DESCRIPTION =
  "Weighted category model. Unknown data never counts as safe: coverage is reported separately and a score below 100% coverage is provisional.";
