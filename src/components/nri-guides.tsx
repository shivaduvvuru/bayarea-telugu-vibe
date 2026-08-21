import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { orderedNriGuides } from "@/lib/property";

/**
 * "Buying Hyderabad from the USA" — short educational cards that expand into
 * detail. Informational only; no advertiser copy sits in here.
 */
export function NriGuides({ compact = false }: { compact?: boolean }) {
  const guides = orderedNriGuides();
  const [open, setOpen] = useState<string | null>(guides[0]?.title ?? null);

  return (
    <section id="nri" className={compact ? "" : "mt-8"}>
      <h2 className="border-b-2 border-primary pb-1 text-sm font-bold uppercase tracking-wide text-ink">
        Buying Hyderabad from the USA
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        The paperwork NRI buyers ask about most — banking, authority to sign, loans, tax and
        registration. General information only, not legal, tax or investment advice.
      </p>

      <div
        className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}
      >
        {guides.map((g) => {
          const isOpen = open === g.title;
          return (
            <div key={g.title} className="rounded-lg border border-border bg-card">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : g.title)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-[13px] font-bold text-ink">{g.title}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-primary transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  {g.body}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
