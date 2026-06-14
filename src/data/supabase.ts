import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key is safe to ship in a static client — RLS allows read-only access.
const url = import.meta.env.VITE_SUPABASE_URL || "https://pkzlcfkupayzqphxjjgi.supabase.co";
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_OPp3qRTTno8kyl2ZCMtOLg_sLiK0J2b";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
