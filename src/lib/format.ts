/** Wei (decimal string) to a short ETH string. Exact integer math; at most 4 decimals, truncated. */
export function formatEth(wei: string | null | undefined): string {
  if (wei == null) return "Unknown";
  const v = BigInt(wei);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${frac ? `.${frac}` : ""} ETH`;
}

export const formatBps = (bps: number) => `${(bps / 100).toFixed(2)}%`;

export function formatDuration(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172_800) return `${(seconds / 3600).toFixed(1)} h`;
  return `${Math.round(seconds / 86_400)} days`;
}
