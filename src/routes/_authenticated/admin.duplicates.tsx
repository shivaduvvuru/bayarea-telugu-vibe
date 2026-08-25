import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listDuplicates } from "@/lib/duplicates-audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/duplicates")({
  head: () => ({
    meta: [
      { title: "Duplicate audit — Times Bay Area" },
      {
        name: "description",
        content:
          "Audit every story the duplicate guard collapsed: canonical links, normalised headlines and the original each repeat points at.",
      },
      { property: "og:title", content: "Duplicate audit — Times Bay Area" },
      { property: "og:description", content: "Newsroom duplicate detection audit log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DuplicateAuditPage,
});

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

const PAGE = 50;

function DuplicateAuditPage() {
  const load = useServerFn(listDuplicates);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: ["duplicate-audit", term, offset],
    queryFn: () => load({ data: { search: term, limit: PAGE, offset } }),
    staleTime: 60_000,
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link to="/admin" className="underline">
          Admin
        </Link>{" "}
        / Duplicate audit
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Duplicate audit</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every story marked as a repeat, paired with the original it collapsed into.{" "}
        {total.toLocaleString()} marked duplicate ·{" "}
        {(query.data?.rejectedLogged ?? 0).toLocaleString()} rejected before insert.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setTerm(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search headline, canonical link or source"
          aria-label="Search duplicates"
        />
        <Button type="submit">Search</Button>
        <Button type="button" variant="outline" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </form>

      {query.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading duplicates…</p>
      ) : query.isError ? (
        <p className="mt-8 text-sm text-destructive">
          Could not load duplicates: {(query.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No duplicates match this view.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Duplicate</th>
                <th className="px-3 py-2">Original (duplicate_of)</th>
                <th className="px-3 py-2">Canonical link</th>
                <th className="px-3 py-2">Normalised title</th>
                <th className="px-3 py-2">Timestamps</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{r.title ?? "(untitled)"}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.id}</p>
                    <p className="text-xs text-muted-foreground">{r.source ?? "unknown source"}</p>
                  </td>
                  <td className="px-3 py-3">
                    {r.original ? (
                      <>
                        <p className="font-medium">{r.original.title ?? "(untitled)"}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {r.original.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.original.source ?? "unknown source"} · kept{" "}
                          {when(r.original.created_at)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {r.duplicate_of
                          ? `missing original ${r.duplicate_of}`
                          : "no original recorded"}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[240px] px-3 py-3">
                    <p className="break-all font-mono text-[11px]">{r.canonical_url ?? "—"}</p>
                    {r.original?.canonical_url && r.original.canonical_url !== r.canonical_url ? (
                      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                        orig: {r.original.canonical_url}
                      </p>
                    ) : null}
                    {r.link_url ? (
                      <a
                        href={r.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs underline"
                      >
                        Open source
                      </a>
                    ) : null}
                  </td>
                  <td className="max-w-[240px] px-3 py-3">
                    <p className="break-words font-mono text-[11px]">{r.norm_title ?? "—"}</p>
                    {r.original?.norm_title && r.original.norm_title !== r.norm_title ? (
                      <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">
                        orig: {r.original.norm_title}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                    <p>found {when(r.created_at)}</p>
                    <p>marked {when(r.updated_at)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="outline"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(offset - PAGE, 0))}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          {total === 0 ? "0" : `${offset + 1}–${Math.min(offset + PAGE, total)}`} of{" "}
          {total.toLocaleString()}
        </span>
        <Button
          variant="outline"
          disabled={offset + PAGE >= total}
          onClick={() => setOffset(offset + PAGE)}
        >
          Next
        </Button>
      </div>
    </main>
  );
}
