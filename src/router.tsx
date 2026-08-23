import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Feeds are polled on their own schedule; a shared floor stops every
        // mounted component from re-reading the same desk on hydration.
        staleTime: 60_000,
        retry: 1,
        refetchOnMount: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // Ships the server-rendered query cache to the browser: without it every
  // useQuery on an SSR page started empty, which both re-fetched all feed data
  // after hydration and caused hydration mismatches.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
