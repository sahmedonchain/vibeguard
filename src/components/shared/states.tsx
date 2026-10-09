import type { ReactNode } from "react";
import { AlertCircle, Ban, Hourglass, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function StateBox({ icon, title, children, className, role }: { icon: ReactNode; title: string; children?: ReactNode; className?: string; role?: "status" | "alert" }) {
  return (
    <div role={role} className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center", className)}>
      <div className="text-muted-foreground">{icon}</div>
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <StateBox role="status" icon={<Loader2 className="size-6 animate-spin" aria-hidden />} title={label} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <StateBox icon={<Inbox className="size-6" aria-hidden />} title={title}>{children}</StateBox>;
}

export function ErrorState({ title = "Something went wrong", children }: { title?: string; children?: ReactNode }) {
  return <StateBox role="alert" icon={<AlertCircle className="size-6 text-sev-high" aria-hidden />} title={title}>{children}</StateBox>;
}

/** For data the chain/provider cannot supply. Unknown is never rendered as safe. */
export function UnsupportedState({ title = "Not supported", children }: { title?: string; children?: ReactNode }) {
  return <StateBox icon={<Ban className="size-6" aria-hidden />} title={title}>{children}</StateBox>;
}

export function ComingSoonState({ phase, phaseName, children }: { phase: number; phaseName: string; children?: ReactNode }) {
  return (
    <StateBox icon={<Hourglass className="size-6" aria-hidden />} title={`Coming in phase ${phase}`}>
      <p>This feature is not built yet. It is planned for phase {phase}: {phaseName}.</p>
      {children}
    </StateBox>
  );
}
