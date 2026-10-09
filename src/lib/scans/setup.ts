import type { Db } from "@/db/client";
import { methodologyVersions, networks } from "@/db/schema";
import type { ChainConfig } from "@/lib/chain/config";
import { RULES } from "@/lib/risk-engine/registry";
import {
  CATEGORY_WEIGHTS,
  HOLDER_THRESHOLDS,
  INSUFFICIENT_BELOW_COVERAGE,
  METHODOLOGY_DESCRIPTION,
  METHODOLOGY_VERSION,
  PROVISIONAL_BELOW_COVERAGE,
  RISK_LEVELS,
  SEVERITY_POINTS,
} from "@/lib/risk-engine/methodology";

/** Inserts the network and current methodology rows if absent. Safe to call repeatedly. */
export async function ensureReferenceData(db: Db, cfg: ChainConfig): Promise<void> {
  await db.insert(networks).values({ chainId: cfg.chainId, name: cfg.name, explorerUrl: cfg.explorerUrl }).onConflictDoNothing();
  await db
    .insert(methodologyVersions)
    .values({
      version: METHODOLOGY_VERSION,
      description: METHODOLOGY_DESCRIPTION,
      weights: CATEGORY_WEIGHTS,
      thresholds: { levels: RISK_LEVELS, holder: HOLDER_THRESHOLDS, provisionalBelowCoverage: PROVISIONAL_BELOW_COVERAGE, insufficientBelowCoverage: INSUFFICIENT_BELOW_COVERAGE },
      severityPoints: SEVERITY_POINTS,
      rules: RULES.map((r) => ({ id: r.id, name: r.name, category: r.category, maxSeverity: r.maxSeverity })),
    })
    .onConflictDoNothing();
}
