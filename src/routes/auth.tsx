import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Editor sign in — Times Bay Area" },
      {
        name: "description",
        content:
          "Sign in to the Times Bay Area newsroom to review pulled headlines, approve community submissions and publish local stories.",
      },
      { property: "og:title", content: "Editor sign in — Times Bay Area" },
      {
        property: "og:description",
        content: "Newsroom access for Times Bay Area editors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  // Until React has hydrated, a click submits the form natively and reloads the
  // page — which looked like sign-in "hanging". Gate the button on this flag.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    let active = true;
    // Already signed in (or a session lands mid-page, e.g. after OAuth): go in.
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        setStatus({ type: "success", message: "Signed in. Opening desk…" });
        navigate({ to: "/desk", replace: true });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setStatus({ type: "success", message: "Signed in. Opening desk…" });
        navigate({ to: "/desk", replace: true });
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus({ type: "loading", message: mode === "signup" ? "Creating account…" : "Signing in…" });
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setStatus({ type: "success", message: "Check your email to confirm your account." });
          toast.success("Check your email to confirm your account.");
          return;
        }
        setStatus({ type: "success", message: "Account created. Opening desk…" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setStatus({ type: "success", message: "Signed in. Opening desk…" });
      }
      navigate({ to: "/desk" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setStatus({ type: "error", message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setStatus({ type: "loading", message: "Opening Google sign-in…" });
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setStatus({ type: "error", message: result.error.message ?? "Google sign in failed" });
        toast.error(result.error.message ?? "Google sign in failed");
        return;
      }
      if (result.redirected) {
        setStatus({ type: "loading", message: "Waiting for Google…" });
        return;
      }
      setStatus({ type: "success", message: "Signed in. Opening desk…" });
      navigate({ to: "/desk" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign in failed";
      setStatus({ type: "error", message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="font-serif text-3xl">Newsroom sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For Times Bay Area editors. Community members can post without an account
          from the Submit page.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        <Button type="submit" disabled={busy || !ready} className="gap-2">
          {!ready ? (
            "Loading page…"
          ) : busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === "signin" ? "Signing in…" : "Creating account…"}
            </>
          ) : mode === "signin" ? (
            "Sign in"
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      {status.type !== "idle" ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
            status.type === "loading" && "border-border bg-muted/50 text-foreground",
            status.type === "success" && "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-100",
            status.type === "error" && "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100",
          )}
          role="status"
          aria-live="polite"
        >
          {status.type === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status.type === "success" && <span aria-hidden="true">✓</span>}
          {status.type === "error" && <span aria-hidden="true">✕</span>}
          <span>{status.message}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" disabled={busy || !ready} onClick={onGoogle} className="gap-2">
        {!ready ? (
          "Loading page…"
        ) : busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening Google…
          </>
        ) : (
          "Continue with Google"
        )}
      </Button>
      <button
        type="button"
        className="text-sm text-primary underline-offset-4 hover:underline"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setStatus({ type: "idle" });
        }}
        disabled={busy}
      >
        {mode === "signin"
          ? "Need an editor account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}