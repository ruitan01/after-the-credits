"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import EntryCard from "@/components/EntryCard";
import { ButtonLink } from "@/components/ui";
import { daysBetween, describeDaysAgo, localToday, monthName, toDayString } from "@/lib/date";
import { STORAGE_KEY, deleteEntry, loadEntries, type Entry } from "@/lib/entries";

type State =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ok"; entries: Entry[]; recovered: boolean };

export default function Diary() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<State>({ status: "loading" });
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);
  const [notice, setNotice] = useState("");
  const bannerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const refresh = useCallback(() => {
    const result = loadEntries();
    setState(result);
    return result;
  }, []);

  // localStorage only exists in the browser, so read it after mount.
  useEffect(() => {
    const result = refresh();
    const savedId = searchParams.get("saved");
    if (savedId) {
      const entry = result.status === "ok" ? result.entries.find((e) => e.id === savedId) : undefined;
      if (entry) setSaved({ id: entry.id, title: entry.title });
      // Drop the query param so a reload or shared URL doesn't repeat the banner.
      router.replace("/", { scroll: false });
    }
  }, [refresh, router, searchParams]);

  // Keep in sync with entries saved from another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  useEffect(() => {
    if (saved) bannerRef.current?.focus();
  }, [saved]);

  function handleDelete(entry: Entry) {
    try {
      deleteEntry(entry.id);
      setNotice(`${entry.title} was removed from your diary.`);
    } catch {
      setNotice(`${entry.title} couldn't be deleted. Your browser may be blocking storage.`);
    }
    if (saved?.id === entry.id) setSaved(null);
    refresh();
    // The deleted card took focus with it; move to a stable landmark.
    headingRef.current?.focus();
  }

  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="space-y-4">
        <p className="sr-only">Opening your diary…</p>
        <div className="h-10 w-48 animate-pulse rounded bg-reel" />
        <div className="h-32 animate-pulse rounded-xl bg-reel/70" />
        <div className="h-32 animate-pulse rounded-xl bg-reel/50" />
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div role="alert" className="rounded-xl border border-ember/60 bg-ember/10 p-6">
        <h1 className="font-serif text-2xl text-ivory">Your diary can&rsquo;t open here</h1>
        <p className="mt-2 text-parchment">
          Your browser is blocking local storage, so entries can&rsquo;t be saved or read on this page. If
          you&rsquo;re in a private window, try a normal one, or allow site data for this site.
        </p>
      </div>
    );
  }

  const { entries, recovered } = state;

  if (entries.length === 0) {
    return (
      <section aria-labelledby="welcome-title" className="animate-settle py-6 sm:py-12">
        <p className="text-sm tracking-[0.2em] text-amber uppercase">A private film diary</p>
        <h1 id="welcome-title" className="mt-3 font-serif text-5xl leading-[1.05] tracking-tight text-ivory sm:text-6xl">
          Every film leaves <em className="text-amber-bright">something</em> behind.
        </h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-parchment">
          After the Credits is a quiet place to write down what you watched, when, and how it stayed with you.
          Log a film in under a minute, then come back to it whenever you like.
        </p>
        {recovered && <RecoveredNotice />}
        <ButtonLink href="/log" size="lg" className="mt-10">
          Log your first film <span aria-hidden="true">→</span>
        </ButtonLink>
        <p className="mt-6 flex items-center gap-2 text-sm text-parchment">
          <span aria-hidden="true">◐</span>
          Entries stay in this browser. No account, nothing uploaded.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="diary-title" className="space-y-8">
      {saved && (
        <div
          ref={bannerRef}
          role="status"
          tabIndex={-1}
          className="animate-settle flex items-start justify-between gap-4 rounded-xl border border-amber/50 bg-amber/10 p-4 outline-none focus-visible:outline-amber"
        >
          <p className="text-ivory">
            <span aria-hidden="true" className="mr-2 text-amber">
              ✓
            </span>
            <em className="font-serif text-lg">{saved.title}</em> is now in your diary.{" "}
            <Link href="/log" className="whitespace-nowrap text-amber underline underline-offset-4 hover:text-amber-bright">
              Log another film
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setSaved(null)}
            className="shrink-0 rounded px-2 text-sm text-parchment underline-offset-4 hover:text-ivory hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          {!saved && <p className="text-sm tracking-[0.2em] text-amber uppercase">Welcome back</p>}
          <h1
            id="diary-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-4xl tracking-tight text-ivory outline-none sm:text-5xl"
          >
            Your diary
          </h1>
          <p className="mt-2 text-parchment">
            {entries.length} {entries.length === 1 ? "film" : "films"} logged · newest first
          </p>
        </div>
      </header>

      {!saved && <SinceLastTime entries={entries} />}

      {recovered && <RecoveredNotice />}

      <p role="status" className={notice ? "text-sm text-parchment" : "sr-only"}>
        {notice}
      </p>

      <ol className="space-y-4">
        {entries.map((entry) => (
          <li key={entry.id}>
            <EntryCard entry={entry} highlighted={entry.id === saved?.id} onDelete={handleDelete} />
          </li>
        ))}
      </ol>

      <p className="pt-4 text-center text-sm text-parchment">
        Saved in this browser only. Clearing your browsing data will erase this diary.
      </p>
    </section>
  );
}

/** The returning-visit prompt: what you logged last, and this month's tally. */
function SinceLastTime({ entries }: { entries: Entry[] }) {
  const today = localToday();
  const latest = entries.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  const gap = daysBetween(toDayString(new Date(latest.createdAt)), today);
  const month = today.slice(0, 7);
  const thisMonth = entries.filter((e) => e.watchedOn.startsWith(month)).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-seam bg-reel/60 p-5">
      <p className="max-w-prose text-parchment">
        You last logged <em className="font-serif text-lg text-ivory">{latest.title}</em>
        {gap !== null && <> {describeDaysAgo(gap)}</>}.{" "}
        {thisMonth > 0
          ? `That's ${thisMonth} ${thisMonth === 1 ? "film" : "films"} so far in ${monthName(today)}.`
          : `Nothing logged yet in ${monthName(today)}.`}
      </p>
      <ButtonLink href="/log" size="sm">
        Log what you&rsquo;ve watched since
      </ButtonLink>
    </div>
  );
}

function RecoveredNotice() {
  return (
    <p className="mt-6 rounded-lg border border-seam bg-reel p-4 text-sm text-parchment">
      Some saved data couldn&rsquo;t be read and was set aside rather than deleted. Everything else is here.
    </p>
  );
}
