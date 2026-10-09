# Risk Methodology

Version **1.0.0**. Source of truth: `src/lib/risk-engine/methodology.ts` and `src/lib/risk-engine/rules/*`. The public page `/methodology` is generated from the same constants. All values are initial product defaults (SRS 8), not externally validated.

## Principles

- Score 0–100; higher means more detected risk. Not a quality rating, not a safety guarantee, not an audit.
- Deterministic: same inputs at the same block give the same output. The engine takes no clock or randomness.
- Unknown is never safe. A rule that cannot run returns `unknown`: it adds no risk and does not count toward coverage.
- Coverage is separate from risk. The same evidence is not counted twice (overlap groups).

## Levels (SRS 8.2)

0–19 Low observed risk · 20–39 Moderate · 40–59 Elevated · 60–79 High · 80–100 Critical.

## Categories and weights (SRS 8.3)

| Category | Weight | Rules in 1.0.0 |
|---|---|---|
| Contract permissions and behavior | 30% | VG-CFG-001…008 |
| Holder concentration | 20% | VG-HLD-001…004 |
| Creator/deployer history | 15% | none (not assessed) |
| Liquidity and market structure | 15% | none (no verified market data source) |
| Suspicious transaction behavior | 15% | none (phase 4) |
| Data integrity and provenance | 5% | VG-INT-001…003 |

Maximum possible coverage in 1.0.0 is therefore 55%, so every result is currently **provisional**.

## Calculation

1. Each rule returns `detected | not_detected | unknown` plus severity, confidence and evidence.
2. Category risk = sum of points of detected findings, capped at 100. Points = severity points × confidence multiplier. Findings in the same `dedupGroup` count once (the highest).
   - Severity points: info 0, low 8, medium 20, high 40, critical 70.
   - Confidence multiplier: low 0.5, medium 0.75, high 1.0.
3. Category coverage = rules with a known result ÷ rules registered in the category (0 when none registered).
4. Overall coverage = Σ weight × category coverage.
5. Overall risk = Σ(weight × category risk) ÷ Σ(weight) over categories with coverage > 0. Categories without coverage are not treated as zero risk.
6. Coverage < 80% → provisional. Coverage < 25% → no numeric score (`level: insufficient`).
7. Any detected `critical` finding with medium/high confidence sets the level to `critical` (flag `criticalOverride`) regardless of the aggregate.

## Rules

| ID | Rule | Notes |
|---|---|---|
| VG-CFG-001 | Active owner | `owner()` non-zero. Low. |
| VG-CFG-002 | Mint capability | Selectors/ABI. Medium; low if ownership renounced and no roles. |
| VG-CFG-003 | Pause capability | Medium; low if renounced. |
| VG-CFG-004 | Blacklist/whitelist controls | High; group `transfer-restriction`. |
| VG-CFG-005 | Fee/tax controls | High. |
| VG-CFG-006 | Trading/limit controls | Medium; group `transfer-restriction`. |
| VG-CFG-007 | Upgradeable proxy | EIP-1967 / beacon: high. EIP-1167 clone: not upgradeable. |
| VG-CFG-008 | Role-based administration | Info; context. |
| VG-HLD-001 | Top holder concentration | Top non-contract, non-burn holder: ≥15% medium, ≥30% high, ≥50% critical. Group `holder-concentration`. |
| VG-HLD-002 | Top 10 concentration | ≥50% medium, ≥75% high, ≥90% critical. Same group. |
| VG-HLD-003 | Creator holdings | Creation tx sender: ≥15% / 30% / 50%. |
| VG-HLD-004 | Supply held by contracts | Info only (≥50% flagged). Excluded from concentration, always shown. |
| VG-INT-001 | Unverified source | Low. Unknown if the explorer is unreachable. |
| VG-INT-002 | Supply reconciliation | Indexed supply vs `totalSupply()`. Medium on mismatch. |
| VG-INT-003 | Balance reconciliation | Top 20 balances vs `balanceOf()`. Medium on mismatch. |

Each rule declares its required data, evidence kinds and false-positive notes (see registry; tested in `tests/unit/risk-engine.test.ts`).

## Known limitations

- Selector matching shows a function exists, not who may call it. Confidence is medium unless a verified ABI confirms it.
- Proxy detection: EIP-1167, EIP-1967 implementation/beacon slots only.
- Only the 50 largest holders are classified (contract vs wallet via `eth_getCode`; EIP-7702 delegations count as wallets). If fewer than 20 non-excluded holders are found, shares are marked lower bounds.
- Contracts holding supply cannot yet be identified as pools/curves/vaults; they are excluded from concentration and listed.
- No liquidity, creator-history or suspicious-activity analysis yet.
- Rebasing/fee-on-transfer tokens fail reconciliation and are flagged.

## Calibration

Thresholds and weights are unvalidated. Live results so far (3 launchpad tokens) show plain ERC-20s scoring ~0–1 with 55% coverage. A false-positive review with a larger sample is required before changing any value; every change must bump the version.
