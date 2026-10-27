import type { Metadata } from "next";
import EntryForm from "@/components/EntryForm";

export const metadata: Metadata = {
  title: "Log a film",
};

export default function LogPage() {
  return (
    <div className="animate-settle">
      <p className="text-sm tracking-[0.2em] text-amber uppercase">New entry</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight text-ivory sm:text-5xl">What did you watch?</h1>
      <p className="mt-3 max-w-prose text-parchment">
        Write it down while the lights are still coming up. It&rsquo;s saved privately to your account.
      </p>
      <div className="mt-10">
        <EntryForm />
      </div>
    </div>
  );
}
