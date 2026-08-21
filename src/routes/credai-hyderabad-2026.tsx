import { createFileRoute, redirect } from "@tanstack/react-router";

/** Friendly campaign URL — keeps the shareable short link working. */
export const Route = createFileRoute("/credai-hyderabad-2026")({
  beforeLoad: () => {
    throw redirect({
      to: "/property/$campaign",
      params: { campaign: "credai-hyderabad-2026" },
    });
  },
});
