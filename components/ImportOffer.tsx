"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { ImportConflictError, findLocalEntries, importLocalEntries, type ImportResult } from "@/lib/entries";

// "Not now" lasts for this browser session; the offer returns on the next visit.
const DISMISSED_KEY = "after-the-credits:import-offer:dismissed";

type State =
  | { status: "hidden" }
  | { status: "offer"; count: number }
  | { status: "importing"; count: number }
  | { status: "failed"; count: number; message: string }
  | { status: "done"; result: ImportResult };

const films = (n: number) => `${n} ${n === 1 ? "film" : "films"}`;

/** Offers to add entries saved in this browser (Assignment 3) to the signed-in account. Never imports on its own. */
export default function ImportOffer({
  db,
  onImported,
  className = "",
}: {
  db: SupabaseClient;
  onImported: () => void;
  className?: string;
}) {
  const [state, setState] = useState<State>({ status: "hidden" });
  const doneRef = useRef<HTMLDivElement>(null);

  // localStorage only exists in the browser, so look after mount.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // No session storage: just show the offer.
    }
    const local = findLocalEntries();
    if (local) setState({ status: "offer", count: local.entries.length });
  }, []);

  useEffect(() => {
    if (state.status === "done") doneRef.current?.focus();
  }, [state.status]);

  if (state.status === "hidden") return null;

  async function handleImport(count: number) {
    setState({ status: "importing", count });
    try {
      const result = await importLocalEntries(db);
      setState({ status: "done", result });
      onImported();
    } catch (error) {
      setState({
        status: "failed",
        count,
        message:
          error instanceof ImportConflictError
            ? "Some of these films are already in a different account, so nothing was moved. They're still saved in this browser."
            : "We couldn't add your films, so nothing was changed. They're still saved in this browser. Check your connection and try again.",
      });
    }
  }

  function handleNotNow() {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Hiding it for now is enough.
    }
    setState({ status: "hidden" });
  }

  if (state.status === "done") {
    const { imported, skipped } = state.result;
    return (
      <div
        ref={doneRef}
        role="status"
        tabIndex={-1}
        className={`flex items-start justify-between gap-4 rounded-xl border border-amber/50 bg-amber/10 p-4 outline-none focus-visible:outline-amber ${className}`}
      >
        <p className="text-ivory">
          <span aria-hidden="true" className="mr-2 text-amber">
            ✓
          </span>
          {films(imported)} {imported === 1 ? "was" : "were"} added to your diary. A backup copy stays in this browser.
          {skipped > 0 && ` ${films(skipped)} couldn't be read and ${skipped === 1 ? "is" : "are"} kept in that copy.`}
        </p>
        <button
          type="button"
          onClick={() => setState({ status: "hidden" })}
          className="shrink-0 rounded px-2 text-sm text-parchment underline-offset-4 hover:text-ivory hover:underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const busy = state.status === "importing";
  return (
    <div className={`space-y-4 rounded-xl border border-seam bg-reel/60 p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose text-parchment">
          <span className="text-ivory">{films(state.count)}</span> {state.count === 1 ? "is" : "are"} saved in this
          browser only. Add {state.count === 1 ? "it" : "them"} to your account?
        </p>
        <div className="flex gap-3">
          <Button size="sm" disabled={busy} onClick={() => handleImport(state.count)}>
            {busy ? "Adding…" : state.status === "failed" ? "Try again" : `Add ${state.count === 1 ? "it" : "them"}`}
          </Button>
          <Button variant="quiet" size="sm" disabled={busy} onClick={handleNotNow}>
            Not now
          </Button>
        </div>
      </div>
      {state.status === "failed" && (
        <p role="alert" className="rounded-lg border border-ember/60 bg-ember/10 p-3 text-sm font-medium text-ember">
          {state.message}
        </p>
      )}
    </div>
  );
}
