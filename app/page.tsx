import { Suspense } from "react";
import Diary from "@/components/Diary";

export default function Home() {
  return (
    <Suspense>
      <Diary />
    </Suspense>
  );
}
