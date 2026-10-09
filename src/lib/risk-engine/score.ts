import {
  CATEGORY_WEIGHTS,
  CONFIDENCE_MULTIPLIER,
  INSUFFICIENT_BELOW_COVERAGE,
  METHODOLOGY_VERSION,
  PROVISIONAL_BELOW_COVERAGE,
  RISK_LEVELS,
  SEVERITY_POINTS,
  type RiskLevel,
} from "./methodology";
import { RULES } from "./registry";
import { CATEGORIES, type Category, type EvaluatedRule, type Rule, type RuleContext } from "./types";

export function evaluateRules(ctx: RuleContext, rules: Rule[] = RULES): EvaluatedRule[] {
  return rules.map((rule) => {
    let result;
    try {
      result = rule.evaluate(ctx);
    } catch (err) {
      result = {
        status: "unknown" as const,
        severity: rule.maxSeverity,
        confidence: "low" as const,
        title: `${rule.name}: evaluation failed`,
        explanation: `The rule could not be evaluated (${err instanceof Error ? err.message : "unknown error"}).`,
        evidence: [],
      };
    }
    return { rule: { id: rule.id, name: rule.name, category: rule.category, dedupGroup: rule.dedupGroup, maxSeverity: rule.maxSeverity }, result };
  });
}

export type CategoryScore = {
  category: Category;
  weight: number;
  /** 0-100 risk from known rules in this category; null when no rule could be evaluated. */
  score: number | null;
  /** Rules with a known result divided by rules registered in the category (0 when none are registered). */
  coverage: number;
  rulesRegistered: number;
  rulesEvaluated: number;
  detected: string[];
  unknown: string[];
  /** Why the category contributes nothing, when applicable. */
  unavailableReason: string | null;
};

export type ScoreResult = {
  methodologyVersion: string;
  /** Null when coverage is below the insufficient threshold. */
  overall: number | null;
  level: RiskLevel;
  coverage: number;
  provisional: boolean;
  criticalOverride: boolean;
  categories: CategoryScore[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const UNAVAILABLE: Partial<Record<Category, string>> = {
  liquidity: "No verified liquidity pool or market data source exists for this network.",
};

/**
 * Pure and deterministic. Rules:
 * - A category's score is the sum of points of detected findings (once per dedup group, max points), capped at 100.
 * - Unknown results add no points and do not count toward coverage.
 * - Overall = weighted mean of category scores over categories with coverage > 0.
 *   Categories without coverage are NOT treated as zero risk; they lower `coverage` instead.
 * - coverage = sum(weight * category coverage).
 */
export function computeScore(evaluated: EvaluatedRule[]): ScoreResult {
  const categories: CategoryScore[] = CATEGORIES.map((category) => {
    const inCat = evaluated.filter((e) => e.rule.category === category);
    const registered = RULES.filter((r) => r.category === category).length;
    const known = inCat.filter((e) => e.result.status !== "unknown");
    const groupPoints = new Map<string, number>();
    for (const e of inCat) {
      if (e.result.status !== "detected") continue;
      const pts = SEVERITY_POINTS[e.result.severity] * CONFIDENCE_MULTIPLIER[e.result.confidence];
      const key = e.rule.dedupGroup ?? e.rule.id;
      groupPoints.set(key, Math.max(groupPoints.get(key) ?? 0, pts));
    }
    const total = [...groupPoints.values()].reduce((a, b) => a + b, 0);
    const coverage = registered === 0 ? 0 : known.length / registered;
    return {
      category,
      weight: CATEGORY_WEIGHTS[category],
      score: known.length === 0 ? null : round2(Math.min(100, total)),
      coverage: round2(coverage),
      rulesRegistered: registered,
      rulesEvaluated: known.length,
      detected: inCat.filter((e) => e.result.status === "detected").map((e) => e.rule.id),
      unknown: inCat.filter((e) => e.result.status === "unknown").map((e) => e.rule.id),
      unavailableReason: registered === 0 ? (UNAVAILABLE[category] ?? "No rules registered.") : null,
    };
  });

  const coverage = round2(categories.reduce((a, c) => a + c.weight * c.coverage, 0));
  const scored = categories.filter((c) => c.score !== null);
  const weightSum = scored.reduce((a, c) => a + c.weight, 0);
  const criticalOverride = evaluated.some((e) => e.result.status === "detected" && e.result.severity === "critical" && e.result.confidence !== "low");

  let overall: number | null = null;
  let level: RiskLevel = "insufficient";
  if (coverage >= INSUFFICIENT_BELOW_COVERAGE && weightSum > 0) {
    overall = round2(scored.reduce((a, c) => a + c.weight * (c.score ?? 0), 0) / weightSum);
    level = RISK_LEVELS.find((l) => overall! >= l.min && overall! <= l.max)?.level ?? "critical";
  }
  if (criticalOverride) level = "critical";

  return {
    methodologyVersion: METHODOLOGY_VERSION,
    overall,
    level,
    coverage,
    provisional: coverage < PROVISIONAL_BELOW_COVERAGE,
    criticalOverride,
    categories,
  };
}
