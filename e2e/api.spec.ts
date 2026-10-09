import { expect, test } from "@playwright/test";

const ADDR = "0x3c1b3e4383f3Fa90b314dD451332c86b1C779725";

/** API contract tests. They need DATABASE_URL (rate limiter + queue), so they skip when the deployment reports no database. */
test.beforeAll(async ({ request }) => {
  const h = await (await request.get("/api/v1/health")).json();
  test.skip(h.checks.database !== "ok", "database not available");
});

type Err = { error: { code: string; message: string; requestId: string } };

test("health reports readiness without leaking internals", async ({ request }) => {
  const res = await request.get("/api/v1/health");
  const body = await res.json();
  expect(body).toMatchObject({ checks: { database: "ok", rpc: "ok" }, chainId: 46630 });
  expect(JSON.stringify(body)).not.toMatch(/postgres|neon|password/i);
});

test("POST /scans rejects malformed input with standard errors", async ({ request }) => {
  for (const body of [{ address: "0x123" }, { address: "<script>" }, { address: ADDR, extra: 1 }, {}, { address: 5 }]) {
    const res = await request.post("/api/v1/scans", { data: body });
    expect(res.status()).toBe(400);
    const j = (await res.json()) as Err;
    expect(j.error.code).toBe("INVALID_ADDRESS");
    expect(j.error.requestId).toBe(res.headers()["x-request-id"]);
  }
});

test("POST /scans rejects other networks and oversized bodies", async ({ request }) => {
  const wrong = await request.post("/api/v1/scans", { data: { address: ADDR, chainId: 1 } });
  expect(wrong.status()).toBe(400);
  expect(((await wrong.json()) as Err).error.code).toBe("UNSUPPORTED_NETWORK");
  const big = await request.post("/api/v1/scans", { data: { address: "a".repeat(10_000) } });
  expect(big.status()).toBe(400);
});

test("GET endpoints validate identifiers and return DATA_UNAVAILABLE", async ({ request }) => {
  const bad = await request.get("/api/v1/scans/not-a-uuid");
  expect(bad.status()).toBe(404);
  expect(((await bad.json()) as Err).error.code).toBe("DATA_UNAVAILABLE");
  const badAddr = await request.get("/api/v1/tokens/0xnope/risk");
  expect(badAddr.status()).toBe(400);
  const none = await request.get(`/api/v1/tokens/${"0x" + "2".repeat(40)}/risk`);
  expect(none.status()).toBe(404);
  expect(((await none.json()) as Err).error.code).toBe("DATA_UNAVAILABLE");
});

test("responses are never cached and carry rate-limit headers", async ({ request }) => {
  const res = await request.get(`/api/v1/tokens/${"0x" + "3".repeat(40)}/risk`);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(Number(res.headers()["x-ratelimit-limit"])).toBeGreaterThan(0);
});

test("rate limiting is enforced on scan creation", async ({ request }) => {
  const statuses: number[] = [];
  let retryAfter: string | undefined;
  for (let i = 0; i < 14; i++) {
    const res = await request.post("/api/v1/scans", { data: { address: "0x1" } });
    statuses.push(res.status());
    if (res.status() === 429) {
      retryAfter = res.headers()["retry-after"];
      expect(((await res.json()) as Err).error.code).toBe("RATE_LIMITED");
      break;
    }
  }
  expect(statuses).toContain(429);
  expect(Number(retryAfter)).toBeGreaterThan(0);
});

const OTHER = "0x" + "2".repeat(40);

test("token slice endpoints validate input and report missing scans", async ({ request }) => {
  for (const slice of ["holders", "creator", "relationships"]) {
    expect((await request.get(`/api/v1/tokens/0xnope/${slice}`)).status(), slice).toBe(400);
    const none = await request.get(`/api/v1/tokens/${OTHER}/${slice}`);
    expect(none.status(), slice).toBe(404);
    expect(((await none.json()) as Err).error.code).toBe("DATA_UNAVAILABLE");
  }
});

test("wallet and creator endpoints validate addresses", async ({ request }) => {
  for (const path of ["/api/v1/wallets/0xnope", "/api/v1/wallets/0xnope/relationships", "/api/v1/creators/0xnope"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(400);
    expect(((await res.json()) as Err).error.code).toBe("INVALID_ADDRESS");
  }
});

test("wallet endpoint returns a profile with explicit sample limits and a graph", async ({ request }) => {
  const res = await request.get("/api/v1/wallets/0xab70588b24203e245bcee352d050975931b16e20");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  const body = (await res.json()) as { data: { address: string; explorerAvailable: boolean; sample: { transactions: number; complete: boolean } }; meta: { requestId: string } };
  expect(body.data.address).toBe("0xab70588b24203e245bcee352d050975931b16e20");
  expect(typeof body.data.explorerAvailable).toBe("boolean");
  if (body.data.explorerAvailable) expect(body.data.sample.transactions).toBeGreaterThan(0);
  const rel = await request.get("/api/v1/wallets/0xab70588b24203e245bcee352d050975931b16e20/relationships");
  expect(rel.status()).toBe(200);
  expect(((await rel.json()) as { data: { graph: { nodes: unknown[] } } }).data.graph.nodes.length).toBeGreaterThan(0);
});

test("scanned token slices carry freshness and never identity claims (when VIBE COOK was scanned)", async ({ request }) => {
  const token = "0xb2b489a0bb87bc2e8a1c11913c66ac0ac040e344";
  const holders = await request.get(`/api/v1/tokens/${token}/holders`);
  test.skip(holders.status() !== 200, "VIBE COOK has not been scanned in this database");
  const h = (await holders.json()) as { data: { scanId: string; analysis: { block: number }; holders: { holderCount: number } }; meta: { stale: boolean } };
  expect(h.data.analysis.block).toBeGreaterThan(0);
  expect(h.data.holders.holderCount).toBeGreaterThan(1000);
  const rel = await request.get(`/api/v1/tokens/${token}/relationships`);
  const r = (await rel.json()) as { data: { sybil: { clusters: { label: string }[] } | null } };
  for (const c of r.data.sybil?.clusters ?? []) expect(["Possible Coordination", "High Behavioral Similarity"]).toContain(c.label);
  const cr = await request.get(`/api/v1/tokens/${token}/creator`);
  expect(((await cr.json()) as { data: { creator: string } }).data.creator).toBe("0xab70588b24203e245bcee352d050975931b16e20");
});
