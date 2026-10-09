import { AlertOctagon, AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

const STYLE: Record<Severity, { cls: string; Icon: typeof Info }> = {
  info: { cls: "text-sev-info border-sev-info/40 bg-sev-info/10", Icon: Info },
  low: { cls: "text-sev-low border-sev-low/40 bg-sev-low/10", Icon: Info },
  medium: { cls: "text-sev-medium border-sev-medium/40 bg-sev-medium/10", Icon: AlertTriangle },
  high: { cls: "text-sev-high border-sev-high/40 bg-sev-high/10", Icon: OctagonAlert },
  critical: { cls: "text-sev-critical border-sev-critical/40 bg-sev-critical/10", Icon: AlertOctagon },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { cls, Icon } = STYLE[severity];
  return (
    <Badge className={cn(cls, "capitalize", className)}>
      <Icon className="size-3" aria-hidden /> {severity}
    </Badge>
  );
}
