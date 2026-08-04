import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "../components/site-header";
import { LiteHeader } from "../components/lite-header";
import { SiteFooter } from "../components/site-footer";
import { MobileTabBar } from "../components/mobile-tabbar";
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
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
      { title: "Bay Area Telugu Times" },
      {
        name: "description",
        content:
          "Telugu news, community and events coverage for the San Francisco Bay Area.",
      },
      { name: "author", content: "Bay Area Telugu Times" },
      { property: "og:title", content: "Bay Area Telugu Times" },
      {
        property: "og:description",
        content:
          "Telugu news, community and events coverage for the San Francisco Bay Area.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Bay Area Telugu Times" },
      { name: "twitter:description", content: "Telugu news, community and events coverage for the San Francisco Bay Area." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1aae6ac1-946e-464d-9ded-9ec47a8acf26/id-preview-5d7f2ddb--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app-1785864451015.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1aae6ac1-946e-464d-9ded-9ec47a8acf26/id-preview-5d7f2ddb--21d2eeed-01e3-4e0e-a028-88e01859acea.lovable.app-1785864451015.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "NewsMediaOrganization",
              "@id": "https://bayarea-dev-buddy.lovable.app/#organization",
              name: "Bay Area Telugu Times",
              url: "https://bayarea-dev-buddy.lovable.app",
              areaServed: "San Francisco Bay Area, California",
            },
            {
              "@type": "WebSite",
              "@id": "https://bayarea-dev-buddy.lovable.app/#website",
              name: "Bay Area Telugu Times",
              url: "https://bayarea-dev-buddy.lovable.app",
              inLanguage: ["te", "en"],
              publisher: { "@id": "https://bayarea-dev-buddy.lovable.app/#organization" },
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
  // The lite edition is now the homepage: it renders its own minimal chrome.
  const isLite = useRouterState({
    select: (s) => s.location.pathname === "/" || s.location.pathname.startsWith("/lite"),
  });

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
          {isLite ? <LiteHeader /> : <SiteHeader />}
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
