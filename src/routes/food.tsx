import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

const TABS = [
  { to: "/food", label: "Food Home", exact: true },
  { to: "/food/restaurants", label: "Restaurants", exact: false },
  { to: "/food/deals", label: "Deals & Coupons", exact: false },
  { to: "/food/add", label: "Add / Claim", exact: false },
] as const;

export const Route = createFileRoute("/food")({
  component: FoodLayout,
});

function FoodLayout() {
  return (
    <div>
      <nav aria-label="Food sections" className="border-b border-border bg-card/60 backdrop-blur">
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
