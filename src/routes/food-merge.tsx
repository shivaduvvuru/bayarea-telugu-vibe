import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkDesk } from "@/lib/desk-gate.functions";
import {
  listRestaurantDuplicates,
  mergeRestaurantDuplicates,
} from "@/lib/food-dupes.functions";
import type { Restaurant } from "@/lib/food";

const TITLE = "Restaurant duplicate merge — editorial desk | Times Bay Area";
const DESC =
  "Editorial tool: review restaurant listings detected as duplicates and merge them into one profile.";

export const Route = createFileRoute("/food-merge")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MergePage,
});

type Group = { primary: Restaurant; duplicates: Restaurant[]; reason: string };

function MergePage() {
  const doCheck = useServerFn(checkDesk);
  const doList = useServerFn(listRestaurantDuplicates);
  const doMerge = useServerFn(mergeRestaurantDuplicates);
  const [token, setToken] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(
    async (deskToken: string) => {
      try {
        setError("");
        const res = await doList({ data: { deskToken } });
        setGroups(res.groups as Group[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load duplicates.");
      }
    },
    [doList],
  );

  useEffect(() => {
    doCheck()
      .then((res) => {
        if (!res.unlocked) {
          setToken("");
          return;
        }
        setToken(res.deskToken ?? "");
        void load(res.deskToken ?? "");
      })
      .catch(() => setToken(""));
  }, [doCheck, load]);

  async function merge(group: Group) {
    const ids = [group.primary, ...group.duplicates].map((r) => r.id);
    const primaryId = keep[group.primary.id] ?? group.primary.id;
    setBusy(group.primary.id);
    try {
      const res = await doMerge({
        data: {
          primaryId,
          duplicateIds: ids.filter((id) => id !== primaryId),
          deskToken: token ?? "",
        },
      });
      setNote(`Merged ${res.merged} duplicate listing${res.merged === 1 ? "" : "s"}.`);
      await load(token ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The merge did not complete.");
    } finally {
      setBusy("");
    }
  }

  if (token === null) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Checking desk access…</p>;
  }

  if (token === "") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-lg font-extrabold text-ink">Restaurant duplicate merge</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock the editorial desk first, then come back to this page.
        </p>
        <Link to="/desk" className="mt-3 inline-block text-sm font-semibold text-primary underline">
          Go to the editorial desk
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <h1 className="text-lg font-extrabold text-ink">Restaurant duplicate merge</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Readers already see only the most complete listing in each group. Merging makes it permanent
        and moves ratings, reviews and deals onto the listing you keep.
      </p>
      {note && <p className="mt-2 text-sm font-semibold text-emerald-600">{note}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {groups == null && <p className="mt-4 text-sm text-muted-foreground">Scanning the directory…</p>}
      {groups != null && groups.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No duplicates detected right now.</p>
      )}

      {(groups ?? []).map((group) => {
        const all = [group.primary, ...group.duplicates];
        const selected = keep[group.primary.id] ?? group.primary.id;
        return (
          <section key={group.primary.id} className="mt-4 rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{group.reason}</p>
            <ul className="mt-2 space-y-2">
              {all.map((r) => (
                <li key={r.id} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name={`keep-${group.primary.id}`}
                    checked={selected === r.id}
                    onChange={() => setKeep((prev) => ({ ...prev, [group.primary.id]: r.id }))}
                    className="mt-1"
                    aria-label={`Keep ${r.name}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {r.name}
                      {r.branch_label ? ` — ${r.branch_label}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[r.city, r.address, r.website_url, r.phone].filter(Boolean).join(" • ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.cuisines.join(", ") || "No cuisines"} • {r.photos.length} photos •{" "}
                      {r.verified ? "verified" : "unverified"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void merge(group)}
              disabled={busy === group.primary.id}
              className="mt-3 min-h-10 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy === group.primary.id ? "Merging…" : "Merge into the selected listing"}
            </button>
          </section>
        );
      })}
    </div>
  );
}
