"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  const onLog = pathname === "/log";

  return (
    <header className="border-b border-seam/70">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-4 sm:px-6"
      >
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-ivory hover:text-amber-bright sm:text-2xl"
        >
          After the <em className="text-amber">Credits</em>
        </Link>
        <Link
          href="/log"
          aria-current={onLog ? "page" : undefined}
          className={
            onLog
              ? "rounded-full border border-seam px-4 py-2 text-sm font-medium text-parchment"
              : "rounded-full bg-amber px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-amber-bright"
          }
        >
          <span aria-hidden="true">+ </span>Log a film
        </Link>
      </nav>
    </header>
  );
}
