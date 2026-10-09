import { RISK_LEVELS, isProvisional, type RiskLevel } from "@/lib/risk-engine/methodology";
import { cn } from "@/lib/utils";

export function riskBand(score: number): Exclude<RiskLevel, "insufficient"> {
  return RISK_LEVELS.find((l) => score >= l.min && score <= l.max)?.level ?? "critical";
}

const LEVEL_LABEL: Record<Exclude<RiskLevel, "insufficient">, string> = Object.fromEntries(RISK_LEVELS.map((l) => [l.level, l.label])) as never;

const BAND_CLS = {
  low: "text-sev-low border-sev-low/50",
  moderate: "text-sev-medium border-sev-medium/50",
  elevated: "text-sev-high border-sev-high/50",
  high: "text-sev-high border-sev-high/70",
  critical: "text-sev-critical border-sev-critical/60",
} as const;

const PROVISIONAL_CLS = "text-muted-foreground border-border";

/**
 * Risk score 0 (least observed risk) to 100 (SRS 8.2). Coverage is shown separately:
 * a low score with low coverage is NOT safe, so any coverage below 100% renders the band as
 * "<Band> · provisional" in a neutral colour instead of the severity colour. Critical never goes
 * neutral: it keeps the critical colour and still appends "· provisional".
 * `level` overrides the band (a critical finding forces "critical" regardless of the aggregate).
 */
export function RiskScore({ score, coverage, level, className }: { score: number | null; coverage?: number; level?: RiskLevel; className?: string }) {
  if (score === null && level !== "critical") {
    return (
      <div className={cn("inline-flex flex-col items-center rounded-lg border border-dashed border-border px-5 py-3", className)}>
        <span className="text-2xl font-semibold text-muted-foreground">N/A</span>
        <span className="text-xs text-muted-foreground">Not enough data to score</span>
        {coverage !== undefined && <span className="mt-1 text-xs text-muted-foreground">Coverage {Math.round(coverage * 100)}%</span>}
      </div>
    );
  }
  const band = level && level !== "insufficient" ? level : riskBand(score ?? 0);
  const provisional = isProvisional(coverage);
  return (
    <div className={cn("inline-flex flex-col items-center rounded-lg border-2 px-5 py-3", provisional && band !== "critical" ? PROVISIONAL_CLS : BAND_CLS[band], className)}>
      <span className="text-3xl font-bold tabular-nums">{score === null ? "—" : Math.round(score)}</span>
      <span className="text-xs font-medium uppercase tracking-wide">{provisional ? `${LEVEL_LABEL[band]} · provisional` : LEVEL_LABEL[band]}</span>
      {coverage !== undefined && <span className="mt-1 text-xs text-muted-foreground">Coverage {Math.round(coverage * 100)}%</span>}
    </div>
  );
}
