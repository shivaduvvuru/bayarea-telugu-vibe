import { Link } from "@tanstack/react-router";
import { CalendarDays, ArrowRight } from "lucide-react";

import towers from "@/assets/brigade-barcelona-towers.jpg.asset.json";

/**
 * Homepage teaser for the Brigade Barcelona USA showcase. Sits between the
 * city-news slider and the CREDAI sponsor carousel.
 */
export function BrigadePromo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/brigade-barcelona"
      className={`group block overflow-hidden rounded-xl border border-amber-300/60 bg-[#0B2A5B] text-white shadow-sm ${className}`}
    >
      <div className="grid gap-0 sm:grid-cols-[1.1fr_1fr]">
        <img
          src={towers.url}
          alt="Brigade Barcelona towers at Neopolis, Hyderabad"
          loading="lazy"
          className="h-40 w-full object-cover sm:h-full"
        />
        <div className="p-4">
          <span className="inline-block rounded-full bg-[#C9A24A] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0B2A5B]">
            Pre-launching
          </span>
          <h3 className="mt-2 font-serif text-xl leading-tight">
            Brigade <span className="text-[#C9A24A]">Barcelona</span>
          </h3>
          <p className="text-xs uppercase tracking-[0.16em] text-white/70">
            At Neopolis, Hyderabad
          </p>
          <p className="mt-2 text-sm text-white/85">
            Exclusive USA property showcase — free EOI, by appointment only.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#C9A24A]">
            <CalendarDays className="h-3.5 w-3.5" />8 US cities · Aug–Oct
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#C9A24A] group-hover:underline">
            Book my appointment <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
