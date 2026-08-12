import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Stay signed in: a stored session is enough. supabase-js refreshes tokens
    // in the background, so we never call the auth server here — a flaky or
    // slow network must never bounce an editor out of the desk.
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) throw redirect({ to: "/auth" });
    return { user: session.user };
  },

  component: () => <Outlet />,
});