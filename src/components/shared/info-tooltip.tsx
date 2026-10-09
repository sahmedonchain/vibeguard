import { Info } from "lucide-react";

/** CSS-only tooltip: opens on hover and keyboard focus; text is also available via aria-label. */
export function InfoTooltip({ text, label = "More information" }: { text: string; label?: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" aria-label={`${label}: ${text}`} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <Info className="size-3.5" aria-hidden />
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-64 -translate-x-1/2 rounded-md border border-border bg-card p-2 text-xs font-normal text-foreground shadow-lg group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
  );
}
