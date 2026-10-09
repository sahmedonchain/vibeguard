# API (v1, phase 3 subset)

Base path `/api/v1`. JSON only. Same-origin by default (no CORS headers are sent). Responses are `Cache-Control: no-store`. Every response carries `x-request-id`; rate-limited routes carry `x-ratelimit-limit|remaining|reset`.

Success: `{ "data": …, "meta": { "requestId": "…" } }`. Error: `{ "error": { "code", "message", "requestId", "retryAfterSeconds?" } }`.

| Code | HTTP | Meaning |
|---|---|---|
| INVALID_ADDRESS | 400 | Malformed address, body, unknown field, or oversized body (max 2 KB) |
| UNSUPPORTED_NETWORK | 400 | `chainId` is not the configured chain |
| UNSUPPORTED_CONTRACT | 422 | No code at the address, or not an ERC-20 |
| DATA_UNAVAILABLE | 404 | No scan exists |
| INSUFFICIENT_DATA | 422 | Reserved |
| RATE_LIMITED | 429 | See `Retry-After` |
| SCAN_IN_PROGRESS | 409 | A scan is queued/running (`scanId` in the error) |
| SCAN_FAILED | 502 | The last scan failed |
| PROVIDER_UNAVAILABLE | 503 | RPC/DB unavailable |
| INTERNAL_ERROR | 500 | Unexpected; no details exposed |

## POST /api/v1/scans

Body `{ "address": "0x…", "chainId"?: 46630 }`. Rate limit 10/min per client. Returns `202` with the scan (`meta.disposition`: `created` or `active`), or `200` with a completed/unsupported scan finished in the last 120 s (`recent`). Partial scans are always re-run. Scans execute in the worker; poll the scan.

## GET /api/v1/scans/{id}

The scan report: `status` (`queued|running|completed|partial|failed|unsupported`), token, analysis block/time, methodology version, score (`overall`, `level`, `coverage`, `provisional`, `criticalOverride`, categories), findings with evidence, holder analysis, indexing status, error. Rate limit 120/min.

## GET /api/v1/tokens/{address}/risk

Latest completed/partial scan for the token; `meta.stale` is true when older than 1 hour. `404 DATA_UNAVAILABLE` if none, `409 SCAN_IN_PROGRESS` if only an active scan exists.

## GET /api/v1/health

Readiness: `{ status, checks: { database, rpc }, chainId }`. `503` when degraded. Not rate limited.

Full developer documentation (OpenAPI, keys, quotas) is phase 5.

## Rate limits and failure behavior

| Limit | Applies to | Max | Window | If the limiter store is down |
|---|---|---|---|---|
| `create-scan` | POST /scans | 10 | 60 s | **fail closed** (503 `PROVIDER_UNAVAILABLE`) |
| `analyze` | GET /wallets/*, GET /creators/* (and the /wallet and /creator pages) | 20 | 60 s | **fail closed**: a cache miss calls the explorer, so it must stay bounded |
| `read` | all other GETs | 120 | 60 s | fail open (the request is allowed, an error is logged) |

## Token slices (from the latest completed/partial scan)

All three return the same errors as `/risk` (`DATA_UNAVAILABLE`, `SCAN_IN_PROGRESS`, `SCAN_FAILED`, `UNSUPPORTED_CONTRACT`) and carry `scanId`, `status`, `methodologyVersion`, `analysis` (block, hash, time, latest indexed block), `finishedAt`; `meta.stale` is true after 1 hour.

- `GET /api/v1/tokens/{address}/holders` — `holders` (count, top 1/5/10/20 wallet shares in basis points of total supply, creator share, `exclusions` for burn and contracts, `topHolders` with `class` and optional `label`), `history` (sampled concentration points with block/time, `changes` of the largest holders over the last quarter, `approximate: true`), `indexing`.
- `GET /api/v1/tokens/{address}/creator` — `creator` (creation tx sender), `immediateCreator` (deploying contract), `analysis` (facts: tx count, first seen, first incoming funds, other creations with `kind` token/contract/unchecked, search scope and `possiblyIncomplete`, `ageAtCreationSeconds`, `sellDown`; `explorerAvailable=false` means unknown, not empty), `findings` (VG-CRT-*, VG-HLD-003).
- `GET /api/v1/tokens/{address}/relationships` — `sybil` (`candidates`, `fundingResolved`, `budgetExceeded`, `clusters` with `id`, `label` ("Possible Coordination" | "High Behavioral Similarity"), `confidence`, `members`, `combinedBps`, `signals` (each with an `alternative` explanation), `edges`, `evidence`, `firstObserved`/`lastObserved`, `scored`), `findings` (VG-SUS-*). `sybil` is null for scans older than methodology 1.1.0 or with an incomplete index.

## Profiles (explorer-backed, cached 10 minutes)

- `GET /api/v1/creators/{address}` — `facts` (as above, for any address), `funder`, `knownTokens` (tokens whose creation sender is this address and that VibeGuard has recorded, with their latest scan level), `inferences` (each with `basis`, `alternatives`, `confidence`), `assessment` (`insufficient_data` | `no_signals_observed` | `signals_observed`, `signals`, `note`). No field labels an address a scammer.
- `GET /api/v1/wallets/{address}` — Wallet DNA: `balanceWei`, `counters`, `firstSeen`, `lastActive`, `funding`, `sample` (what the activity figures are computed from: transaction count, date range, `complete`), `flows`, `counterparties`, `tokens`, `deployments`, `largeTransfers`, `timing`. `explorerAvailable=false` means no history was obtainable.
- `GET /api/v1/wallets/{address}/relationships` — `graph` of observed transfers (`nodes` with kind subject/wallet/contract/funder; `edges` with kind sent/received/funding and weight = transaction count). Edges are transactions, not ownership.
