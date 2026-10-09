# Risk Methodology

Version **1.1.1** (1.1.0 added creator and coordination rules; 1.1.1 marks any coverage below 100% as provisional; weights and rule thresholds unchanged from 1.0.0). Source of truth: `src/lib/risk-engine/methodology.ts` and `src/lib/risk-engine/rules/*`. The public page `/methodology` is generated from the same constants. All values are initial product defaults (SRS 8), not externally validated.

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
| Creator/deployer history | 15% | VG-CRT-001…003 |
| Liquidity and market structure | 15% | none (no verified market data source) |
| Suspicious transaction behavior | 15% | VG-SUS-001…002 (coordination only; the rest arrives in phase 4) |
| Data integrity and provenance | 5% | VG-INT-001…003 |

Maximum possible coverage in 1.1.0 is 85% (liquidity is the only unassessed category). Because the maximum is below 100%, every result is currently provisional. If the block explorer is unreachable the creator and funding rules return `unknown` and coverage drops further.

## Calculation

1. Each rule returns `detected | not_detected | unknown` plus severity, confidence and evidence.
2. Category risk = sum of points of detected findings, capped at 100. Points = severity points × confidence multiplier. Findings in the same `dedupGroup` count once (the highest).
   - Severity points: info 0, low 8, medium 20, high 40, critical 70.
   - Confidence multiplier: low 0.5, medium 0.75, high 1.0.
3. Category coverage = rules with a known result ÷ rules registered in the category (0 when none registered).
4. Overall coverage = Σ weight × category coverage.
5. Overall risk = Σ(weight × category risk) ÷ Σ(weight) over categories with coverage > 0. Categories without coverage are not treated as zero risk.
6. Coverage < 100% → provisional. Coverage < 25% → no numeric score (`level: insufficient`).
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
| VG-CRT-001 | New creator wallet | Creator's first observed transaction < 24 h before token creation. Low, medium confidence. Unknown without explorer data. |
| VG-CRT-002 | Repeated token creation | ≥ 3 other **confirmed ERC-20** tokens created by the same sender (low), ≥ 10 (medium). Direct deployments count only if they answer `totalSupply()` and `balanceOf()`; launchpad launches are attributed through an ERC-20 mint in the sender's transaction. Counts are lower bounds. If the history window may hide launches and fewer than 3 were found, the rule is `unknown`, not clear. |
| VG-CRT-003 | Creator sold down position | Sender held ≥ 5% of supply at its peak and now holds ≤ 10% of that peak (low; medium if peak ≥ 20%). Needs only the transfer index. Says tokens left the wallet, not that they were sold. |
| VG-SUS-001 | Funding coordination among top holders | A cluster (see below) with a funding signal. Unknown if funding was readable for < 50% of the examined wallets and no cluster was found. Group `coordination`. |
| VG-SUS-002 | Synchronized acquisition or consolidation | A cluster with a same-minute acquisition or common-recipient signal. Needs only the transfer index. Group `coordination`. |
| VG-INT-001 | Unverified source | Low. Unknown if the explorer is unreachable. |
| VG-INT-002 | Supply reconciliation | Indexed supply vs `totalSupply()`. Medium on mismatch. |
| VG-INT-003 | Balance reconciliation | Top 20 balances vs `balanceOf()`. Medium on mismatch. |

Each rule declares its required data, evidence kinds and false-positive notes (see registry; tested in `tests/unit/risk-engine.test.ts`).

## Coordination heuristics (VG-SUS-*)

Examined set: the 30 largest non-contract, non-burn holders. Signals, grouped into independent **families**:

| Family | Signal | Rule |
|---|---|---|
| funding | Shared funder | ≥ 2 wallets whose first incoming native transfer came from the same address. A funder that is a contract, or has ≥ 1000 transactions, is a *hub* (faucet, bridge, exchange) and is **not** evidence. |
| funding | Funding time correlation | Within one shared-funder group, all funding transfers within 10 minutes. |
| funding | Funding amount similarity | Within one shared-funder group, smaller/larger amount ≥ 0.75. |
| acquisition | Coordinated acquisition | 3 to 10 wallets whose first receipt of the token falls in one 60-second window. Groups of more than 10 are ignored as launch-wide activity. |
| consolidation | Token consolidation | ≥ 2 examined wallets sent tokens to the same non-contract wallet. |

Wallets joined by any qualifying group form one cluster (connected components). Confidence points: 2 per independent family, +1 for timing and +1 for amount similarity; ≥ 6 high, ≥ 4 medium, else low. Labels: "High Behavioral Similarity" (high) or "Possible Coordination". Rule severity: cluster combined share < 10% of supply is shown but not scored; low-confidence clusters are at most low; medium/high confidence is medium, or high from 25% of supply. Never critical. Every signal ships with an alternative explanation. Clusters have deterministic IDs (hash of sorted members).

## Known limitations

- Selector matching shows a function exists, not who may call it. Confidence is medium unless a verified ABI confirms it.
- Proxy detection: EIP-1167, EIP-1967 implementation/beacon slots only.
- Only the 50 largest holders are classified (contract vs wallet via `eth_getCode`; EIP-7702 delegations count as wallets). If fewer than 20 non-excluded holders are found, shares are marked lower bounds.
- Contracts holding supply cannot yet be identified as pools/curves/vaults; they are excluded from concentration and listed.
- No liquidity analysis. Suspicious-activity coverage is the two coordination rules only.
- Creator and funding facts come from the Blockscout explorer (not the chain): the latest 100 and earliest 50 transactions are read, counters can lag (observed 0 for an address with 40 transactions; reconciled against the listed transactions), and a failure makes the rule `unknown`.
- Wallets funded through exchanges or bridges cannot be linked; unrelated wallets acting in the same minute can look coordinated.
- Holder history excludes contracts/burn as classified at the analysis block (top 50 only), so earlier points are approximate.
- Rebasing/fee-on-transfer tokens fail reconciliation and are flagged.

## Calibration

Thresholds and weights are unvalidated. Live results (4 launchpad tokens scanned in phase 3: VIBE COOK, VibeVibe/VIBES, Tim Cook…/TCEYACR, plus the phase 2 tokens) show plain ERC-20s scoring about 0–7 with 80–85% coverage. VIBE COOK scores 5.8–6.8 because its creator sold from a 59% peak to 0.07% and one 3-wallet cluster (13.2% of supply) shares a funder. A false-positive review with a larger sample is required before changing any value; every change must bump the version.
