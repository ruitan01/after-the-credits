"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, UserButton } from "@clerk/nextjs";
import { ButtonLink } from "@/components/ui";

const textLink =
  "rounded px-2 py-1 text-sm text-parchment underline-offset-8 hover:text-ivory aria-[current=page]:text-ivory aria-[current=page]:underline aria-[current=page]:decoration-amber";

export default function SiteHeader() {
  const pathname = usePathname();
  const onLog = pathname === "/log";
  const onDiary = pathname === "/";
  const onSignIn = pathname.startsWith("/sign-in");
  const onSignUp = pathname.startsWith("/sign-up");

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
        <div className="flex items-center gap-2 sm:gap-4">
          <Show when="signed-in">
            <Link href="/" aria-current={onDiary ? "page" : undefined} className={textLink}>
              Diary
            </Link>
            <ButtonLink
              href="/log"
              aria-current={onLog ? "page" : undefined}
              variant={onLog ? "quiet" : "primary"}
              size="sm"
            >
              <span aria-hidden="true">+</span>Log a film
            </ButtonLink>
            {/* Its menu holds "Manage account" and "Sign out"; signing out returns to the welcome page. */}
            <UserButton />
          </Show>
          <Show when="signed-out">
            <Link href="/sign-in" aria-current={onSignIn ? "page" : undefined} className={textLink}>
              Sign in
            </Link>
            <ButtonLink
              href="/sign-up"
              aria-current={onSignUp ? "page" : undefined}
              variant={onSignUp ? "quiet" : "primary"}
              size="sm"
            >
              Sign up
            </ButtonLink>
          </Show>
        </div>
      </nav>
    </header>
  );
}
