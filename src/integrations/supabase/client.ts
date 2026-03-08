// NOTE (migration MySQL): compatibility stub.
// We keep this file so old imports don't crash the app at startup.
// Once the migration is complete, remove this file and uninstall @supabase/supabase-js.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : (null as any);

export const isSupabaseEnabled = !!(SUPABASE_URL && SUPABASE_KEY);

if (!isSupabaseEnabled) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase disabled (missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). " +
      "This is expected during MySQL migration. Make sure no runtime code calls supabase.*"
  );
}