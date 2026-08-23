import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkDesk } from "@/lib/desk-gate.functions";
import {
  foodSourceStatus,
  ingestOsmRestaurants,
  previewOsmRestaurants,
  setApiBudget,
} from "@/lib/food-sources.functions";
import { ingestYelpRestaurants } from "@/lib/yelp.functions";

const TITLE = "Restaurant ingest — editorial desk | Times Bay Area";
const DESC =
  "Editorial tool: build the Bay Area restaurant directory from OpenStreetMap, with optional paid enrichment under a monthly cost cap.";

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
  cities: { city: string; total: number; osm: number; mappable: boolean }[];
  budgets: Budget[];
  providers: { osm: boolean; foursquare: boolean; yelp: boolean };
};

type Report = {
  ok: boolean;
  preview: boolean;
  cities: string[];
  discovered: number;
  added: number;
  updated: number;
  duplicatesSkipped: number;
  missingAddress: number;
  missingCuisine: number;
  errors: string[];
  perCity: { city: string; discovered: number; added: number; updated: number; skipped: number }[];
  sample: { name: string; city: string; cuisines: string[]; address: string | null }[];
};

const CUISINES = ["", "Indian", "South Indian", "Telugu", "Chinese", "Mexican", "Cafe", "Pizza"];

const btn =
  "min-h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60";
const btnGhost =
  "min-h-11 rounded-md border border-border bg-background px-4 text-sm font-semibold text-ink disabled:opacity-60";

function IngestPage() {
  const doCheck = useServerFn(checkDesk);
  const doStatus = useServerFn(foodSourceStatus);
  const doPreview = useServerFn(previewOsmRestaurants);
  const doIngest = useServerFn(ingestOsmRestaurants);
  const doBudget = useServerFn(setApiBudget);
  const doYelp = useServerFn(ingestYelpRestaurants);

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [busy, setBusy] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(
    async (deskToken: string) => {
      try {
        setError("");
        setStatus((await doStatus({ data: { deskToken } })) as Status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read directory status.");
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

  async function runOsm(preview: boolean, cities: string[]) {
    if (token == null) return;
    setBusy(preview ? "preview" : "import");
    setError("");
    setNote("");
    setReport(null);
    try {
      const fn = preview ? doPreview : doIngest;
      const res = (await fn({
        data: {
          cities,
          perCity: 150,
          deskToken: token,
          ...(cuisine ? { cuisine } : {}),
        },
      })) as Report;
      setReport(res);
      if (!preview) await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OpenStreetMap import failed.");
    } finally {
      setBusy("");
    }
  }

  async function runYelp() {
    if (token == null) return;
    setBusy("yelp");
    setError("");
    setNote("");
    try {
      await doYelp({ data: { cities: selected, perCity: 50, deskToken: token } });
      setNote("Yelp enrichment finished.");
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yelp enrichment failed.");
    } finally {
      setBusy("");
    }
  }

  async function saveBudget(provider: string, patch: { enabled?: boolean; monthlyLimitUsd?: number }) {
    if (token == null) return;
    setError("");
    try {
      await doBudget({ data: { provider, deskToken: token, ...patch } });
      setNote(`${provider} budget saved.`);
      await load(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the budget.");
    }
  }

  function toggleCity(city: string) {
    setSelected((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
    );
  }

  if (token === "") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-lg font-bold text-ink">Editorial desk required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unlock the desk first, then come back to run the restaurant ingest.
        </p>
        <Link to="/desk" className="mt-3 inline-block text-sm font-semibold text-primary">
          Go to the desk
        </Link>
      </div>
    );
  }

  const mappable = (status?.cities ?? []).filter((c) => c.mappable);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <h1 className="text-xl font-extrabold text-ink">Restaurant ingest</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        OpenStreetMap is the primary, free source for the directory: restaurants, cafés, fast food,
        food courts and ice cream, with cuisine, address, phone, website and hours where mapped.
        Paid providers stay optional and capped.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Data © OpenStreetMap contributors, licensed under the ODbL. Bulk POI pulls go through
        Overpass — never the public Nominatim service.
      </p>

      {error ? (
        <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          {note}
        </p>
      ) : null}

      {/* ---------------- controls ---------------- */}
      <section className="mt-5 rounded-lg border border-border p-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Pull from OpenStreetMap
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="cuisine">
            Cuisine filter
          </label>
          <select
            id="cuisine"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="min-h-10 rounded-md border border-border bg-background px-2 text-sm"
          >
            {CUISINES.map((c) => (
              <option key={c || "all"} value={c}>
                {c || "All cuisines"}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnGhost}
            disabled={!!busy}
            onClick={() => void runOsm(true, selected)}
          >
            {busy === "preview" ? "Previewing…" : "Preview (no writes)"}
          </button>
          <button
            type="button"
            className={btn}
            disabled={!!busy}
            onClick={() => void runOsm(false, selected)}
          >
            {busy === "import"
              ? "Importing…"
              : selected.length > 0
                ? `Import ${selected.length} selected`
                : "Import all Bay Area cities"}
          </button>
          {selected.length > 0 ? (
            <button type="button" className={btnGhost} onClick={() => setSelected([])}>
              Clear selection
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Select cities below to pull by city, or leave everything unselected to cover the whole Bay
          Area. Existing listings are matched on OSM id, name + city, website and coordinates, so
          runs update instead of duplicating.
        </p>
      </section>

      {/* ---------------- report ---------------- */}
      {report ? (
        <section className="mt-5 rounded-lg border border-border p-3">
          <h2 className="text-sm font-bold text-ink">
            {report.preview ? "Preview report" : "Ingestion report"}
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ["Cities processed", report.cities.length],
              ["Discovered", report.discovered],
              [report.preview ? "Would add" : "Added", report.added],
              [report.preview ? "Would update" : "Updated", report.updated],
              ["Skipped (cap)", report.perCity.reduce((n, c) => n + c.skipped, 0)],
              ["Missing address", report.missingAddress],
              ["Missing cuisine", report.missingCuisine],
              ["Errors", report.errors.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md bg-muted/50 p-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="text-base font-extrabold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {report.sample.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {report.sample.map((s) => (
                <li key={`${s.name}-${s.city}`}>
                  <span className="font-semibold text-ink">{s.name}</span> · {s.city}
                  {s.cuisines.length > 0 ? ` · ${s.cuisines.join(", ")}` : " · no cuisine tag"}
                  {s.address ? "" : " · no address"}
                </li>
              ))}
            </ul>
          ) : null}

          {report.perCity.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2">City</th>
                    <th className="py-1 pr-2">Found</th>
                    <th className="py-1 pr-2">Added</th>
                    <th className="py-1 pr-2">Updated</th>
                    <th className="py-1">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {report.perCity.map((c) => (
                    <tr key={c.city} className="border-t border-border">
                      <td className="py-1 pr-2 font-semibold text-ink">{c.city}</td>
                      <td className="py-1 pr-2">{c.discovered}</td>
                      <td className="py-1 pr-2">{c.added}</td>
                      <td className="py-1 pr-2">{c.updated}</td>
                      <td className="py-1">{c.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {report.errors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-destructive">
              {report.errors.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* ---------------- coverage ---------------- */}
      <section className="mt-5 rounded-lg border border-border p-3">
        <h2 className="text-sm font-bold text-ink">
          Coverage {status ? `· ${status.total} published listings` : ""}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mappable.map((c) => {
            const on = selected.includes(c.city);
            return (
              <button
                key={c.city}
                type="button"
                onClick={() => toggleCity(c.city)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-ink"
                }`}
              >
                {c.city} · {c.total}
                {c.osm > 0 ? ` (${c.osm} OSM)` : ""}
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- budgets ---------------- */}
      <section className="mt-5 rounded-lg border border-border p-3">
        <h2 className="text-sm font-bold text-ink">External API monthly cost limit</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          OpenStreetMap is free and always on. Paid providers only run when switched on here and
          stay inside their monthly limit — the default is $10/month.
        </p>
        <ul className="mt-2 space-y-2">
          {(status?.budgets ?? []).map((b) => (
            <li
              key={b.provider}
              className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2"
            >
              <span className="min-w-24 text-sm font-bold capitalize text-ink">
                {b.provider.replace("_", " ")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {b.month} · {b.calls} calls · ${Number(b.spend_usd).toFixed(2)} of $
                {Number(b.monthly_limit_usd).toFixed(2)}
              </span>
              <label className="flex items-center gap-1 text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={b.enabled}
                  onChange={(e) => void saveBudget(b.provider, { enabled: e.target.checked })}
                />
                Enabled
              </label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Limit $
                <input
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  defaultValue={Number(b.monthly_limit_usd)}
                  onBlur={(e) =>
                    void saveBudget(b.provider, { monthlyLimitUsd: Number(e.target.value) })
                  }
                  className="w-16 rounded border border-border bg-background px-1 py-0.5 text-xs"
                />
              </label>
              <span className="text-[11px] text-muted-foreground">
                {status?.providers?.[b.provider as "foursquare" | "yelp"] === true
                  ? "key on file"
                  : b.provider === "google_places"
                    ? "not integrated"
                    : "no key"}
              </span>
            </li>
          ))}
        </ul>
        {status?.providers.yelp ? (
          <button type="button" className={`${btnGhost} mt-3`} disabled={!!busy} onClick={() => void runYelp()}>
            {busy === "yelp" ? "Enriching…" : "Optional: Yelp enrichment for selected cities"}
          </button>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Yelp is optional and currently disabled — the directory runs without it.
          </p>
        )}
      </section>
    </div>
  );
}
