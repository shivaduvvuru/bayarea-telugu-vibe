import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listDirectory } from "@/lib/content.functions";
import { listClaimOverrides } from "@/lib/claims.functions";
import { ClaimForm } from "@/components/claim-form";
import { resolveCity } from "@/lib/directory-city";
import { COMMUNITY_EMAIL } from "@/lib/community-data";
import type { DirectoryEntry } from "@/lib/content";

export const communityOrgsQuery = queryOptions({
  queryKey: ["wp", "directory"],
  queryFn: () => listDirectory(),
});

export const claimOverridesQuery = queryOptions({
  queryKey: ["directory", "claim-overrides"],
  queryFn: () => listClaimOverrides(),
  staleTime: 5 * 60 * 1000,
});

/**
 * Curated community organisations (temples, associations, member businesses)
 * kept in the CMS, with owner corrections applied from approved claims and the
 * claim form so owners can keep their entry accurate.
 */
export function CommunityOrgs() {
  const { data: entries } = useSuspenseQuery(communityOrgsQuery);
  const { data: overrides } = useSuspenseQuery(claimOverridesQuery);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Verified owner corrections win over the stored listing details.
  const byListing = useMemo(() => {
    const map = new Map<number, (typeof overrides)[number]>();
    for (const o of overrides) map.set(o.listing_id, o);
    return map;
  }, [overrides]);

  const cityOf = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const e of entries) {
      map.set(e.id, byListing.get(e.id)?.city ?? resolveCity(e.title, e.excerpt));
    }
    return map;
  }, [entries, byListing]);

  const shown: DirectoryEntry[] = expanded ? entries : entries.slice(0, 12);

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="text-2xl font-bold text-ink">Community organisations</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Temples, associations and member businesses curated by our newsroom. Owners can claim an
        entry and correct its details — or email{" "}
        <a href={`mailto:${COMMUNITY_EMAIL}`} className="font-semibold text-primary hover:underline">
          {COMMUNITY_EMAIL}
        </a>{" "}
        to be added.
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Community organisations are being added — check back shortly.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((e) => {
              const o = byListing.get(e.id);
              return (
                <article key={e.id} className="flex flex-col border border-border p-4">
                  <h3 className="text-base font-bold text-ink">{e.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    {[e.category, cityOf.get(e.id)].filter(Boolean).join(" · ")}
                  </p>
                  {e.excerpt && (
                    <p className="mt-2 text-sm text-muted-foreground">{e.excerpt}</p>
                  )}
                  {o && (
                    <dl className="mt-2 space-y-0.5 text-xs text-foreground">
                      {o.hours && (
                        <div>
                          <dt className="inline font-semibold">Hours: </dt>
                          <dd className="inline">{o.hours}</dd>
                        </div>
                      )}
                      {o.phone && (
                        <div>
                          <dt className="inline font-semibold">Phone: </dt>
                          <dd className="inline">{o.phone}</dd>
                        </div>
                      )}
                      {o.address && (
                        <div>
                          <dt className="inline font-semibold">Address: </dt>
                          <dd className="inline">{o.address}</dd>
                        </div>
                      )}
                      <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Owner verified
                      </p>
                    </dl>
                  )}
                  {claiming === e.id ? (
                    <ClaimForm
                      listingId={e.id}
                      listingTitle={e.title}
                      suggestedCity={cityOf.get(e.id) ?? null}
                      onClose={() => setClaiming(null)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClaiming(e.id)}
                      className="mt-3 min-h-11 self-start rounded-sm border border-border px-3 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
                    >
                      Is this your business? Claim &amp; correct
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          {entries.length > shown.length && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-4 min-h-11 rounded-sm border border-border px-4 text-sm font-semibold text-ink hover:border-primary"
            >
              Show all {entries.length} organisations
            </button>
          )}
        </>
      )}
    </section>
  );
}
