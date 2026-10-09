import { z } from "zod";
import { isAddress } from "viem";
import { ApiError } from "./errors";

export const addressSchema = z
  .string()
  .max(66)
  .trim()
  .refine((v) => isAddress(v, { strict: false }), { message: "Expected a 42-character EVM address starting with 0x." })
  .transform((v) => v.toLowerCase() as `0x${string}`);

export const createScanBody = z.strictObject({
  address: addressSchema,
  chainId: z.number().int().positive().optional(),
});

export const uuidSchema = z.uuid();

/** Parses with a schema and converts failures to INVALID_ADDRESS-style ApiErrors. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, code: "INVALID_ADDRESS" = "INVALID_ADDRESS"): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ApiError(code, r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}

/** Reads a JSON body with a hard size cap. */
export async function readJsonBody(req: Request, maxBytes = 2048): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new ApiError("INVALID_ADDRESS", "Request body too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError("INVALID_ADDRESS", "Request body too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("INVALID_ADDRESS", "Request body must be valid JSON.");
  }
}
