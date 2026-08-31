import { createFileRoute, redirect } from "@tanstack/react-router";

/** The Brigade Barcelona landing page is now the homepage; keep the old URL working. */
export const Route = createFileRoute("/brigade-barcelona")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
