# API (v1, phase 2 subset)

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
