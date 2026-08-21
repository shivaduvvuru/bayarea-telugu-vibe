import { createFileRoute, Link } from "@tanstack/react-router";

const TITLE = "Bay Area Foundation Icons — Times Bay Area";
const DESC =
  "Honouring the Telugu pioneers who reached the Bay Area in the 70s, 80s and 90s and built the community that thrives today.";

export const Route = createFileRoute("/foundation-icons")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FoundationIconsPage,
});

const PIONEERS = [
  { name: "Sri Kasi Sastry", era: "Arrived 1970s" },
  { name: "Sri Durvasula Sastry", era: "Arrived 1970s" },
  { name: "Sri Rattayya", era: "Arrived 1970s" },
  { name: "Sri Bhaskar Rao", era: "Arrived 1970s" },
  { name: "Sri Lakireddy Balreddy", era: "Arrived 1970s" },
  { name: "Sri Vrudula Rayudu", era: "Arrived 1970s" },
  { name: "Sri Anjaneyulu Kothapalli", era: "BATA founding effort" },
  { name: "Sri Venkateswara Rao Vellanki", era: "BATA founding effort" },
  { name: "Sri Satyanarayana Bodapati", era: "BATA founding effort" },
];

function FoundationIconsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">
        Community Heritage
      </p>
      <h1 className="mt-2 text-3xl font-bold text-ink md:text-4xl">
        Bay Area Foundation Icons
      </h1>

      <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-foreground">
        <p>
          Telugus started coming to the USA, particularly the Bay Area — also called Silicon
          Valley — in the 80s and a little more in the 90s. There were very few of them and they
          really used to struggle to find Indian groceries and Indian food. But they worked hard
          developing the communities and eventually made the Bay Area one of the Indian’s (more
          so Telugu’s) hubs.
        </p>
        <p>
          The persons like Sri Kasi Sastry, Sri Durvasula Sastry, Sri Rattayya, Sri Bhaskar Rao,
          Sri Lakireddy Balreddy and Sri Vrudula Rayudu came in the 70s and put in great efforts
          to commute to places and to unite Telugus coming from India with their services. We
          understand that Sri Durvasula Sastry spent his personal money and put in efforts to
          screen a Telugu film in the Stanford University area.
        </p>
        <p>
          People like Sri Anjaneyulu Kothapalli, Sri Venkateswara Rao Vellanki and Sri
          Satyanarayana Bodapati put in great efforts to start a Telugu Association, which later
          got formed as the Bay Area Telugu Association (BATA).
        </p>
        <p>
          Telugu Times, which started in 2003 in the Bay Area, practically saw the growth of the
          Telugu community here — so is their activity from 2004 onwards. Hence Telugu Times
          proposes to identify and place Telugus who reached the Bay Area in the 80s and 90s and
          recognise them as <strong>Bay Area Foundation Icons</strong>. We keep adding them as we
          reach them or they reach us.
        </p>
      </div>

      <h2 className="mt-10 border-b-2 border-primary pb-2 text-xl font-bold text-ink">
        The Icons
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {PIONEERS.map((p) => (
          <li
            key={p.name}
            className="border-l-4 border-primary bg-surface-tint px-4 py-3"
          >
            <p className="text-sm font-semibold text-ink">{p.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.era}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 border border-border bg-surface-tint p-6">
        <h3 className="text-lg font-bold text-ink">Know an icon we should honour?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          If you or a family elder reached the Bay Area in the 70s, 80s or 90s and helped build
          the Telugu community here, write to us at{" "}
          <a href="mailto:bayarea@telugutimes.net" className="font-semibold text-primary">
            bayarea@telugutimes.net
          </a>{" "}
          and we will add their story to this page.
        </p>
        <Link
          to="/contact"
          className="mt-4 inline-block rounded-sm bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          Nominate an Icon
        </Link>
      </div>
    </div>
  );
}
