import { cn } from "@/lib/utils";

export function riskBand(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

const BAND_CLS = {
  low: "text-sev-low border-sev-low/50",
  medium: "text-sev-medium border-sev-medium/50",
  high: "text-sev-high border-sev-high/50",
  critical: "text-sev-critical border-sev-critical/50",
} as const;

/**
 * Risk score 0 (lowest observed risk) to 100. `coverage` (0-1) is shown separately:
 * a low score with low coverage is NOT safe, and the UI says so.
 */
export function RiskScore({ score, coverage, className }: { score: number | null; coverage?: number; className?: string }) {
  if (score === null) {
    return (
      <div className={cn("inline-flex flex-col items-center rounded-lg border border-dashed border-border px-5 py-3", className)}>
        <span className="text-2xl font-semibold text-muted-foreground">N/A</span>
        <span className="text-xs text-muted-foreground">Not enough data to score</span>
      </div>
    );
  }
  const band = riskBand(score);
  return (
    <div className={cn("inline-flex flex-col items-center rounded-lg border-2 px-5 py-3", BAND_CLS[band], className)}>
      <span className="text-3xl font-bold tabular-nums">{Math.round(score)}</span>
      <span className="text-xs font-medium uppercase tracking-wide">{band} risk</span>
      {coverage !== undefined && (
        <span className="mt-1 text-xs text-muted-foreground">Coverage {Math.round(coverage * 100)}%</span>
      )}
    </div>
  );
}
