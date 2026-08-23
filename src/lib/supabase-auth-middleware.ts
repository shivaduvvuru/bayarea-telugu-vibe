import { createMiddleware } from "@tanstack/react-start";

/**
 * Local replacement for the generated `attachSupabaseAuth`.
 *
 * Same behaviour — attach the reader's bearer token to serverFn RPCs — but the
 * auth client is imported dynamically so `@supabase/supabase-js` stays out of
 * the initial client bundle. Public pages (home, City News, article) never need
 * a session, and this middleware is registered globally in `src/start.ts`, so a
 * static import pulled the whole auth/realtime library into the entry chunk.
 */
export const attachSupabaseAuthLazy = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      token = undefined;
    }
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
