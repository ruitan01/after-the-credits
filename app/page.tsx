import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import Diary from "@/components/Diary";
import Welcome from "@/components/Welcome";

export default async function Home() {
  // Decided on the server, so a signed-out visitor never receives the diary at all.
  const { userId } = await auth();
  if (!userId) return <Welcome />;

  return (
    <Suspense>
      <Diary />
    </Suspense>
  );
}
