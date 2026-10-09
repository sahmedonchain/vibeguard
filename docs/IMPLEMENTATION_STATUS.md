# Implementation Status

Updated 2026-10-10.

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

### Partial / not done in phase 2
- [ ] Creator, liquidity, suspicious-activity categories: no rules (reported as "not assessed"; max coverage 55%, all results provisional)
- [ ] Holder classification: top 50 holders only; contracts not identified as pool/curve/vault
- [ ] No automatic token discovery (owner decision); factory env var unused
- [ ] Integration tests are not in CI (they hit live RPC/DB); CI runs typecheck, lint, unit, build, e2e (API tests skip without DB)
- [ ] Rate limiter fails open if the DB is down
- [ ] Worker not deployed anywhere; scans stay queued without one
- [ ] Data retention is documented but not automated
- [ ] Methodology weights/thresholds uncalibrated (3 tokens scanned)

## Phase 3: Holders, creator, wallet DNA, sybil (SRS 4+5) - NOT STARTED
## Phase 4: Whales, momentum, suspicious activity, alerts, AI report (SRS 6+7) - NOT STARTED
## Phase 5: Token Doctor, trust status, ecosystem, developer API (SRS 8+9) - NOT STARTED
## Phase 6: Security, QA, deploy (SRS 10) - NOT STARTED
