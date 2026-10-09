/** Public error codes (SRS 29). */
export const ERROR_CODES = {
  INVALID_ADDRESS: 400,
  UNSUPPORTED_NETWORK: 400,
  UNSUPPORTED_CONTRACT: 422,
  DATA_UNAVAILABLE: 404,
  INSUFFICIENT_DATA: 422,
  RATE_LIMITED: 429,
  SCAN_IN_PROGRESS: 409,
  SCAN_FAILED: 502,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public opts: { retryAfterSeconds?: number; extra?: Record<string, unknown> } = {},
  ) {
    super(message);
  }
  get status() {
    return ERROR_CODES[this.code];
  }
}
