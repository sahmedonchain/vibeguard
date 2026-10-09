# Data Model

PostgreSQL via Drizzle ORM. Schema: `src/db/schema.ts`. Migrations: `drizzle/` (additive; apply with `pnpm db:migrate`).

## Conventions

- Every chain record carries `chain_id`. Addresses are stored lowercase (`varchar(42)`), hashes `varchar(66)`.
- uint256 values are `numeric(78,0)`, read as strings and converted to `bigint`; never floats.
- Block numbers are `bigint` in number mode (safe below 2^53). Timestamps are `timestamptz`.
- Duplicate events are impossible: `token_transfers` is unique on `(chain_id, tx_hash, log_index)`; inserts use `ON CONFLICT DO NOTHING`.
- Scan status is enforced by a CHECK constraint. At most one active (queued/running) scan per token is enforced by a partial unique index.
- No private keys, API secrets or personal data are stored. Client IPs are never stored; the rate limiter keys on an HMAC.

## Tables

| Table | Purpose |
|---|---|
| `networks` | Chain ID, name, explorer URL. |
| `tokens` | Submitted tokens: metadata, supply, creation block/tx/sender, discovery source (`user_submitted`), creation sender and the creation path (`creation_to`, `creation_selector`: the launchpad contract and method, used to recognise the same sender's other launches). Unique `(chain_id, address)`. |
| `contracts` | Per-address code facts and the latest analysis JSON. |
| `contract_permissions` | Capabilities detected per scan: capability, signature, selector, via (`abi` or `bytecode_selector`), confidence. |
| `token_transfers` | Decoded ERC-20 Transfer events. |
| `indexed_blocks` | Hash/parent/time of chunk-end blocks; used for reorg detection. |
| `indexer_checkpoints` | Last indexed block + hash per stream (`token_transfers:<address>`). Updated in the same transaction as the rows. |
| `indexer_errors` | Indexer failures (message truncated, no payloads). |
| `scans` | Scan lifecycle, pinned analysis block (number, hash, time), methodology version, error code, context JSON (token, holders, contract analysis, reconciliation). |
| `risk_scores` | One per scan: overall (nullable), level, coverage, provisional, critical override, per-category breakdown. |
| `risk_findings` | One row per rule per scan, including `not_detected` and `unknown`. Unique `(scan_id, rule_id)`. |
| `evidence_records` | Evidence per finding: kind, label, address, tx, block, small JSON. |
| `methodology_versions` | Weights, thresholds, severity points and rule list for each version. Inserted on first use. |
| `analysis_cache` | Short-lived (10 min) cache of explorer-derived wallet and creator profiles, keyed `(chain_id, kind, address)`. A payload that reports the explorer unavailable is never stored. |
| `rate_limit_counters` | Fixed-window counters keyed by `name:hmac(ip)`; old rows are pruned opportunistically. |

## Deviations from SRS 22

- `indexed_logs`, `wallets`, `token_holders`, `wallet_relationships`, `liquidity_pools`, `alert_subscriptions`, `processed_events`, `notification_deliveries`, `api_*`: not created yet; they belong to later phases. Holder balances are derived on demand from `token_transfers`.
- `risk_rules`: the rule registry lives in code (`src/lib/risk-engine/registry.ts`); the rule list is snapshotted in `methodology_versions.rules`.
- Phase 3 did **not** add `wallets`, `token_holders` or `wallet_relationships`: holder history, creator facts and coordination clusters are computed per scan and stored in `scans.context` (JSON), and wallet/creator profiles are cached in `analysis_cache`. Reason: they are derived views of an analysis block, never queried across tokens yet. Add tables when the ecosystem view (phase 5) needs cross-token queries.

## Retention (proposed, not enforced yet)

- `token_transfers`, `indexed_blocks`: kept while the token is tracked.
- `scans` and children: kept; superseded scans may be pruned after 90 days in a later phase.
- `rate_limit_counters`: pruned after 1 hour.
- `indexer_errors`: prune after 30 days (not automated yet).
