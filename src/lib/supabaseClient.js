import { createClient } from "@supabase/supabase-js";

// Mismo proyecto de Supabase que usa el sistema actual (index.html) y el
// módulo de odontograma embebido. La anon key es pública por diseño de
// Supabase (queda protegida por RLS en cada tabla), igual que en el sistema
// original — no es un secreto que haya que ocultar.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://cjpscqyfzevzwpupmmiv.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHNjcXlmemV2endwdXBtbWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Njk5OTIsImV4cCI6MjA5OTU0NTk5Mn0.m1MBAWevVLizSvLjJT35jX1qoJxnjQ1vrVEIwJ--HLs";

export const AUTH_STORAGE_KEY = "dentflow-auth-v1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: AUTH_STORAGE_KEY,
    flowType: "pkce",
  },
});
