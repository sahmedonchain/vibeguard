import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { ApiError, ERROR_CODES } from "@/lib/api/errors";
import { clientKey } from "@/lib/api/rate-limit";
import { fail } from "@/lib/api/respond";
import { addressSchema, createScanBody, parseOrThrow, readJsonBody, uuidSchema } from "@/lib/api/schemas";
import { parseEnv } from "@/lib/env";
import { safeText } from "@/lib/text";

const ADDR = "0x3c1b3e4383f3Fa90b314dD451332c86b1C779725";

describe("api schemas", () => {
  it("normalizes valid addresses to lowercase", () => {
    expect(addressSchema.parse(` ${ADDR} `)).toBe(ADDR.toLowerCase());
  });
  it.each(["", "0x123", "0x" + "g".repeat(40), "<script>alert(1)</script>", "0x" + "a".repeat(41), "a".repeat(5000)])("rejects malformed address %#", (v) => {
    expect(addressSchema.safeParse(v).success).toBe(false);
  });
  it("rejects unknown body fields and wrong types", () => {
    expect(createScanBody.safeParse({ address: ADDR, extra: 1 }).success).toBe(false);
    expect(createScanBody.safeParse({ address: ADDR, chainId: "46630" }).success).toBe(false);
    expect(createScanBody.safeParse({ address: ADDR, chainId: 46630 }).success).toBe(true);
  });
  it("parseOrThrow raises INVALID_ADDRESS", () => {
    try {
      parseOrThrow(addressSchema, "nope");
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("INVALID_ADDRESS");
    }
  });
  it("validates UUIDs", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse(crypto.randomUUID()).success).toBe(true);
  });
  it("enforces body size and JSON validity", async () => {
    const big = new Request("http://x", { method: "POST", body: JSON.stringify({ a: "x".repeat(5000) }) });
    await expect(readJsonBody(big)).rejects.toThrow(/too large/);
    await expect(readJsonBody(new Request("http://x", { method: "POST", body: "{nope" }))).rejects.toThrow(/valid JSON/);
    expect(await readJsonBody(new Request("http://x", { method: "POST", body: '{"address":"x"}' }))).toEqual({ address: "x" });
  });
});

describe("error envelope", () => {
  const json = async (r: Response) => (await r.json()) as { error: { code: string; message: string; requestId: string; retryAfterSeconds?: number } };
  it("maps every public code to a status", () => {
    expect(Object.keys(ERROR_CODES).sort()).toEqual(["DATA_UNAVAILABLE", "INSUFFICIENT_DATA", "INTERNAL_ERROR", "INVALID_ADDRESS", "PROVIDER_UNAVAILABLE", "RATE_LIMITED", "SCAN_FAILED", "SCAN_IN_PROGRESS", "UNSUPPORTED_CONTRACT", "UNSUPPORTED_NETWORK"]);
  });
  it("includes request id, code, message and retry guidance", async () => {
    const res = fail(new ApiError("RATE_LIMITED", "slow down", { retryAfterSeconds: 7 }), "req-1");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(await json(res)).toEqual({ error: { code: "RATE_LIMITED", message: "slow down", requestId: "req-1", retryAfterSeconds: 7 } });
  });
  it("merges extra headers such as rate-limit state into error responses", () => {
    const res = fail(new ApiError("DATA_UNAVAILABLE", "none"), "req-3", { "x-ratelimit-limit": "120" });
    expect(res.headers.get("x-ratelimit-limit")).toBe("120");
  });
  it("hides internals of unexpected errors", async () => {
    const res = fail(new Error("password=hunter2 at /home/x/secret.ts:12 SELECT * FROM users"), "req-2");
    const body = await json(res);
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/hunter2|secret\.ts|SELECT/);
  });
  it("maps zod errors to INVALID_ADDRESS", async () => {
    let err: unknown;
    try { z.string().parse(1); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ZodError);
    expect(fail(err, "r").status).toBe(400);
  });
});

describe("rate limit identity", () => {
  it("hashes the client address and never stores it", () => {
    const req = (ip: string) => new Request("http://x", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
    const a = clientKey(req("203.0.113.9"), "secret");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("203");
    expect(clientKey(req("203.0.113.9"), "secret")).toBe(a);
    expect(clientKey(req("203.0.113.10"), "secret")).not.toBe(a);
    expect(clientKey(req("203.0.113.9"), "other")).not.toBe(a);
  });
});

describe("env", () => {
  it("applies defaults", () => {
    const e = parseEnv({});
    expect(e.INDEXER_CONFIRMATIONS).toBe(2);
    expect(e.APP_ENV).toBe("development");
  });
  it("refuses the dev secret in production", () => {
    expect(() => parseEnv({ APP_ENV: "production" })).toThrow(/RATE_LIMIT_SECRET/);
    expect(parseEnv({ APP_ENV: "production", RATE_LIMIT_SECRET: "x" }).APP_ENV).toBe("production");
  });
});

describe("safeText", () => {
  it("strips control and bidi characters and caps length", () => {
    expect(safeText("Tok‮en\u0000​")).toBe("Token");
    expect(safeText("a".repeat(100), 10)).toBe("aaaaaaaaaa…");
    expect(safeText(null)).toBe("");
  });
  it("leaves markup as inert text for React to escape", () => {
    expect(safeText("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>");
  });
});
