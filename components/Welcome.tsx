import { ButtonLink } from "@/components/ui";

/** The signed-out home page: what the diary is, and how to start one. */
export default function Welcome() {
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
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <ButtonLink href="/sign-up" size="lg">
          Start your diary <span aria-hidden="true">→</span>
        </ButtonLink>
        <ButtonLink href="/sign-in" variant="quiet" size="lg">
          I already have one
        </ButtonLink>
      </div>
      <p className="mt-6 flex items-center gap-2 text-sm text-parchment">
        <span aria-hidden="true">◐</span>
        Your diary is private. Only you can see what you log.
      </p>
    </section>
  );
}
