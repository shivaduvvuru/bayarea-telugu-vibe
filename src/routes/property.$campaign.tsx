import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout shell for a property-show campaign and its project pages. */
export const Route = createFileRoute("/property/$campaign")({
  component: () => <Outlet />,
});
