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
