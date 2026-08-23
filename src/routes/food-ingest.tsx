import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkDesk } from "@/lib/desk-gate.functions";
import { ingestYelpRestaurants, restaurantCoverage } from "@/lib/yelp.functions";

const TITLE = "Yelp restaurant ingest — editorial desk | Times Bay Area";
const DESC =
  "Editorial tool: pull Yelp restaurant listings and star ratings for every Bay Area city we cover.";

export const Route = createFileRoute("/food-ingest")({
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
  component: IngestPage,
});

type Coverage = { cities: { city: string; total: number; yelp: number }[]; total: number };
type RunResult = {
  ok: boolean;
  cities: number;
  fetched: number;
  created: number;
  updated: number;
  ratings: number;
  skipped: number;
  errors: string[];
};

const button =
  "min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60";

function IngestPage() {
  const doCheck = useServerFn(checkDesk);
  const doCoverage = useServerFn(restaurantCoverage);
  const doIngest = useServerFn(ingestYelpRestaurants);

  const [token, setToken] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (deskToken: string) => {
      try {
        setError("");
        setCoverage((await doCoverage({ data: { deskToken } })) as Coverage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read coverage.");
      }
    },
    [doCoverage],
  );

  useEffect(() => {
    doCheck()
      .then((res) => {
        if (!res.unlocked) {
          setToken("");
          return;
        }
        setToken(res.token ?? "");
        void load(res.token ?? "");
      })
      .catch(() => setToken(""));
  }, [doCheck, load]);

  async function run(cities: string[]) {
    if (token == null) return;
    setBusy(cities.length === 0 ? "all" : cities.join(","));
    setError("");
    setResult(null);
    try {
      const res = (await doIngest({
        data: { cities, perCity: 100, deskToken: token },
      })) as RunResult;
      setResult(res);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yelp ingest failed.");
    } finally {
      setBusy("");
    }
  }

  if (token === "") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-lg font-bold text-ink">Editorial desk required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock the desk first, then come back to run the Yelp restaurant ingest.
        </p>
        <Link to="/desk" className="mt-3 inline-block text-sm font-semibold text-primary">
          Go to the desk
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-extrabold text-ink">Yelp restaurant ingest</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pulls Yelp restaurant listings for the Bay Area cities we cover, matches them against
        existing profiles so nothing duplicates, and stores each Yelp star rating and review count
        with a link back to Yelp.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={!!busy} onClick={() => void run([])}>
          {busy === "all" ? "Pulling all cities…" : "Pull all Bay Area cities"}
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-4 text-sm font-semibold text-ink disabled:opacity-60"
          disabled={!!busy || selected.length === 0}
          onClick={() => void run(selected)}
        >
          Pull selected ({selected.length})
        </button>
        <Link
          to="/food-merge"
          className="min-h-11 rounded-md border border-border px-4 text-sm font-semibold leading-[2.75rem] text-ink"
        >
          Duplicate merge
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-ink">
          <p className="font-bold">
            {result.ok ? "Ingest complete" : "Ingest finished with problems"} — {result.cities}{" "}
            cities
          </p>
          <p className="mt-1 text-muted-foreground">
            {result.fetched} listings read • {result.created} new • {result.updated} enriched •{" "}
            {result.ratings} ratings stored • {result.skipped} skipped
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-destructive">
              {result.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <h2 className="mt-6 text-sm font-extrabold uppercase tracking-wide text-ink">
            City coverage {coverage ? `— ${coverage.total} published listings` : ""}
      </h2>
      {!coverage ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading coverage…</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
          {coverage.cities.map((c) => {
            const on = selected.includes(c.city);
            return (
              <li key={c.city} className="flex items-center justify-between gap-3 px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setSelected((prev) =>
                        on ? prev.filter((x) => x !== c.city) : [...prev, c.city],
                      )
                    }
                  />
                  {c.city}
                </label>
                <span className="text-xs text-muted-foreground">
                  {c.total} listings • {c.yelp} from Yelp
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Yelp content stays attributed: ratings link to the Yelp business page and refresh on each
        run.
      </p>
    </div>
  );
}
