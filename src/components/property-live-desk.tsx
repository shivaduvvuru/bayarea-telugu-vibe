import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  deleteLivePostFn,
  listLivePostsFn,
  saveLivePostFn,
} from "@/lib/property.functions";
import { LIVE_POST_KINDS, type LivePost, type LivePostKind } from "@/lib/property";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Editor tooling for "Live from the venue": publish a photo, short video or
 * booth highlight straight into the campaign page, no redeploy needed.
 */
export function PropertyLiveDesk({
  campaignSlug,
  deskToken,
}: {
  campaignSlug: string;
  deskToken: string;
}) {
  const [posts, setPosts] = useState<LivePost[]>([]);
  const [kind, setKind] = useState<LivePostKind>("photo");
  const [busy, setBusy] = useState(false);
  const list = useServerFn(listLivePostsFn);
  const save = useServerFn(saveLivePostFn);
  const remove = useServerFn(deleteLivePostFn);

  const load = useCallback(async () => {
    const res = await list({ data: { campaignSlug, deskToken } }).catch(() => null);
    setPosts((res?.posts ?? []) as LivePost[]);
  }, [campaignSlug, deskToken, list]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="mt-6 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Live from the venue</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Posts appear on the campaign page within a minute. Paste a hosted image or video URL —
        nothing is deployed.
      </p>

      <form
        className="mt-3 grid gap-2 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const str = (k: string) => {
            const v = String(fd.get(k) ?? "").trim();
            return v.length > 0 ? v : undefined;
          };
          const title = str("title");
          if (!title) return;
          setBusy(true);
          const res = await save({
            data: {
              deskToken,
              campaignSlug,
              kind,
              title,
              body: str("body"),
              mediaUrl: str("mediaUrl"),
              posterUrl: str("posterUrl"),
              developer: str("developer"),
              booth: str("booth"),
              status: fd.get("draft") === "on" ? "draft" : "published",
              pinned: fd.get("pinned") === "on",
            },
          }).catch(() => null);
          setBusy(false);
          if (res?.ok) {
            toast.success("Posted");
            form.reset();
            void load();
          } else {
            toast.error("Could not publish that update");
          }
        }}
      >
        <div className="sm:col-span-2 flex flex-wrap gap-1.5">
          {LIVE_POST_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                kind === k.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-ink"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <Input name="title" placeholder="Headline" aria-label="Headline" required />
        <Input name="developer" placeholder="Developer (optional)" aria-label="Developer" />
        <Input
          name="mediaUrl"
          placeholder={kind === "video" ? "Video URL (mp4)" : "Image URL"}
          aria-label="Media URL"
        />
        <Input name="posterUrl" placeholder="Video poster image URL (optional)" aria-label="Poster URL" />
        <Input name="booth" placeholder="Booth number (optional)" aria-label="Booth" />
        <Textarea
          name="body"
          placeholder="One or two lines of context"
          aria-label="Body"
          className="sm:col-span-2"
        />
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" name="pinned" /> Pin to the top
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" name="draft" /> Save as draft
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            Publish update
          </Button>
        </div>
      </form>

      <ul className="mt-4 space-y-2">
        {posts.length === 0 ? (
          <li className="text-sm text-muted-foreground">No live updates yet.</li>
        ) : null}
        {posts.map((p) => (
          <li
            key={p.id}
            className="flex items-start justify-between gap-3 border-t border-border pt-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {p.pinned ? "📌 " : ""}
                {p.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {[p.kind, p.developer, p.booth ? `Booth ${p.booth}` : null, p.status]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const res = await remove({ data: { deskToken, id: p.id } }).catch(() => null);
                if (res?.ok) {
                  toast.success("Removed");
                  void load();
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">Delete</span>
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
