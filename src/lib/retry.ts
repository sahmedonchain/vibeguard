export type RetryOptions = {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  isRetryable?: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Errors that indicate a transient provider condition (rate limit, timeout, 5xx). */
export function isTransientError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return /429|rate.?limit|too many requests|timeout|timed out|etimedout|econnreset|econnrefused|enotfound|socket hang up|fetch failed|502|503|504|service unavailable|bad gateway|gateway/.test(msg);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const short = (err as { shortMessage?: string }).shortMessage;
    const details = (err as { details?: string }).details;
    return [short ?? err.message, details].filter(Boolean).join(" | ");
  }
  return String(err);
}

/** Bounded exponential backoff with jitter. Throws the last error after `retries` retries. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 4, baseMs = 500, maxMs = 8000, isRetryable = isTransientError, sleep = defaultSleep } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const delay = Math.min(maxMs, baseMs * 2 ** attempt);
      await sleep(Math.round(delay / 2 + Math.random() * (delay / 2)));
      attempt++;
    }
  }
}
