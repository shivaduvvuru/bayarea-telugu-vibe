import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/temples")({
  component: () => <Outlet />,
});
