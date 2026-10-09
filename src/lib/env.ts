import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  INDEXER_CONFIRMATIONS: z.coerce.number().int().min(0).max(1000).default(2),
  INDEXER_SCAN_BUDGET_MS: z.coerce.number().int().min(1000).default(90_000),
  ANALYSIS_BUDGET_MS: z.coerce.number().int().min(1000).default(45_000),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(3000),
  INDEXER_START_BLOCK: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().optional()),
  RATE_LIMIT_SECRET: z.string().min(1).default("dev-only-insecure-secret"),
});

export type AppEnv = z.infer<typeof schema>;

export function parseEnv(env: Record<string, string | undefined>): AppEnv {
  const e = schema.parse(env);
  if (e.APP_ENV === "production" && e.RATE_LIMIT_SECRET === "dev-only-insecure-secret") {
    throw new Error("RATE_LIMIT_SECRET must be set in production");
  }
  return e;
}

let cached: AppEnv | undefined;
export function getEnv(): AppEnv {
  return (cached ??= parseEnv(process.env));
}
