import { createClient } from "@supabase/supabase-js";

let client:
  | ReturnType<typeof createClient>
  | null = null;

export function getSupabaseBrowserClient() {
  if (import.meta.env.MODE === "e2e") {
    return null;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}
