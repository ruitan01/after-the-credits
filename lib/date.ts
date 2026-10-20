// Dates are stored as local calendar days ("YYYY-MM-DD"), never as UTC
// timestamps, so an evening viewing doesn't drift to the next day.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function localToday(): string {
  return toDayString(new Date());
}

/** Parses "YYYY-MM-DD" as a local date. Returns null for malformed or impossible dates. */
export function parseDay(value: string): Date | null {
  const match = ISO_DAY.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

export function formatWatchedOn(value: string): string {
  const date = parseDay(value);
  if (!date) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Whole calendar days from `day` to `today` (both "YYYY-MM-DD"); null if either is invalid. */
export function daysBetween(day: string, today: string): number | null {
  const from = parseDay(day);
  const to = parseDay(today);
  if (!from || !to) return null;
  // Rounding absorbs the hour lost or gained across a daylight-saving change.
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function describeDaysAgo(days: number): string {
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return "a while ago";
}

export function monthName(day: string): string {
  const date = parseDay(day);
  return date ? date.toLocaleDateString("en-GB", { month: "long" }) : "";
}
