"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import StarRating, { FieldError } from "@/components/StarRating";
import { localToday } from "@/lib/date";
import { saveEntry, type Rating } from "@/lib/entries";
import {
  EARLIEST_DAY,
  FIELD_ORDER,
  REFLECTION_MAX,
  validateEntry,
  validateField,
  type EntryErrors,
  type EntryField,
  type EntryFormValues,
} from "@/lib/validate";

const LABELS: Record<EntryField, string> = {
  title: "Film title",
  watchedOn: "Date watched",
  rating: "Rating",
  reflection: "Reflection",
};

const inputClass =
  "block w-full rounded-lg border border-seam-strong bg-reel px-4 py-3 text-base text-ivory placeholder:text-parchment/70 " +
  "transition-colors hover:border-parchment focus:border-amber focus-visible:outline-amber " +
  "aria-invalid:border-ember";

export default function EntryForm() {
  const router = useRouter();
  const [today, setToday] = useState("");
  const [values, setValues] = useState<EntryFormValues>({
    title: "",
    watchedOn: "",
    rating: "",
    reflection: "",
  });
  const [errors, setErrors] = useState<EntryErrors>({});
  const [dirty, setDirty] = useState<Partial<Record<EntryField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // "Today" must come from the visitor's clock, not the build server's.
  useEffect(() => {
    const day = localToday();
    setToday(day);
    setValues((v) => (v.watchedOn ? v : { ...v, watchedOn: day }));
    titleRef.current?.focus();
  }, []);

  const hasContent = values.title.trim() !== "" || values.rating !== "" || values.reflection.trim() !== "";

  useEffect(() => {
    if (!hasContent || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasContent, saving]);

  function update(field: EntryField, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    setDirty((d) => ({ ...d, [field]: true }));
    // Once a field has shown an error (or the form was submitted), re-check
    // as the user types so the message clears the moment it's fixed.
    if (errors[field] || submitted) {
      setErrors((e) => ({ ...e, [field]: validateField(field, next, today) }));
    }
  }

  function blur(field: EntryField) {
    if (dirty[field] || submitted) {
      setErrors((e) => ({ ...e, [field]: validateField(field, values, today) }));
    }
  }

  function focusField(field: EntryField) {
    document.getElementById(field)?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    setSubmitted(true);

    const found = validateEntry(values, today || localToday());
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((f) => found[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setSaving(true);
    try {
      const entry = saveEntry({
        title: values.title.trim(),
        watchedOn: values.watchedOn,
        rating: Number(values.rating) as Rating,
        reflection: values.reflection.trim(),
      });
      router.push(`/?saved=${encodeURIComponent(entry.id)}`);
    } catch {
      setSaving(false);
      setFormError(
        "We couldn't save this entry. Your browser may be blocking storage or be out of space. " +
          "Nothing you typed has been lost. Try again, or copy your reflection somewhere safe.",
      );
      summaryRef.current?.focus();
    }
  }

  function confirmLeave(e: React.MouseEvent) {
    if (hasContent && !saving && !window.confirm("Leave without saving? This entry will be lost.")) {
      e.preventDefault();
    }
  }

  const errorList = FIELD_ORDER.filter((f) => errors[f]);
  const describedBy = (field: EntryField, ...extra: string[]) =>
    [...extra, errors[field] ? `${field}-error` : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <div ref={summaryRef} tabIndex={-1} className="outline-none">
        {(formError || (submitted && errorList.length > 0)) && (
          <div role="alert" className="rounded-lg border border-ember/60 bg-ember/10 p-4 text-sm">
            {formError ? (
              <p className="font-medium text-ember">{formError}</p>
            ) : (
              <>
                <p className="font-semibold text-ember">
                  {errorList.length === 1 ? "One thing needs fixing" : `${errorList.length} things need fixing`}{" "}
                  before this can be saved:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ivory">
                  {errorList.map((f) => (
                    <li key={f}>
                      <a
                        href={`#${f}`}
                        onClick={(e) => {
                          e.preventDefault();
                          focusField(f);
                        }}
                        className="underline decoration-ember/60 underline-offset-2 hover:text-amber-bright"
                      >
                        {LABELS[f]}: {errors[f]}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="title" className="block font-medium text-ivory">
          Film title
        </label>
        <p id="title-hint" className="text-sm text-parchment">
          As it appears on the poster.
        </p>
        <input
          ref={titleRef}
          id="title"
          name="title"
          type="text"
          autoComplete="off"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          onBlur={() => blur("title")}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={describedBy("title", "title-hint")}
          className={`${inputClass} font-serif text-lg`}
        />
        {errors.title && <FieldError id="title-error" message={errors.title} />}
      </div>

      <div className="space-y-2">
        <label htmlFor="watchedOn" className="block font-medium text-ivory">
          Date watched
        </label>
        <input
          id="watchedOn"
          name="watchedOn"
          type="date"
          min={EARLIEST_DAY}
          max={today || undefined}
          value={values.watchedOn}
          onChange={(e) => update("watchedOn", e.target.value)}
          onBlur={() => blur("watchedOn")}
          aria-invalid={errors.watchedOn ? true : undefined}
          aria-describedby={describedBy("watchedOn")}
          className={`${inputClass} max-w-56 [color-scheme:dark]`}
        />
        {errors.watchedOn && <FieldError id="watchedOn-error" message={errors.watchedOn} />}
      </div>

      <StarRating
        value={values.rating}
        onChange={(v) => update("rating", v)}
        onBlur={() => blur("rating")}
        error={errors.rating}
        errorId="rating-error"
      />

      <div className="space-y-2">
        <label htmlFor="reflection" className="block font-medium text-ivory">
          Reflection <span className="font-normal text-parchment">(optional)</span>
        </label>
        <p id="reflection-hint" className="text-sm text-parchment">
          A line or two: a scene, a feeling, who you watched it with.
        </p>
        <textarea
          id="reflection"
          name="reflection"
          rows={5}
          value={values.reflection}
          onChange={(e) => update("reflection", e.target.value)}
          onBlur={() => blur("reflection")}
          aria-invalid={errors.reflection ? true : undefined}
          aria-describedby={describedBy("reflection", "reflection-hint", "reflection-count")}
          className={`${inputClass} resize-y leading-relaxed`}
        />
        <div className="flex items-start justify-between gap-4">
          <div>{errors.reflection && <FieldError id="reflection-error" message={errors.reflection} />}</div>
          <p
            id="reflection-count"
            className={`shrink-0 text-sm tabular-nums ${
              values.reflection.length > REFLECTION_MAX ? "font-semibold text-ember" : "text-parchment"
            }`}
          >
            {values.reflection.length} / {REFLECTION_MAX}
            <span className="sr-only"> characters</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-seam pt-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-amber px-6 py-3 font-semibold text-night transition-colors hover:bg-amber-bright disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? "Saving…" : "Save to diary"}
        </button>
        <Link href="/" onClick={confirmLeave} className="text-parchment underline-offset-4 hover:text-ivory hover:underline">
          Back to diary
        </Link>
      </div>
    </form>
  );
}
