import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { autoMatchClaudeFile, browseDrive, previewDriveFile } from "@/lib/drive.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/drive-import")({
  head: () => ({
    meta: [
      { title: "Google Drive import — Times Bay Area" },
      {
        name: "description",
        content:
          "Browse and search connected Google Drive files, then pick the exact file to import into the newsroom.",
      },
      { property: "og:title", content: "Google Drive import — Times Bay Area" },
      { property: "og:description", content: "Pick a Google Drive file to import." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriveImportPage,
});

type Crumb = { id: string; name: string };

function formatSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function DriveImportPage() {
  const list = useServerFn(browseDrive);
  const preview = useServerFn(previewDriveFile);

  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);
  const folderId = crumbs[crumbs.length - 1]!.id;

  const files = useQuery({
    queryKey: ["drive-browse", search, search ? "" : folderId],
    queryFn: () => list({ data: search ? { search } : { folderId } }),
    staleTime: 30_000,
  });

  const load = useMutation({
    mutationFn: (fileId: string) => preview({ data: { fileId } }),
  });

  const autoMatch = useServerFn(autoMatchClaudeFile);
  const [dismissedMatch, setDismissedMatch] = useState(false);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const match = useQuery({
    queryKey: ["drive-auto-match"],
    queryFn: () => autoMatch({}),
    staleTime: 5 * 60_000,
  });

  const best = match.data?.best ?? null;
  const alternates = (match.data?.candidates ?? []).filter((c) => c.id !== best?.id);
  const showMatch = !dismissedMatch && (match.isPending || match.isError || best);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Google Drive import</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Browse folders or search by name, then open the file you want imported.
      </p>

      {showMatch ? (
        <section className="mt-6 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
            Best guess
          </h2>
          {match.isPending ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Scanning your Drive for the Claude download…
            </p>
          ) : match.isError ? (
            <p className="mt-2 text-sm text-destructive">{(match.error as Error).message}</p>
          ) : best ? (
            <>
              <p className="mt-2 text-base font-medium">{best.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatSize(best.size)} · {formatDate(best.modifiedTime)} · confidence score{" "}
                {best.score}
              </p>
              {best.reasons.length ? (
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {best.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3 text-sm">Is this the file you want to import?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setConfirmedId(best.id);
                    load.mutate(best.id);
                  }}
                >
                  Yes, import this file
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDismissedMatch(true)}>
                  No, let me pick
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => match.refetch()}
                  disabled={match.isFetching}
                >
                  Rescan
                </Button>
              </div>
              {alternates.length ? (
                <div className="mt-3 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Other close matches</p>
                  <ul className="mt-1 space-y-1">
                    {alternates.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm">
                        <button
                          type="button"
                          className="truncate text-left underline-offset-2 hover:underline"
                          onClick={() => {
                            setConfirmedId(c.id);
                            load.mutate(c.id);
                          }}
                        >
                          {c.name}
                        </button>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          score {c.score}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}


      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(term.trim());
        }}
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search file name (e.g. collect-news)"
          aria-label="Search Google Drive by file name"
        />
        <Button type="submit">Search</Button>
        {search ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setTerm("");
              setSearch("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {!search ? (
        <nav className="mt-4 flex flex-wrap items-center gap-1 text-sm" aria-label="Folder path">
          {crumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {i > 0 ? <span className="text-muted-foreground">/</span> : null}
              <button
                type="button"
                className="rounded px-1 underline-offset-2 hover:underline disabled:no-underline"
                disabled={i === crumbs.length - 1}
                onClick={() => setCrumbs((c) => c.slice(0, i + 1))}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      <section className="mt-4 rounded-lg border">
        {files.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Loading Drive…</p>
        ) : files.isError ? (
          <p className="p-4 text-sm text-destructive">
            {(files.error as Error).message}
          </p>
        ) : files.data.files.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="divide-y">
            {files.data.files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 p-3">
                <span aria-hidden className="text-lg">
                  {f.isFolder ? "📁" : "📄"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatSize(f.size)} · {formatDate(f.modifiedTime)}
                  </p>
                </div>
                {f.isFolder ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setTerm("");
                      setSearch("");
                      setCrumbs((c) => [...c, { id: f.id, name: f.name }]);
                    }}
                  >
                    Open
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => load.mutate(f.id)}>
                    Select
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {load.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Reading file…</p>
      ) : null}
      {load.isError ? (
        <p className="mt-4 text-sm text-destructive">{(load.error as Error).message}</p>
      ) : null}

      {load.data ? (
        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{load.data.meta.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            File ID {load.data.meta.id} · {load.data.meta.mimeType} ·{" "}
            {formatSize(load.data.bytes)}
            {load.data.truncated ? " · preview truncated" : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigator.clipboard?.writeText(load.data!.meta.id)}
            >
              Copy file ID
            </Button>
            {load.data.isText ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.clipboard?.writeText(load.data!.text)}
              >
                Copy contents
              </Button>
            ) : null}
          </div>
          {load.data.isText ? (
            <pre className="mt-3 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
              {load.data.text}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              This file isn’t plain text (archive or binary). Share the file ID above and it can
              still be pulled in directly.
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
