import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  claimFirstAdmin,
  createItem,
  listReviewQueue,
  myAccess,
  reviewItems,
} from "@/lib/cms.functions";
import { CONTENT_KINDS, PLACEMENTS, type ContentItem } from "@/lib/cms";
import { listForumQueue, moderateForum } from "@/lib/forum.functions";
import { categoryLabel } from "@/lib/forum";
import { listClaims, reviewClaim } from "@/lib/claims.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Newsroom CMS — Bay Area Telugu Times" },
      {
        name: "description",
        content:
          "Review automatically pulled Bay Area headlines, approve community submissions and publish new stories, events and ads.",
      },
      { property: "og:title", content: "Newsroom CMS — Bay Area Telugu Times" },
      { property: "og:description", content: "Content review and publishing console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function DuplicateAlert() {
  const list = useServerFn(listReviewQueue);
  const query = useQuery({
    queryKey: ["cms", "queue", "duplicate"],
    queryFn: () => list({ data: { status: "duplicate", limit: 200 } }),
  });
  const count = query.data?.length ?? 0;
  if (count === 0) return null;
  return (
    <div
      role="alert"
      className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
    >
      <strong>{count} duplicate {count === 1 ? "item was" : "items were"} blocked.</strong>{" "}
      They repeat a headline or listing already on the site and were kept out of public
      pages automatically. Open the Duplicates tab to review or publish one anyway.
    </div>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const access = useServerFn(myAccess);
  const claim = useServerFn(claimFirstAdmin);

  const accessQuery = useQuery({ queryKey: ["cms", "access"], queryFn: () => access({}) });

  const claimMutation = useMutation({
    mutationFn: () => claim({}),
    onSuccess: () => {
      toast.success("You are now the site administrator.");
      qc.invalidateQueries({ queryKey: ["cms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (accessQuery.isLoading) {
    return <p className="px-4 py-16 text-center text-muted-foreground">Loading newsroom…</p>;
  }

  if (!accessQuery.data?.isStaff) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-serif text-2xl">No editor access yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account is signed in but has no newsroom role. If you are setting the site up
          for the first time, claim the administrator seat below — it can only be claimed once.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending}>
            Claim administrator
          </Button>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Newsroom CMS</h1>
          <p className="text-sm text-muted-foreground">
            Pulled headlines publish automatically — remove anything that should not run.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/health">Source health</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <DuplicateAlert />

      <Tabs defaultValue="pulled" className="mt-8">
        <TabsList>
          <TabsTrigger value="pulled">Pulled headlines</TabsTrigger>
          <TabsTrigger value="pending">Submissions</TabsTrigger>
          <TabsTrigger value="duplicate">Duplicates</TabsTrigger>
          <TabsTrigger value="removed">Removed</TabsTrigger>
          <TabsTrigger value="forums">Forum moderation</TabsTrigger>
          <TabsTrigger value="claims">Directory claims</TabsTrigger>
          <TabsTrigger value="compose">Publish new</TabsTrigger>
        </TabsList>
        <TabsContent value="pulled">
          <Queue title="Automatically pulled" status="published" />
        </TabsContent>
        <TabsContent value="pending">
          <Queue title="Awaiting approval" status="pending" />
        </TabsContent>
        <TabsContent value="duplicate">
          <Queue title="Blocked as duplicates" status="duplicate" />
        </TabsContent>
        <TabsContent value="removed">
          <Queue title="Removed from the site" status="removed" />
        </TabsContent>
        <TabsContent value="forums">
          <ForumModeration />
        </TabsContent>
        <TabsContent value="claims">
          <DirectoryClaims />
        </TabsContent>
        <TabsContent value="compose">
          <Compose />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Business owners claiming their directory listing and fixing city/hours. */
function DirectoryClaims() {
  const qc = useQueryClient();
  const list = useServerFn(listClaims);
  const act = useServerFn(reviewClaim);
  const [bucket, setBucket] = useState<"pending" | "approved" | "rejected">("pending");

  const query = useQuery({
    queryKey: ["claims", bucket],
    queryFn: () => list({ data: { status: bucket } }),
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: "approved" | "rejected" }) => act({ data: vars }),
    onSuccess: () => {
      toast.success("Claim updated.");
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["directory", "claim-overrides"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claims = query.data ?? [];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as const).map((b) => (
          <Button
            key={b}
            size="sm"
            variant={bucket === b ? "default" : "outline"}
            onClick={() => setBucket(b)}
          >
            {b === "pending" ? "Awaiting verification" : b === "approved" ? "Live" : "Rejected"}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading claims…</p>
      ) : claims.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing in this bucket.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {claims.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-card p-4">
              <p className="text-sm font-bold text-foreground">{c.listing_title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.claimant_name} ({c.claimant_role ?? "owner"}) · {c.claimant_email}
                {c.claimant_phone ? ` · ${c.claimant_phone}` : ""}
              </p>
              <dl className="mt-3 grid gap-1 text-xs text-foreground sm:grid-cols-2">
                {(
                  [
                    ["City", c.city],
                    ["Address", c.address],
                    ["Hours", c.hours],
                    ["Phone", c.phone],
                    ["Website", c.website],
                    ["Notes", c.notes],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="inline font-semibold">{k}: </dt>
                      <dd className="inline">{v}</dd>
                    </div>
                  ))}
              </dl>
              {bucket === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => mutation.mutate({ id: c.id, status: "approved" })}
                  >
                    Approve corrections
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mutation.mutate({ id: c.id, status: "rejected" })}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The two AI buckets: "review" holds everything the monitor was unsure about,
 * "approved" is what readers can see. Editors move posts between them.
 */
function ForumModeration() {
  const qc = useQueryClient();
  const list = useServerFn(listForumQueue);
  const act = useServerFn(moderateForum);
  const [bucket, setBucket] = useState<"review" | "approved" | "rejected">("review");

  const query = useQuery({
    queryKey: ["forum", "queue", bucket],
    queryFn: () => list({ data: { status: bucket } }),
  });

  const mutation = useMutation({
    mutationFn: (vars: {
      table: "threads" | "replies";
      ids: string[];
      status: "approved" | "review" | "rejected";
    }) => act({ data: vars }),
    onSuccess: () => {
      toast.success("Forum queue updated.");
      qc.invalidateQueries({ queryKey: ["forum"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const threads = query.data?.threads ?? [];
  const replies = query.data?.replies ?? [];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {(["review", "approved", "rejected"] as const).map((b) => (
          <Button
            key={b}
            size="sm"
            variant={bucket === b ? "default" : "outline"}
            onClick={() => setBucket(b)}
          >
            {b === "review" ? "Needs a human" : b === "approved" ? "Live" : "Rejected"}
          </Button>
        ))}
      </div>

      {query.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!query.isLoading && threads.length === 0 && replies.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">Nothing in this bucket.</p>
      )}

      {threads.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Discussions</h2>
          <ul className="mt-3 space-y-3">
            {threads.map((t) => (
              <li key={t.id} className="rounded-md border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {categoryLabel(t.category).en}
                  {t.city ? ` · ${t.city}` : ""} · {t.author_name}
                </p>
                <p className="mt-1 font-semibold">{t.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  AI: {t.ai_action ?? "—"} · {t.ai_reason ?? "no note"}
                  {t.ai_labels?.length ? ` · ${t.ai_labels.join(", ")}` : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    disabled={mutation.isPending || t.status === "approved"}
                    onClick={() =>
                      mutation.mutate({ table: "threads", ids: [t.id], status: "approved" })
                    }
                  >
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending || t.status === "rejected"}
                    onClick={() =>
                      mutation.mutate({ table: "threads", ids: [t.id], status: "rejected" })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {replies.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Replies</h2>
          <ul className="mt-3 space-y-3">
            {replies.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {r.author_name}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  AI: {r.ai_action ?? "—"} · {r.ai_reason ?? "no note"}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    disabled={mutation.isPending || r.status === "approved"}
                    onClick={() =>
                      mutation.mutate({ table: "replies", ids: [r.id], status: "approved" })
                    }
                  >
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending || r.status === "rejected"}
                    onClick={() =>
                      mutation.mutate({ table: "replies", ids: [r.id], status: "rejected" })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Queue({
  title,
  status,
}: {
  title: string;
  status: "published" | "pending" | "removed" | "duplicate";
}) {
  const qc = useQueryClient();
  const list = useServerFn(listReviewQueue);
  const review = useServerFn(reviewItems);
  const [selected, setSelected] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["cms", "queue", status],
    queryFn: () => list({ data: { status, limit: 200 } }),
  });

  const mutation = useMutation({
    mutationFn: (next: "published" | "pending" | "removed" | "duplicate") =>
      review({ data: { ids: selected, status: next } }),
    onSuccess: (_r, next) => {
      toast.success(
        next === "removed" ? "Removed from the site." : "Published to the site.",
      );
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["cms", "queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = query.data ?? [];
  const allIds = useMemo(() => items.map((i) => i.id), [items]);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">
          {title} <span className="text-muted-foreground">({items.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelected(selected.length === allIds.length ? [] : allIds)}
            disabled={items.length === 0}
          >
            {selected.length === allIds.length && items.length > 0 ? "Clear" : "Select all"}
          </Button>
          {status !== "removed" && (
            <Button
              size="sm"
              variant="destructive"
              disabled={selected.length === 0 || mutation.isPending}
              onClick={() => mutation.mutate("removed")}
            >
              Remove {selected.length || ""}
            </Button>
          )}
          {status !== "published" && (
            <Button
              size="sm"
              disabled={selected.length === 0 || mutation.isPending}
              onClick={() => mutation.mutate("published")}
            >
              Approve &amp; publish {selected.length || ""}
            </Button>
          )}
        </div>
      </div>

      {query.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing here right now.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              checked={selected.includes(item.id)}
              onToggle={() =>
                setSelected((s) =>
                  s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id],
                )
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueRow({
  item,
  checked,
  onToggle,
}: {
  item: ContentItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start gap-3 p-3">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.source} · {item.kind}
          {item.city ? ` · ${item.city}` : ""}
          {item.published_at || item.created_at
            ? ` · ${new Date(item.published_at ?? item.created_at).toLocaleDateString()}`
            : ""}
        </p>
        {item.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
        )}
        {item.link_url && (
          <a
            href={item.link_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
          >
            Open source page
          </a>
        )}
      </div>
    </li>
  );
}

function Compose() {
  const qc = useQueryClient();
  const create = useServerFn(createItem);
  const [form, setForm] = useState({
    kind: "news",
    placement: "auto",
    title: "",
    summary: "",
    body: "",
    image_url: "",
    link_url: "",
    city: "",
    venue: "",
    event_start: "",
  });

  const mutation = useMutation({
    mutationFn: () => create({ data: form as never }),
    onSuccess: () => {
      toast.success("Published.");
      setForm({ ...form, title: "", summary: "", body: "", image_url: "", link_url: "" });
      qc.invalidateQueries({ queryKey: ["cms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="mt-6 grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="kind">Type</Label>
        <select
          id="kind"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.kind}
          onChange={(e) => set("kind", e.target.value)}
        >
          {CONTENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="placement">Placement</Label>
        <select
          id="placement"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={form.placement}
          onChange={(e) => set("placement", e.target.value)}
        >
          {PLACEMENTS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="title">Headline</Label>
        <Input id="title" required value={form.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="summary">Summary</Label>
        <Input id="summary" value={form.summary} onChange={(e) => set("summary", e.target.value)} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="body">Story</Label>
        <Textarea id="body" rows={8} value={form.body} onChange={(e) => set("body", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="venue">Venue</Label>
        <Input id="venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="event_start">Event date &amp; time</Label>
        <Input
          id="event_start"
          type="datetime-local"
          value={form.event_start}
          onChange={(e) => set("event_start", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="image_url">Image URL</Label>
        <Input id="image_url" value={form.image_url} onChange={(e) => set("image_url", e.target.value)} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="link_url">Link</Label>
        <Input id="link_url" value={form.link_url} onChange={(e) => set("link_url", e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Publishing…" : "Publish now"}
        </Button>
      </div>
    </form>
  );
}