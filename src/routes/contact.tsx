import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

const TITLE = "Contact & Advertise — Bay Area Telugu Times";
const DESC =
  "Send a news tip, submit a community event, or advertise with the Bay Area Telugu Times.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-ink">మమ్మల్ని సంప్రదించండి</h1>
      <p className="mt-2 text-muted-foreground">
        News tips, event submissions and advertising enquiries.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
          toast.success("Thanks — the newsroom will be in touch.");
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" />
          <Field label="Email" name="email" type="email" />
        </div>
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="topic">
            Topic
          </label>
          <select
            id="topic"
            className="mt-1 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option>News tip</option>
            <option>Event submission</option>
            <option>Advertising</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="message">
            Message
          </label>
          <textarea
            id="message"
            required
            rows={6}
            className="mt-1 w-full border border-input px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <button className="rounded-sm bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark">
          Send message
        </button>
        {sent && (
          <p className="text-sm text-muted-foreground">
            Message noted. Email us directly at news@bayarea.telugutimes.net for anything urgent.
          </p>
        )}
      </form>
    </div>
  );
}

function Field({ label, name, type = "text" }: { label: string; name: string; type?: string }) {
  return (
    <div>
      <label className="text-sm font-semibold text-ink" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        className="mt-1 w-full border border-input px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}