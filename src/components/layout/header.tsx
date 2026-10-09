import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { MORE_NAV, PRIMARY_NAV } from "./nav-links";
import { MobileNav } from "./mobile-nav";

export function Header() {
  const all = [...PRIMARY_NAV, ...MORE_NAV];
  return (
    <header className="relative sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5 text-primary" aria-hidden /> VibeGuard
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {all.map((i) => (
            <Link key={i.path} href={i.path} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {i.title}
            </Link>
          ))}
        </nav>
        <MobileNav items={all} />
      </div>
    </header>
  );
}
