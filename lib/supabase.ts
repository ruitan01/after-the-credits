"use client";

import { useAuth } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

// Browser-only client. It uses the publishable key plus the signed-in user's
// Clerk session token; Postgres row-level security decides which rows that
// user may touch. Never use a secret / service-role key here.
function createDiaryClient(getToken: () => Promise<string | null>): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }
  // Clerk refreshes its short-lived token; asking for it per request keeps it current.
  return createClient(url, key, { accessToken: getToken });
}

/** The diary's Supabase client, or null until Clerk has loaded a signed-in session. */
export function useSupabase(): SupabaseClient | null {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  return useMemo(
    () => (isLoaded && isSignedIn ? createDiaryClient(() => getToken()) : null),
    [isLoaded, isSignedIn, getToken],
  );
}
