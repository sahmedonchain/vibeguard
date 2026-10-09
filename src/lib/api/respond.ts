import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export type ApiMeta = { requestId: string; [k: string]: unknown };

export function newRequestId(): string {
  return crypto.randomUUID();
}

const baseHeaders = (requestId: string): Record<string, string> => ({ "x-request-id": requestId, "cache-control": "no-store" });

export function ok<T>(data: T, requestId: string, init: { status?: number; headers?: Record<string, string>; meta?: Record<string, unknown> } = {}) {
  return NextResponse.json({ data, meta: { requestId, ...init.meta } }, { status: init.status ?? 200, headers: { ...baseHeaders(requestId), ...init.headers } });
}

/** Maps any thrown value to the standard error envelope. Never leaks internals. */
export function fail(err: unknown, requestId: string, headers: Record<string, string> = {}) {
  let apiErr: ApiError;
  if (err instanceof ApiError) apiErr = err;
  else if (err instanceof ZodError) apiErr = new ApiError("INVALID_ADDRESS", err.issues[0]?.message ?? "Invalid request");
  else {
    console.error(`[${requestId}] unhandled`, err instanceof Error ? err.message : err);
    apiErr = new ApiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
  const h = { ...baseHeaders(requestId), ...headers };
  if (apiErr.opts.retryAfterSeconds) h["retry-after"] = String(apiErr.opts.retryAfterSeconds);
  return NextResponse.json(
    { error: { code: apiErr.code, message: apiErr.message, requestId, ...(apiErr.opts.retryAfterSeconds ? { retryAfterSeconds: apiErr.opts.retryAfterSeconds } : {}), ...apiErr.opts.extra } },
    { status: apiErr.status, headers: h },
  );
}
