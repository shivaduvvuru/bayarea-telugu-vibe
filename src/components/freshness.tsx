/** Shows when a feed was last refreshed and warns when it has gone stale. */
export function UpdatedStamp({
  at,
  label = "Updated",
  staleAfterHours = 48,
}: {
  at: string | null;
  label?: string;
  staleAfterHours?: number;
}) {
  if (!at) return null;
  const ts = new Date(at).getTime();
  if (Number.isNaN(ts)) return null;
  const hours = Math.floor((Date.now() - ts) / 3_600_000);
  const when =
    hours < 1 ? "just now" : hours < 48 ? `${hours} hours ago` : `${Math.floor(hours / 24)} days ago`;
  const stale = hours >= staleAfterHours;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        {label} {when}
      </span>
      {stale && (
        <span className="rounded-sm border border-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
          May be out of date
        </span>
      )}
    </p>
  );
}