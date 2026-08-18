import { createClient } from "@supabase/supabase-js";

// The publishable key is safe in client code — it only ever grants what the
// row-level security policies allow. Env vars win so the project can be
// repointed (e.g. at a staging project) without touching source.
const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || "https://biauxcgphdhwewszupsq.supabase.co";
const SUPABASE_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Required for the password-recovery link: the token arrives in the URL
    // fragment and has to be exchanged for a session before the user can set
    // a new password.
    detectSessionInUrl: true,
    storageKey: "gs-auth",
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;

/**
 * The app must stay usable when the backend is unreachable (paused project,
 * offline laptop, a demo on conference wifi). Callers use this to decide
 * whether to fall back to local-only mode instead of showing a dead screen.
 */
let cloudReachable = null;

export async function pingCloud() {
  if (cloudReachable !== null) return cloudReachable;
  try {
    const { error } = await supabase.from("gs_teams").select("code").limit(1);
    // A permission error still means the server answered — that counts as up.
    cloudReachable = !error || error.code === "PGRST301" || error.code === "42501";
  } catch {
    cloudReachable = false;
  }
  return cloudReachable;
}

export function resetCloudPing() {
  cloudReachable = null;
}
