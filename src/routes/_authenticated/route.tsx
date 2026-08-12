import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Keep editors signed in: a stored session is enough to stay in. Only a
    // genuinely absent/expired session sends you back to /auth — a flaky
    // network call to the auth server must never log you out.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw redirect({ to: "/auth" });

    const { data, error } = await supabase.auth.getUser();
    if (data?.user) return { user: data.user };
    // Token rejected (revoked / truly expired) → sign in again. Anything else
    // (offline, timeout, 5xx) keeps the stored session.
    const status = (error as { status?: number } | null)?.status;
    if (status === 401 || status === 403) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: () => <Outlet />,
});