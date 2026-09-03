import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isChunkLoadError, recoverFromChunkError } from "../lib/chunk-reload";


import { LiteHeader } from "../components/lite-header";
import { SiteFooter } from "../components/site-footer";
import { MobileTabBar } from "../components/mobile-tabbar";
import { HeadlineTicker } from "../components/headline-ticker";
import { Toaster } from "../components/ui/sonner";
import { LanguageProvider } from "../lib/language";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const chunkError = isChunkLoadError(error);
  useEffect(() => {
    if (recoverFromChunkError(error)) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  if (chunkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground" role="status">
          Loading the latest version…
        </p>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Times Bay Area" },
      {
        name: "description",
        content:
          "Local news, events, culture, food and community connections for Telugu people across the San Francisco Bay Area.",
      },
      { name: "author", content: "Times Bay Area" },
      { property: "og:site_name", content: "Times Bay Area" },
      { property: "og:title", content: "Times Bay Area" },
      {
        property: "og:description",
        content:
          "Local news, events, culture, food and community connections for Telugu people across the San Francisco Bay Area.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Times Bay Area" },
      { name: "twitter:description", content: "Telugu news, community and events coverage for the San Francisco Bay Area." },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "NewsMediaOrganization",
              "@id": "https://timesbayarea.com/#organization",
              name: "Times Bay Area",
              url: "https://timesbayarea.com",
              areaServed: "San Francisco Bay Area, California",
            },
            {
              "@type": "WebSite",
              "@id": "https://timesbayarea.com/#website",
              name: "Times Bay Area",
              url: "https://bayarea-telugu-vibe.lovable.app",
              inLanguage: ["te", "en"],
              publisher: { "@id": "https://bayarea-telugu-vibe.lovable.app/#organization" },
            },
          ],
        }),
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // A stale cached bundle makes lazy route chunks fail to import, which looks
  // like navigation (e.g. sign-in → desk) "hanging". Recover once per session.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => recoverFromChunkError(e.reason);
    const onError = (e: ErrorEvent) => recoverFromChunkError(e.error ?? e.message);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);


  // Offline-tolerant shell + long-lived image cache for repeat mobile visits.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* caching is best-effort */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <div className="flex min-h-dvh flex-col pb-32 md:pb-0">
          <HeadlineTicker />
          <LiteHeader />
          <main className="flex-1">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </main>
          <SiteFooter />
          <MobileTabBar />
        </div>
        <Toaster />
      </LanguageProvider>
    </QueryClientProvider>
  );
}
