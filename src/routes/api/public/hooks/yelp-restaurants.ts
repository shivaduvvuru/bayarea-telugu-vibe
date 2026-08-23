import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled Yelp restaurant refresh: pulls listings and star ratings for the
 * Bay Area cities we cover. Runs a slice of cities per call so a scheduled run
 * stays inside the request budget; pass ?cities=San%20Jose,Fremont to target.
 *
 *   POST /api/public/hooks/yelp-restaurants
 *   Authorization: Bearer <ingest hook token>
 */
export const Route = createFileRoute("/api/public/hooks/yelp-restaurants")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hookAuthorized, unauthorized } = await import("@/lib/hook-auth.server");
        if (!(await hookAuthorized(request))) return unauthorized();

        const url = new URL(request.url);
        const cities = (url.searchParams.get("cities") ?? "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const perCity = Number(url.searchParams.get("perCity") ?? "") || undefined;

        const { admin } = await import("@/lib/cms.server");
        const { ingestYelpCities } = await import("@/lib/yelp.server");
        try {
          const result = await ingestYelpCities(await admin(), {
            cities: cities.length > 0 ? cities : undefined,
            perCity,
          });
          return Response.json(result, { status: result.ok ? 200 : 207 });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "Yelp ingest failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
