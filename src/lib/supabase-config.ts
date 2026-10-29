// Supabase-projectconfiguratie, los van de client zodat modules die alleen
// deze waarden nodig hebben (lib/offline-auth.ts) de client niet meeladen.

export const SUPABASE_URL = "https://lrqivcfuiuskqkpmyxfo.supabase.co";

// supabase-js' default storage key (`sb-<project-ref>-auth-token`). Only read
// by lib/offline-auth.ts; the client itself keeps using its own default.
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
