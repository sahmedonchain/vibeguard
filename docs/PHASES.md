# VibeGuard — Claude Code ফেজ প্রম্পট (দ্রুত সংস্করণ)

SRS-এর ১১টি ফেজকে ৬টিতে একত্র করা হয়েছে। প্রতিটি ফেজ শেষে Claude Code-এর রিপোর্ট দেখে, build/test পাস হলে পরের প্রম্পট দাও।

## শুরুর আগে (একবার)
```bash
mkdir vibeguard && cd vibeguard && git init
mkdir docs
# পুরো SRS টেক্সট ফাইলটা docs/MASTER_SRS.md নামে রাখো
claude
```

---

## ফেজ ১ — Discovery + Foundation (SRS Phase 0+1)
```
Read docs/MASTER_SRS.md fully. It is the source of truth.

PHASE 1 (= SRS Phase 0 + Phase 1). Work fast but verify everything.

A) Chain discovery:
- VibeVibe testnet (https://testnet.vibevibe.fun/) reportedly runs on Robinhood Chain Testnet. Verify this from official docs via web search: chain ID, HTTP/WS RPC, explorer URL + address/tx URL formats, native currency, EVM compatibility, eth_getLogs block-range limits, rate limits, and any VibeVibe token factory/launchpad contract.
- Never invent values. Anything unverified → configurable env var + listed as unresolved.
- Write docs/CHAIN_DISCOVERY.md, docs/ARCHITECTURE.md, docs/IMPLEMENTATION_STATUS.md (checklist for all 6 phases).

B) Foundation:
- Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui + Lucide + Recharts. Drizzle ORM + PostgreSQL. Vitest + Playwright. Pin stable versions.
- src/lib/chain/ adapter (config, client, capabilities, explorer) using Viem only if EVM confirmed.
- Dark-first design system, header/footer, responsive nav, shared components (address display+copy, risk score, severity badge, data freshness label, loading/empty/error/unsupported states).
- Landing page per SRS section 6 (no fake metrics). Create all public routes from SRS 5.1 with honest "coming in phase X" unavailable state — no dead links.
- .env.example (placeholders only), README, GitHub Actions CI (typecheck, lint, test, build).
- NO login, NO user dashboard, NO admin panel.

Exit: tsc, lint, tests, `next build` all pass. Report per SRS section 35 and update IMPLEMENTATION_STATUS.md.
```

## ফেজ ২ — Chain Data Pipeline + Token Scanner (SRS Phase 2+3) ⭐ প্রথম working milestone
```
PHASE 2 (= SRS Phase 2 + 3). Goal: the smallest complete end-to-end slice — a real VibeVibe token address in → evidence-backed risk report out.

- DB schema + migrations: networks, tokens, contracts, contract_permissions, token_transfers, indexed_blocks, indexer_checkpoints, scans, risk_scores, risk_findings, evidence_records, methodology_versions. Big ints as numeric/string, chain_id on every chain record, unique constraints.
- Indexer in /worker (separate process, not serverless): checkpoints, idempotent, bounded retry/backoff, respects getLogs range limits, reorg handling, configurable start block, token discovery (factory events if verified, else user-submitted addresses).
- Contract analysis: code exists, ERC-20 interface, owner/roles, mint, pause, blacklist, proxy/upgradeability, fee controls (bytecode selectors + verified source if explorer exposes it).
- Risk engine (src/lib/risk-engine): rule registry (ID, severity, evidence schema, tests), weighted score per SRS 8.3, coverage separate from risk, unknown ≠ safe, deterministic, methodology version.
- POST /api/v1/scans, GET /api/v1/scans/{id}, GET /api/v1/tokens/{address}/risk with zod validation + rate limit + standard error codes (SRS 29).
- /scan and /token/[address] pages: score, category breakdown, findings with evidence + explorer links, coverage, scan block/time, scan states (queued/running/completed/partial/failed/unsupported).
- /methodology page + docs/RISK_METHODOLOGY.md, docs/DATA_MODEL.md.
- Unit tests with deterministic fixtures; one integration test against the real testnet RPC.

Exit: scan a REAL testnet token end-to-end and show me the result. All checks + build pass. Report + update status.
```

## ফেজ ৩ — Holders, Creator, Wallet DNA, Sybil (SRS Phase 4+5)
```
PHASE 3 (= SRS Phase 4 + 5).
- Holder balances from transfers (mint/burn/decimals), reconcile with balanceOf; top 1/5/10/20 share, creator share; classify EOA / contract / pool / burn / creator / unclassified — exclusions shown, never silent.
- Creator reputation (/creator/[address]): deployer detection, deployment history, funding source, first-seen, facts vs inferences separated.
- Wallet DNA (/wallet/[address]): activity timeline, in/out flows, counterparties, relationship graph.
- Sybil (/sybil): shared funder, funding amount/time correlation, repeated interaction patterns, confidence + alternative explanations. Labels only "Possible Coordination" / "High Behavioral Similarity" — no identity claims.
- Feed results into risk engine categories (holder concentration, creator history). API endpoints: holders, creator, wallets, relationships.
- Unit tests for every heuristic and balance calculation.
Exit: all checks + build pass, tested on real testnet tokens. Report + update status.
```

## ফেজ ৪ — Whales, Momentum, Suspicious Activity, Alerts, AI Report (SRS Phase 6+7)
```
PHASE 4 (= SRS Phase 6 + 7).
- /whales: large transfers, holder balance changes, configurable thresholds, transfer ≠ trade, dedup, block+time shown.
- /momentum: only from verified data (tx count, unique wallets, holder growth; volume/liquidity only if a verified DEX pool exists, else "insufficient market data"). Show baseline + time window.
- Suspicious activity rules (SRS 15.2) in the rule engine with tests; findings feed.
- /alerts: browser Notification API (user-initiated permission), polling or WS if verified, dedup. Optional Web Push only if keys configured.
- AI report adapter (server-side, env-configured): input = structured findings only, zod-validated output, prompt-injection safe (token metadata untrusted), deterministic rule-based fallback when no AI key.
Exit: everything works without AI key. All checks + build pass. Report + update status.
```

## ফেজ ৫ — Token Doctor, Trust Status, Ecosystem, Developer API (SRS Phase 8+9)
```
PHASE 5 (= SRS Phase 8 + 9).
- /doctor: Mode A deployed contract checks; Mode B pasted Solidity source/bytecode static analysis (sandboxed, size-limited, never executed/deployed). Findings, remediation, "automated scan is not an audit" notice.
- Trust statuses (SRS 19) only with documented criteria, dates, expiry, link to report. No green badge just for "no issues".
- /ecosystem: real indexed aggregates only, filters, server pagination, freshness, new-testnet empty states.
- Finalize /api/v1/* (SRS 21.2): versioning, pagination, request IDs, cache headers, freshness fields, rate limits, optional hashed API keys. OpenAPI spec + /developers and /developers/api docs matching the real implementation.
- /about, /privacy, /terms, /status pages.
Exit: every documented endpoint tested. All checks + build pass. Report + update status.
```

## ফেজ ৬ — Security, QA, Deploy (SRS Phase 10)
```
PHASE 6 (= SRS Phase 10).
- Full unit + integration + Playwright e2e (SRS 28.3) and security tests (SRS 28.4).
- Security review: input validation, rate limits, no secrets in client bundle (grep build output), safe metadata rendering, npm audit, secret scanning in CI.
- docs/SECURITY.md, docs/DEPLOYMENT.md, docs/RUNBOOK.md.
- Give me exact step-by-step deploy instructions: GitHub push, Vercel (frontend + API), managed Postgres (e.g. Neon), worker host (e.g. Railway/Render/Fly), env vars list, migrations.
- After I deploy, run smoke tests against the live URL.
Exit: SRS section 37 Definition of Done checklist — mark each item done or list what's missing.
```

---
**নিয়ম:** প্রতিটা ফেজ শেষে Claude Code যদি বলে কোনো কিছু "partial" বা "unverified", সেটা ঠিক না করে পরের ফেজে যেও না। Context বড় হয়ে গেলে নতুন ফেজের আগে `/clear` দিয়ে প্রম্পটের শুরুতে "Read docs/MASTER_SRS.md and docs/IMPLEMENTATION_STATUS.md first." লিখে দিও।
