import { CheckCircle2, HelpCircle } from "lucide-react";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { Badge } from "@/components/ui/badge";
import type { ReportFinding } from "@/lib/scans/report";
import { EvidenceCard } from "./evidence-card";

const CONF_TEXT = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" } as const;

export function FindingCard({ finding: f }: { finding: ReportFinding }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4" aria-labelledby={`f-${f.ruleId}`}>
      <div className="flex flex-wrap items-center gap-2">
        {f.status === "detected" && <SeverityBadge severity={f.severity} />}
        {f.status === "not_detected" && (
          <Badge className="text-sev-low"><CheckCircle2 className="size-3" aria-hidden /> Not detected</Badge>
        )}
        {f.status === "unknown" && (
          <Badge className="text-muted-foreground"><HelpCircle className="size-3" aria-hidden /> Not checked</Badge>
        )}
        <Badge className="text-muted-foreground">{CONF_TEXT[f.confidence]}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{f.ruleId}</span>
      </div>
      <h3 id={`f-${f.ruleId}`} className="mt-2 font-medium">{f.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{f.explanation}</p>
      {f.followUp && f.status === "detected" && <p className="mt-2 text-sm"><span className="font-medium">Next step: </span>{f.followUp}</p>}
      {f.evidence.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Evidence ({f.evidence.length})</summary>
          <ul className="mt-2 space-y-2">{f.evidence.map((e) => <EvidenceCard key={e.id} item={e} />)}</ul>
        </details>
      )}
    </article>
  );
}
