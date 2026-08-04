import { createFileRoute, redirect } from "@tanstack/react-router";

/** The lite edition is now the homepage; keep the old URL working. */
export const Route = createFileRoute("/lite")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
