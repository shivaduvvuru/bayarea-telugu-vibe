import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { createThread, listThreads } from "@/lib/forum.functions";
import { FORUM_CATEGORIES, categoryLabel } from "@/lib/forum";
import { CITY_REGIONS } from "@/lib/content";
import { RelativeDate } from "@/components/news";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Bay Area Telugu Community Forums | Times Bay Area"
const DESC =
  "Ask and answer questions with Telugu families across the Bay Area — housing, jobs, visas, schools, temples, events and local recommendations.";

const threadsQuery = queryOptions({
  queryKey: ["forum", "threads"],
  queryFn: () => listThreads({ data: { limit: 60 } }),
  staleTime: 60 * 1000,
});

export const Route = createFileRoute("/forums/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(threadsQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">No discussions yet.</p>
    </div>
  ),
  component: ForumsPage,
});

const ALL_CITIES = CITY_REGIONS.flatMap((r) => r.cities.map((c) => c.en));

function NewThreadForm({ onDone }: { onDone: () => void }) {
  const post = useServerFn(createThread);
  const [category, setCategory] = useState<string>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "held" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await post({ data: { category, title, body, city } });
      if (res.status === "approved") {
        setMsg({ kind: "ok", text: "Posted. Your discussion is live." });
        onDone();
      } else {
        setMsg({
          kind: "held",
          text: `Thanks — an editor will look at this first. ${res.reason}`,
        });
      }
      setTitle("");
      setBody("");
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-foreground";

  return (
    <form onSubmit={submit} className="border border-border bg-card p-5">
      <h2 className="text-lg font-bold text-ink">Start a discussion</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink">
          Topic
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={field}
          >
            {FORUM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-ink">
          City (optional)
          <select value={city} onChange={(e) => setCity(e.target.value)} className={field}>
            <option value="">All Bay Area</option>
            {ALL_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-sm font-semibold text-ink">
        Question or subject
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={8}
          maxLength={140}
          placeholder="Best Telugu classes for kids in Fremont?"
          className={field}
        />
      </label>
      <label className="mt-4 block text-sm font-semibold text-ink">
        Details
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={20}
          maxLength={6000}
          rows={5}
          className={field}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Checking\u2026" : "Post discussion"}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Every post is screened by our AI monitor before it appears.
        </span>
      </div>
      {msg && (
        <p
          role="status"
          className={`mt-3 text-sm ${msg.kind === "err" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}

function ForumsPage() {
  const { data: threads } = useSuspenseQuery(threadsQuery);
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const { data: session } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: 60 * 1000,
  });

  const shown = filter === "all" ? threads : threads.filter((t) => t.category === filter);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Community</p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">Bay Area Telugu Forums</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">
        Ask neighbours about housing, schools, visas, jobs, temples and the best tiffin in town.
        Posts that clear the AI monitor go live instantly; anything it is unsure about waits for
        an editor.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`border px-3 py-1.5 text-xs font-semibold ${filter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
        >
          All topics
        </button>
        {FORUM_CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`border px-3 py-1.5 text-xs font-semibold ${filter === c.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            {c.en}
          </button>
        ))}
      </div>

      <div className="mt-6 divide-y divide-border border border-border bg-card">
        {shown.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            No discussions here yet — be the first to ask something.
          </p>
        )}
        {shown.map((t) => (
          <article key={t.id} className="p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {categoryLabel(t.category).en}
              {t.city ? ` \u00b7 ${t.city}` : ""}
            </p>
            <h2 className="mt-1 text-base font-bold text-ink">
              <Link
                to="/forums/thread/$threadId"
                params={{ threadId: t.id }}
                className="hover:text-primary"
              >
                {t.title}
              </Link>
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
            <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{t.author_name}</span>
              <RelativeDate iso={t.last_activity_at} />
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                {t.reply_count}
              </span>
            </p>
          </article>
        ))}
      </div>

      <div className="mt-10">
        {session ? (
          <NewThreadForm onDone={() => router.invalidate()} />
        ) : (
          <div className="border border-border bg-surface-tint p-6">
            <h2 className="text-lg font-bold text-ink">Join the conversation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to post a question or reply. We ask for an account so the forums stay
              spam-free and accountable.
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-block bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Sign in to post
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}