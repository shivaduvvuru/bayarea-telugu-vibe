import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { listPropertyLeads, updatePropertyLead } from "@/lib/property.functions";
import type { LeadRow } from "@/lib/property.server";
import { LEAD_STATUSES, leadRegion, leadStatusLabel } from "@/lib/property";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function csvCell(v: string | null | undefined) {
  const s = (v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function buildCsv(rows: LeadRow[]) {
  const head = [
    "created_at",
    "campaign_code",
    "attribution",
    "country",
    "city",
    "name",
    "email",
    "phone",
    "preferred_contact",
    "budget",
    "projects",
    "developers",
    "contact_status",
    "follow_up_note",
    "message",
  ];
  const body = rows.map((l) =>
    [
      l.created_at,
      l.campaign_code,
      leadRegion(l.country),
      l.country,
      l.city,
      l.name,
      l.email,
      l.phone,
      l.preferred_contact,
      l.budget,
      l.project_names.join("; "),
      l.developers.join("; "),
      l.contact_status,
      l.follow_up_note,
      l.message,
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...body].join("\r\n");
}

/**
 * Follow-up queue: enquiries grouped by project or developer, with contact
 * status the desk can update and a CSV export carrying campaign code and
 * U.S./India attribution.
 */
export function PropertyLeadQueue({
  campaignSlug,
  deskToken,
}: {
  campaignSlug: string;
  deskToken: string;
}) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [groupBy, setGroupBy] = useState<"project" | "developer">("project");
  const [status, setStatus] = useState<string>("all");
  const load = useServerFn(listPropertyLeads);
  const patch = useServerFn(updatePropertyLead);

  const refresh = useCallback(async () => {
    const res = await load({ data: { campaignSlug, deskToken } }).catch(() => null);
    setLeads((res?.leads ?? []) as LeadRow[]);
  }, [campaignSlug, deskToken, load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(
    () => (status === "all" ? leads : leads.filter((l) => l.contact_status === status)),
    [leads, status],
  );

  const groups = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    for (const l of filtered) {
      const keys =
        groupBy === "project"
          ? l.project_names.length
            ? l.project_names
            : ["General enquiry"]
          : l.developers.length
            ? l.developers
            : ["General enquiry"];
      for (const k of keys) map.set(k, [...(map.get(k) ?? []), l]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, groupBy]);

  function exportCsv() {
    const csv = buildCsv(filtered);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${campaignSlug}-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const usa = filtered.filter((l) => leadRegion(l.country) === "USA").length;
  const india = filtered.filter((l) => leadRegion(l.country) === "India").length;

  return (
    <Card className="mt-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Lead follow-up queue</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "project" | "developer")}
            aria-label="Group leads by"
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold"
          >
            <option value="project">By project</option>
            <option value="developer">By developer</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by contact status"
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold"
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {leadStatusLabel(s)}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1 size-4" aria-hidden /> Export CSV
          </Button>
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {filtered.length} enquir{filtered.length === 1 ? "y" : "ies"} · U.S. {usa} · India {india} ·
        other {filtered.length - usa - india}
      </p>

      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No enquiries match this filter.</p>
      ) : (
        <div className="mt-3 space-y-5">
          {groups.map(([name, rows]) => (
            <section key={name}>
              <h3 className="text-[13px] font-bold text-ink">
                {name} <span className="text-muted-foreground">({rows.length})</span>
              </h3>
              <ul className="mt-1.5 space-y-2">
                {rows.map((l) => (
                  <li key={`${name}-${l.id}`} className="border-t border-border pt-2 text-sm">
                    <p className="font-semibold text-ink">
                      {l.name} · {l.email}
                      {l.phone ? ` · ${l.phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        new Date(l.created_at).toLocaleDateString(),
                        leadRegion(l.country),
                        l.country,
                        l.budget,
                        l.preferred_contact,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {l.message ? <p className="mt-1 text-xs text-ink">{l.message}</p> : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <select
                        value={l.contact_status}
                        aria-label={`Contact status for ${l.name}`}
                        onChange={async (e) => {
                          const contactStatus = e.target.value as (typeof LEAD_STATUSES)[number];
                          setLeads((prev) =>
                            prev.map((x) =>
                              x.id === l.id ? { ...x, contact_status: contactStatus } : x,
                            ),
                          );
                          const res = await patch({
                            data: { deskToken, id: l.id, contactStatus },
                          }).catch(() => null);
                          if (!res?.ok) {
                            toast.error("Could not save the status");
                            void refresh();
                          }
                        }}
                        className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {leadStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                      <Input
                        defaultValue={l.follow_up_note ?? ""}
                        placeholder="Follow-up note"
                        aria-label={`Follow-up note for ${l.name}`}
                        className="h-8 max-w-xs text-xs"
                        onBlur={async (e) => {
                          const followUpNote = e.target.value.trim();
                          if (followUpNote === (l.follow_up_note ?? "")) return;
                          const res = await patch({
                            data: { deskToken, id: l.id, followUpNote },
                          }).catch(() => null);
                          if (res?.ok) {
                            setLeads((prev) =>
                              prev.map((x) =>
                                x.id === l.id ? { ...x, follow_up_note: followUpNote } : x,
                              ),
                            );
                          } else toast.error("Could not save the note");
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
