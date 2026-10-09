# Implementation Status

Updated 2026-10-10 (phase 3).

## Phase 1: Discovery + Foundation (SRS 0+1) - DONE (committed 339bf95)
- [x] Chain discovery, ARCHITECTURE, status docs
- [x] Next.js/TS strict/Tailwind/Lucide/Recharts/Drizzle/Vitest/Playwright, pinned
- [x] Chain adapter, design system, shared components, landing, all routes, CI, README
- [x] Audit vs SRS 5, 6, 25, 33, 35 done in phase 2 (see below)

## Phase 2: Chain data pipeline + token scanner (SRS 2+3) - DONE
- [x] Schema + migrations (applied to Neon): networks, tokens, contracts, contract_permissions, token_transfers, indexed_blocks, indexer_checkpoints, indexer_errors, scans, risk_scores, risk_findings, evidence_records, methodology_versions, rate_limit_counters
- [x] Indexer: checkpoints, idempotent inserts, bounded retry/backoff, adaptive getLogs ranges, reorg rewind, configurable start/confirmations, time budget; token discovery = user-submitted addresses
- [x] Contract analysis: code, ERC-20 interface, owner, mint/pause/blacklist/whitelist/fee/trading/limit/role/upgrade selectors, EIP-1167 and EIP-1967/beacon proxies, optional verified ABI
- [x] Risk engine: rule registry (15 rules), weighted score, coverage separate, unknown != safe, overlap groups, critical override, methodology version
- [x] API: POST /api/v1/scans, GET /api/v1/scans/{id}, GET /api/v1/tokens/{address}/risk, GET /api/v1/health; zod, rate limit, SRS 29 error codes
- [x] Pages: /scan, /token/[address] (score, categories, findings + evidence, holders chart/table, scan states), /methodology
- [x] Worker (`pnpm worker`) and CLI (`pnpm scan`)
- [x] docs: RISK_METHODOLOGY, DATA_MODEL, API, CHAIN_DISCOVERY updates
- [x] Tests: 76 unit, 11 integration (live RPC + Postgres), 29 e2e
- [x] Real testnet tokens scanned end to end (see report)

### Phase 1 audit fixes (SRS 5, 6, 25, 33)
- [x] 6.1 headline, "Scan a Token"/"Explore Ecosystem" actions, hero search forwards to scanner
- [x] 6.2 sections: tools, how it works, labelled example report, methodology summary, developer intro, limitations; no live metrics section (no real data worth showing)
- [x] 6.3 SEO/OG/Twitter metadata, metadataBase from APP_URL
- [x] 3.3 active network shown in header
- [x] 5.2 added tooltip, tx/block links, skeleton, evidence card, chart container, share control, address kind label
- [x] 8.2 risk bands aligned to SRS (0-19/20-39/40-59/60-79/80-100)
- [x] 33 env var names (`VIBEVIBE_*`, `APP_URL`, `APP_ENV`, `RATE_LIMIT_SECRET`); chain config is server-only
- [ ] 5.2 network selector (single network), pagination/virtualized lists (no long lists yet), wallet/creator "unavailable" states exist as coming-soon only

### Partial / not done in phase 2 (status after phase 3)
- [x] Creator category: rules VG-CRT-001…003 (phase 3). Suspicious category: coordination rules VG-SUS-001…002 only (phase 3); the remaining SRS 15.2 rules are phase 4. Liquidity: still no rules (no verified market data). Max coverage is now 85%. Methodology 1.1.1: any coverage below 100% is provisional, so every result is currently provisional.
- [ ] Holder classification: top 50 holders only; contracts labelled only when they are the token or its creating contract; pools/curves/vaults cannot be identified
- [ ] No automatic token discovery (owner decision); factory env var unused
- [ ] Integration tests are not in CI (they hit live RPC/DB); CI runs typecheck, lint, unit, build, e2e (API tests skip without DB)
- [x] Rate limiter: fails closed for scan creation and explorer-backed analysis, open for plain reads (phase 3)
- [ ] Worker not deployed anywhere; scans stay queued without one
- [ ] Data retention is documented but not automated
- [ ] Methodology weights/thresholds uncalibrated (owner decision: calibrate after phase 3, now with 4 scanned tokens; see RISK_METHODOLOGY.md)

## Phase 3: Holders, creator, wallet DNA, sybil (SRS 9-12) - DONE
- [x] SRS 10 holder quality: top 1/5/10/20 wallet shares, creator share, burn and contract exclusions always shown, contract labels from facts, concentration over time (8 sampled blocks), large holder changes (last quarter), reconciliation (phase 2), `/api/v1/tokens/{a}/holders`
- [x] SRS 9 creator reputation: `/creator/[address]` and `/api/v1/creators/{a}`: facts (first seen, funding, direct deployments, ERC-20 launches through the known creation path, tx count) separated from inferences (with basis and alternatives); no scammer labels
- [x] SRS 11 wallet DNA: `/wallet/[address]`, `/api/v1/wallets/{a}`, `/relationships`: activity sample, flows, counterparties, token interactions, timing, large transfers, deployments, observed patterns, SVG relationship graph, explicit sample limits
- [x] SRS 12 sybil: `/sybil?token=`, `/api/v1/tokens/{a}/relationships`: shared funder, funding time/amount, same-minute acquisition, token consolidation; clusters with confidence, evidence links, alternatives; labels only "Possible Coordination" / "High Behavioral Similarity"
- [x] Risk engine 1.1.0: VG-CRT-001…003, VG-SUS-001…002 (see RISK_METHODOLOGY.md); creator/sybil/holder-history stored in scan context
- [x] Migration 0002 (additive): `analysis_cache`, `tokens.creation_to/creation_selector`; applied to Neon
- [x] Tests: 158 unit (was 76), 19 integration (live RPC + explorer + Postgres), 34 e2e
- [x] Real testnet tokens re-scanned: VIBE COOK, VIBES, TCEYACR (see report)
### Phase 3 limitations
- [ ] Creator/funding data comes from the Blockscout explorer, bounded to the latest 100 + earliest 50 transactions; launches outside that window are not found (rule returns unknown rather than clear)
- [ ] Wallet DNA activity is a sample (latest 150 + earliest 50 transactions, latest 100 token transfers), not full history; there is no wallet-level risk score
- [ ] Holder history is sampled at 8 blocks and uses the final top-50 classification; "known liquidity pool" balances cannot be identified
- [ ] Coordination only examines the 30 largest non-contract holders; cannot see exchange/bridge-funded links; heuristics uncalibrated
- [ ] Creator assessment does not yet include per-token creator findings (e.g. VG-CRT-003 on past tokens)
- [ ] Explorer-backed profiles are computed inside the web request (cached 10 min); no background refresh
## Phase 4: Whales, momentum, suspicious activity, alerts, AI report (SRS 6+7) - NOT STARTED
## Phase 5: Token Doctor, trust status, ecosystem, developer API (SRS 8+9) - NOT STARTED
## Phase 6: Security, QA, deploy (SRS 10) - NOT STARTED
