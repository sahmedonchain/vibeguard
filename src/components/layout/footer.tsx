import Link from "next/link";
import { ROUTE_LIST } from "@/lib/routes";

const GROUPS = [
  { key: "product", label: "Product" },
  { key: "developers", label: "Developers" },
  { key: "company", label: "Company" },
] as const;

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        {GROUPS.map((g) => (
          <nav key={g.key} aria-label={g.label}>
            <h2 className="mb-3 text-sm font-semibold">{g.label}</h2>
            <ul className="space-y-2">
              {ROUTE_LIST.filter((r) => r.footer === g.key).map((r) => (
                <li key={r.path}>
                  <Link href={r.path} className="text-sm text-muted-foreground hover:text-foreground">{r.title}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        VibeGuard is an automated analysis tool, not an audit, and not financial advice. Testnet tokens have no monetary value.
        Not affiliated with VibeVibe or Robinhood.
      </div>
    </footer>
  );
}
