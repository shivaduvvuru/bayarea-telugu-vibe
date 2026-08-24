import { createFileRoute, redirect } from "@tanstack/react-router";

/** The directory lives at /directory now; keep old links working. */
export const Route = createFileRoute("/local-directory")({
  beforeLoad: () => {
    throw redirect({ to: "/directory", replace: true });
  },
});
