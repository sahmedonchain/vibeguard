"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { isAddress } from "viem";
import { Button } from "@/components/ui/button";

type ApiErrorBody = { error?: { code?: string; message?: string; retryAfterSeconds?: number } };

const MESSAGES: Record<string, string> = {
  INVALID_ADDRESS: "That is not a valid address. Use a 42-character address starting with 0x.",
  UNSUPPORTED_NETWORK: "This network is not supported.",
  RATE_LIMITED: "Too many scans from your connection. Wait a minute and try again.",
  PROVIDER_UNAVAILABLE: "The service is temporarily unavailable. Try again shortly.",
};

export async function requestScan(address: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/v1/scans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
    const code = body.error?.code ?? "";
    return { ok: false, message: MESSAGES[code] ?? body.error?.message ?? "The scan could not be started." };
  } catch {
    return { ok: false, message: "Network error. Check your connection and try again." };
  }
}

/** Address form: validates locally, starts a scan, then opens the shareable report route. */
export function ScanForm({ initialAddress = "" }: { initialAddress?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialAddress);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = value.trim();
    if (!isAddress(address, { strict: false })) {
      setError(MESSAGES.INVALID_ADDRESS);
      return;
    }
    setError(null);
    setBusy(true);
    const r = await requestScan(address);
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
      return;
    }
    router.push(`/token/${address.toLowerCase()}`);
  }

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-2xl">
      <label htmlFor="token-address" className="mb-2 block text-sm font-medium">Token contract address</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="token-address"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          maxLength={66}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "scan-error" : undefined}
          className="h-10 flex-1 rounded-md border border-border bg-card px-3 font-mono text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
        />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ScanSearch className="size-4" aria-hidden />} {busy ? "Starting…" : "Scan token"}
        </Button>
      </div>
      {error && <p id="scan-error" role="alert" className="mt-2 text-sm text-sev-critical">{error}</p>}
    </form>
  );
}

/** Starts a scan for a token that has none, or re-scans, then refreshes the server-rendered report. */
export function ScanButton({ address, label = "Scan this token" }: { address: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await requestScan(address);
          if (!r.ok) setError(r.message);
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ScanSearch className="size-4" aria-hidden />} {label}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-sev-critical">{error}</p>}
    </div>
  );
}

/** While a scan is queued or running, refreshes the server component every few seconds. */
export function ScanPoller({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timer.current = setInterval(() => router.refresh(), intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [router, intervalMs]);
  return null;
}
