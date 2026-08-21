import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

const TABS = [
  { to: "/temples", label: "Temple Directory", exact: true },
  { to: "/temples/calendar", label: "Temple Calendar", exact: false },
  { to: "/temples/news", label: "Temple News", exact: false },
] as const;


export const Route = createFileRoute("/temples")({
  component: TemplesLayout,
});

function TemplesLayout() {
  return (
    <div>
      <nav
        aria-label="Temple sections"
        className="border-b border-border bg-card/60 backdrop-blur"
      >
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.exact }}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
              activeProps={{ className: "bg-primary/10 text-primary" }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
