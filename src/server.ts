import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Public news pages are identical for every anonymous reader, so the edge/CDN
 * may serve them while a fresh copy is revalidated in the background. Editorial
 * and account surfaces are never cached.
 */
const PRIVATE_PREFIXES = [
  "/desk",
  "/command-center",
  "/admin",
  "/health",
  "/auth",
  "/api",
  "/glamour-dashboard",
  "/luxedesk",
  "/property-desk",
  "/food-ingest",
  "/food-merge",
  "/directory-ingest",
  "/temple-sources",
  "/property-videos",
];

function publicCacheHeader(pathname: string): string | null {
  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (pathname.startsWith("/article/")) {
    return "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
  }
  if (pathname.startsWith("/category/")) {
    return "public, max-age=0, s-maxage=120, stale-while-revalidate=300";
  }
  return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
}

function withPublicCache(request: Request, response: Response): Response {
  if (request.method !== "GET" || response.status !== 200) return response;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return response;
  if (response.headers.get("cache-control")) return response;
  const value = publicCacheHeader(new URL(request.url).pathname);
  if (!value) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", value);
  headers.append("vary", "accept-encoding");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withPublicCache(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
