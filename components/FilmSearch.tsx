"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type Ref } from "react";
import Poster from "@/components/Poster";
import { Button } from "@/components/ui";
import { comboboxKey } from "@/lib/combobox";
import { cleanQuery, type Film, type FilmLink } from "@/lib/films";

type Search =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "results"; films: Film[] }
  | { status: "empty" }
  | { status: "unavailable" };

const DEBOUNCE_MS = 300;
// Fast answers skip the loading message so it doesn't flicker.
const LOADING_DELAY_MS = 150;
const SEARCHING = "Searching iTunes…";
const NOTHING_FOUND = "No matches on iTunes. That's fine: keep typing and save it as is.";
const UNAVAILABLE = "Film search isn't available right now. You can still type the title yourself.";

// Per tab: asking for the same title twice in one visit doesn't go back to the server.
const searchCache = new Map<string, Film[]>();

type Props = {
  /** Aria props from `Field`, linking the input to its label, hint and error. */
  control: { id: string; "aria-invalid"?: true; "aria-describedby"?: string };
  inputRef: Ref<HTMLInputElement>;
  className: string;
  value: string;
  film: FilmLink | null;
  onType: (value: string) => void;
  onBlur: () => void;
  onChoose: (film: Film) => void;
  onUnlink: () => void;
};

/**
 * The film title input, with iTunes suggestions as you type. Search only
 * suggests: the field is an ordinary text input whatever search does, so a
 * typed title can always be saved.
 */
export default function FilmSearch({ control, inputRef, className, value, film, onType, onBlur, onChoose, onUnlink }: Props) {
  const [search, setSearch] = useState<Search>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [announcement, setAnnouncement] = useState("");
  const debounceTimer = useRef<number>(undefined);
  const loadingTimer = useRef<number>(undefined);
  const request = useRef<AbortController | null>(null);

  const listId = `${control.id}-suggestions`;
  const optionId = (index: number) => `${control.id}-option-${index}`;
  const films = search.status === "results" ? search.films : [];
  const listShown = open && films.length > 0;

  function cancel() {
    window.clearTimeout(debounceTimer.current);
    window.clearTimeout(loadingTimer.current);
    request.current?.abort();
    request.current = null;
  }

  // Leaving the page (e.g. after saving) drops any search still in flight.
  useEffect(() => cancel, []);

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId only depends on the field id, which doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function show(next: Search, message: string) {
    setSearch(next);
    setActive(-1);
    setOpen(next.status !== "idle");
    setAnnouncement(message);
  }

  function showFilms(results: Film[]) {
    if (results.length === 0) return show({ status: "empty" }, NOTHING_FOUND);
    const count = `${results.length} ${results.length === 1 ? "film" : "films"} found.`;
    show({ status: "results", films: results }, `${count} Use the up and down arrows to choose one.`);
  }

  async function run(query: string) {
    const key = query.toLowerCase();
    const cached = searchCache.get(key);
    if (cached) return showFilms(cached);

    const controller = new AbortController();
    request.current = controller;
    loadingTimer.current = window.setTimeout(() => show({ status: "loading" }, SEARCHING), LOADING_DELAY_MS);
    try {
      const response = await fetch(`/api/films/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Search answered ${response.status}`);
      const body: unknown = await response.json();
      const results = (body as { results?: unknown }).results;
      if (!Array.isArray(results)) throw new Error("Unexpected search response");
      if (request.current !== controller) return;
      searchCache.set(key, results as Film[]);
      window.clearTimeout(loadingTimer.current);
      showFilms(results as Film[]);
    } catch {
      // A newer search replaced this one; it reports its own result.
      if (request.current !== controller) return;
      window.clearTimeout(loadingTimer.current);
      show({ status: "unavailable" }, UNAVAILABLE);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    onType(text);
    cancel();
    setActive(-1);
    const query = cleanQuery(text);
    if (!query) return show({ status: "idle" }, "");
    debounceTimer.current = window.setTimeout(() => run(query), DEBOUNCE_MS);
  }

  function choose(chosen: Film) {
    cancel();
    onChoose(chosen);
    setSearch({ status: "idle" });
    setOpen(false);
    setActive(-1);
    setAnnouncement(`Chose ${chosen.title}${chosen.releaseYear ? ` (${chosen.releaseYear})` : ""}. Linked to iTunes.`);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const action = comboboxKey(e.key, { open, count: films.length, active });
    if (!action) return;
    if (action.prevent) e.preventDefault();
    if (action.type === "move") {
      setOpen(true);
      setActive(action.active);
    } else if (action.type === "select") {
      choose(films[action.index]);
    } else {
      setOpen(false);
      setActive(-1);
    }
  }

  function handleBlur() {
    setOpen(false);
    setActive(-1);
    onBlur();
  }

  function unlink() {
    setAnnouncement("No longer linked to iTunes.");
    onUnlink();
  }

  const message =
    !open || listShown
      ? ""
      : search.status === "loading"
        ? SEARCHING
        : search.status === "empty"
          ? NOTHING_FOUND
          : search.status === "unavailable"
            ? UNAVAILABLE
            : "";

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          {...control}
          ref={inputRef}
          name="title"
          type="text"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listShown}
          aria-controls={listShown ? listId : undefined}
          aria-activedescendant={listShown && active >= 0 ? optionId(active) : undefined}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={className}
        />
        {(listShown || message) && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-seam-strong bg-reel-raised shadow-lg shadow-night/60">
            {listShown ? (
              <ul id={listId} role="listbox" aria-label="Films on iTunes" className="py-1">
                {films.map((f, i) => (
                  <li
                    key={f.itunesId}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    // Keep focus in the input so the click isn't lost to blur.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(f)}
                    onMouseMove={() => setActive(i)}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 border-l-2 px-3 py-2 ${
                      i === active ? "border-amber bg-reel" : "border-transparent"
                    }`}
                  >
                    <Poster url={f.artworkUrl} width={32} />
                    <span className="min-w-0">
                      <span className="block font-serif text-lg leading-snug text-ivory">{f.title}</span>
                      {(f.releaseYear || f.director) && (
                        <span className="block text-sm text-parchment">
                          {[f.releaseYear, f.director].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`px-4 py-3 text-sm ${search.status === "unavailable" ? "text-ember" : "text-parchment"}`}>
                {message}
              </p>
            )}
          </div>
        )}
      </div>

      {film && (
        <div className="flex items-center gap-3 text-sm text-parchment">
          <Poster url={film.artworkUrl} width={32} />
          <p className="min-w-0 flex-1">
            Linked to iTunes{film.releaseYear ? ` · ${film.releaseYear}` : ""}
          </p>
          <Button variant="quiet" size="sm" onClick={unlink}>
            Unlink<span className="sr-only"> from iTunes</span>
          </Button>
        </div>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
