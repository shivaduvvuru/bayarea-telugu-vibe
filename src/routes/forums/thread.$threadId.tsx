import { CityConnections } from "@/components/city-connections";
import { useState } from "react";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createReply, getThread } from "@/lib/forum.functions";
import { categoryLabel } from "@/lib/forum";
import { RelativeDate } from "@/components/news";
import { supabase } from "@/integrations/supabase/client";

const threadQuery = (id: string) =>
  queryOptions({
    queryKey: ["forum", "thread", id],
    queryFn: () => getThread({ data: { id } }),
    staleTime: 30 * 1000,
  });

export const Route = createFileRoute("/forums/thread/$threadId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(threadQuery(params.threadId));
    if (!data.thread) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.thread
      ? `${loaderData.thread.title} — Bay Area Telugu Forums`
      : "Discussion — Bay Area Telugu Forums";
    const description =
      loaderData?.thread?.body.slice(0, 155) ??
      "A discussion in the Bay Area Telugu community forums.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        This discussion is not available. It may be waiting for an editor.
      </p>
      <Link to="/forums" className="mt-4 inline-block text-sm font-semibold text-primary">
        Back to the forums
      </Link>
    </div>
  ),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(threadQuery(threadId));
  const router = useRouter();
  const reply = useServerFn(createReply);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { data: session } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
    staleTime: 60 * 1000,
  });

  const thread = data.thread!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await reply({ data: { thread_id: threadId, body } });
      setBody("");
      setMsg(
        res.status === "approved"
          ? "Posted."
          : `Thanks — an editor will review this reply first. ${res.reason}`,
      );
      if (res.status === "approved") router.invalidate();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/forums" className="text-xs font-semibold uppercase tracking-widest text-primary">
        ← Forums
      </Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">
        {categoryLabel(thread.category).en}
        {thread.city ? ` · ${thread.city}` : ""}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-ink">{thread.title}</h1>
      <p className="mt-2 flex gap-3 text-xs text-muted-foreground">
        <span>{thread.author_name}</span>
        <RelativeDate iso={thread.created_at} />
      </p>
      <div className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-foreground">
        {thread.body}
      </div>

      <h2 className="mt-10 border-b-2 border-primary pb-1.5 text-sm font-bold uppercase tracking-wide text-ink">
        {data.replies.length} {data.replies.length === 1 ? "reply" : "replies"}
      </h2>
      <ul className="divide-y divide-border">
        {data.replies.map((r) => (
          <li key={r.id} className="py-4">
            <p className="flex gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-ink">{r.author_name}</span>
              <RelativeDate iso={r.created_at} />
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-7 text-foreground">
              {r.body}
            </p>
          </li>
        ))}
      </ul>

      {session ? (
        <form onSubmit={submit} className="mt-8 border border-border bg-card p-5">
          <label className="block text-sm font-semibold text-ink">
            Add your reply
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={2}
              maxLength={4000}
              rows={4}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Checking…" : "Post reply"}
          </button>
          {msg && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              {msg}
            </p>
          )}
        </form>
      ) : (
        <Link
          to="/auth"
          className="mt-8 inline-block bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Sign in to reply
        </Link>
      )}

      {thread.city && <CityConnections city={thread.city} />}
    </div>
  );
}