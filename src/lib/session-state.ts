import { useEffect, useState } from "react";

/**
 * Signed-in flag for the shared chrome (header + mobile tab bar).
 *
 * The auth client is loaded dynamically after hydration so the auth library is
 * not part of the initial bundle for readers, who are almost always anonymous.
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSignedIn(Boolean(data.session));
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
          setSignedIn(Boolean(session)),
        );
        unsubscribe = () => sub.subscription.unsubscribe();
      } catch {
        /* anonymous reader: nothing to show */
      }
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return signedIn;
}

/** Ends the editor session; imported lazily for the same bundle reason. */
export async function signOutSession() {
  const { supabase } = await import("@/integrations/supabase/client");
  await supabase.auth.signOut();
}
