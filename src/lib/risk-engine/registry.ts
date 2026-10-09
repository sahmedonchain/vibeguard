import { contractRules } from "./rules/contract";
import { coordinationRules } from "./rules/coordination";
import { creatorRules } from "./rules/creator";
import { holderRules } from "./rules/holders";
import { integrityRules } from "./rules/integrity";
import type { Category, Rule } from "./types";

/** All rules, sorted by ID so evaluation order (and therefore output) is deterministic. */
export const RULES: Rule[] = [...contractRules, ...holderRules, ...creatorRules, ...coordinationRules, ...integrityRules].sort((a, b) => a.id.localeCompare(b.id));

export function rulesByCategory(category: Category): Rule[] {
  return RULES.filter((r) => r.category === category);
}

const ids = new Set<string>();
for (const r of RULES) {
  if (ids.has(r.id)) throw new Error(`Duplicate rule id ${r.id}`);
  ids.add(r.id);
}
