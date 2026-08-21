import { createFileRoute, redirect } from "@tanstack/react-router";

/** The Temple Calendar now lives under the Temples menu. Keep the old URL working. */
export const Route = createFileRoute("/events/temple-calendar")({
  beforeLoad: () => {
    throw redirect({ to: "/temples/calendar", replace: true });
  },
});
