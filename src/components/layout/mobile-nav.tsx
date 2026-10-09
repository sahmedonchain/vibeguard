"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav({ items }: { items: { path: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </Button>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="absolute inset-x-0 top-14 border-b border-border bg-background px-4 py-3">
          <ul className="flex flex-col gap-1">
            {items.map((i) => (
              <li key={i.path}>
                <Link href={i.path} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
                  {i.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
