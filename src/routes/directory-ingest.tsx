import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkDesk } from "@/lib/desk-gate.functions";
import {
  directoryStatus,
  previewDirectoryIngest,
  runDirectoryIngest,
} from "@/lib/directory.functions";
import { DIRECTORY_TAXONOMY } from "@/lib/directory-taxonomy";
import { BAY_AREA_COUNTIES } from "@/lib/directory-geo";

const TITLE = "Directory ingest — editorial desk | Times Bay Area";
const DESC =
  "Editorial tool: build every Bay Area directory category from OpenStreetMap open data, with optional paid enrichment under a monthly cost cap.";

export const Route = createFileRoute("/directory-ingest")({
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
  component: DirectoryIngestPage,
});

type Budget = {
  provider: string;
  enabled: boolean;
  monthly_limit_usd: number;
  cost_per_1k_usd: number;
  month: string;
  calls: number;
  spend_usd: number;
};

type Status = {
  total: number;
  stale: number;
  needsReview: number;
  byCategory: { key: string; label: string; total: number; needsReview: number }[];
  byCounty: { county: string; total: number }[];
  sources: string[];
  budgets: Budget[];
};

type Report = {
  ok: boolean;
  preview: boolean;
  cities: string[];
  categories: string[];
  queriesRun: number;
  queriesPlanned: number;
  discovered: number;
  added: number;
  updated: number;
  duplicatesMerged: number;
  duplicatesSkipped: number;
  incomplete: number;
  needsReview: number;
  errors: string[];
  perCategory: { path: string; discovered: number; added: number; updated: number }[];
  sample: { name: string; city: string; category: string; address: string | null }[];
};

const btn =
  "min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60";
const btnGhost =
  "min-h-11 rounded-md border border-border bg-background px-4 text-sm font-semibold text-ink disabled:opacity-60";

function DirectoryIngestPage() {
  const doCheck = useServerFn(checkDesk);
  const doStatus = useServerFn(directoryStatus);
  const doPreview = useServerFn(previewDirectoryIngest);
  const doIngest = useServerFn(runDirectoryIngest);

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [counties, setCounties] = useState<string[]>(["santa-clara"]);
  const [categories, setCategories] = useState<string[]>(["food"]);
  const [maxQueries, setMaxQueries] = useState(12);
  const [busy, setBusy] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (deskToken: string) => {
      try {
        setError("");
        setStatus((await doStatus({ data: { deskToken } })) as Status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read directory coverage.");
      }
    },
    [doStatus],
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

  async function run(preview: boolean) {
    if (token == null) return;
    setBusy(preview ? "preview" : "import");
    setError("");
    setReport(null);
    try {
      const fn = preview ? doPreview : doIngest;
      const res = (await fn({
        data: { counties, categories, maxQueries, perQuery: 80, deskToken: token },
      })) as Report;
      setReport(res);
      if (!preview) await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The OpenStreetMap import failed.");
    } finally {
      setBusy("");
    }
  }

  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  if (token === "") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-lg font-bold text-ink">Editorial desk required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock the desk first, then come back to run the directory ingest.
        </p>
        <Link to="/desk" className="mt-3 inline-block text-sm font-semibold text-primary">
          Go to the desk
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-extrabold text-ink">Directory ingest</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every category — food, temples, health, professional and home services, automotive, shopping,
        education, kids, entertainment, community, venues, real estate, travel and civic — is built
        from OpenStreetMap. Listings live in our own database, so no provider can hold the directory
        hostage. Paid enrichment stays optional and capped at $10 a month.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Data © OpenStreetMap contributors, ODbL. Bulk pulls use Overpass, never public Nominatim.
      </p>
      <p className="mt-2 text-sm">
        <Link to="/directory" className="font-semibold text-primary hover:underline">
          View the public directory →
        </Link>
      </p>

      {error ? (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {status ? (
        <section className="mt-5 rounded-md border border-border p-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Coverage</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {status.total.toLocaleString()} published listings · {status.needsReview} need review ·{" "}
            {status.stale} not refreshed in 90 days · sources: {status.sources.join(", ") || "none yet"}
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {status.byCategory.map((c) => (
              <li key={c.key} className="flex justify-between text-xs text-foreground">
                <span>{c.label}</span>
                <span className="text-muted-foreground">
                  {c.total}
                  {c.needsReview > 0 ? ` (${c.needsReview} review)` : ""}
                </span>
              </li>
            ))}
          </ul>
          {status.byCounty.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {status.byCounty.map((c) => `${c.county}: ${c.total}`).join(" · ")}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Budgets:{" "}
            {status.budgets
              .map(
                (b) =>
                  `${b.provider} ${b.enabled ? "on" : "off"} $${Number(b.spend_usd).toFixed(2)}/$${Number(
                    b.monthly_limit_usd,
                  ).toFixed(0)}`,
              )
              .join(" · ")}
          </p>
        </section>
      ) : null}

      <section className="mt-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Counties</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {BAY_AREA_COUNTIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(counties, c.key, setCounties)}
              className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
                counties.includes(c.key)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Categories</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIRECTORY_TAXONOMY.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(categories, c.key, setCategories)}
              className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
                categories.includes(c.key)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Overpass calls this run
          <input
            type="number"
            min={1}
            max={60}
            value={maxQueries}
            onChange={(e) => setMaxQueries(Number(e.target.value))}
            className="mt-1 block min-h-10 w-28 rounded-sm border border-border bg-background px-2 text-sm font-normal text-ink"
          />
        </label>
        <button type="button" className={btnGhost} disabled={!!busy} onClick={() => run(true)}>
          {busy === "preview" ? "Checking…" : "Dry run"}
        </button>
        <button type="button" className={btn} disabled={!!busy} onClick={() => run(false)}>
          {busy === "import" ? "Importing…" : "Import now"}
        </button>
      </section>
      <p className="mt-2 text-xs text-muted-foreground">
        Each run works through city × category pairs until the call limit is reached, so nothing
        times out. Run it repeatedly to keep walking the queue; already-known listings are refreshed
        instead of duplicated.
      </p>

      {report ? (
        <section className="mt-6 rounded-md border border-border p-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
            {report.preview ? "Dry run" : "Import"} result
          </h2>
          <p className="mt-1 text-sm text-foreground">
            {report.discovered} found · {report.added} {report.preview ? "would be added" : "added"} ·{" "}
            {report.updated} refreshed · {report.duplicatesMerged} merged as duplicates ·{" "}
            {report.incomplete} incomplete · {report.needsReview} flagged for review
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {report.queriesRun} of {report.queriesPlanned} planned queries ran across{" "}
            {report.cities.length} cities.
            {report.queriesRun < report.queriesPlanned
              ? " Run again to continue the queue."
              : " This selection is fully covered."}
          </p>
          {report.perCategory.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {report.perCategory.slice(0, 14).map((p) => (
                <li key={p.path} className="flex justify-between text-xs text-foreground">
                  <span>{p.path}</span>
                  <span className="text-muted-foreground">
                    {p.discovered} found · {p.added} new · {p.updated} refreshed
                  </span>
                </li>
              ))}
            </ul>
          )}
          {report.sample.length > 0 && (
            <ul className="mt-3 space-y-1">
              {report.sample.map((s) => (
                <li key={`${s.name}-${s.city}`} className="text-xs text-muted-foreground">
                  <span className="font-semibold text-ink">{s.name}</span> — {s.category} —{" "}
                  {s.address ?? "no address mapped"}
                </li>
              ))}
            </ul>
          )}
          {report.errors.length > 0 && (
            <ul className="mt-3 space-y-1">
              {report.errors.slice(0, 8).map((e) => (
                <li key={e} className="text-xs font-semibold text-destructive">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
