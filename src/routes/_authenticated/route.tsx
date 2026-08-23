import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Stay signed in: a stored session is enough. supabase-js refreshes tokens
    // in the background, so we never call the auth server here — a flaky or
    // slow network must never bounce an editor out of the desk.
    // Imported here rather than at module scope: beforeLoad is critical route
    // code, so a static import shipped the auth library in the entry bundle for
    // every anonymous reader.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) throw redirect({ to: "/auth" });
    return { user: session.user };
  },

  component: () => <Outlet />,
});