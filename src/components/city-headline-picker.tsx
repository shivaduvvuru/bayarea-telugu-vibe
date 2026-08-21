import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, StarOff } from "lucide-react";
import { listPosts } from "@/lib/content.functions";
import { setCityHeadline } from "@/lib/headline.functions";
import { cityHeadlineQuery } from "@/components/city-headline-hero";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABELS = ["Breaking News", "Developing Story", "City Exclusive", "Headline News"];

/** Editorial control: pick which city story leads the site. */
export function CityHeadlinePicker({ deskToken }: { deskToken: string }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(LABELS[0]!);
  const current = useQuery(cityHeadlineQuery);
  const stories = useQuery({
    queryKey: ["headline-candidates"],
    queryFn: () => listPosts({ data: { category: "city-news", perPage: 20, compact: true } }),
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (vars: { slug: string | null }) =>
      setCityHeadline({ data: { deskToken, slug: vars.slug, label: vars.slug ? label : null } }),
    onSuccess: (_d, vars) => {
      toast.success(vars.slug ? "Headline story updated" : "Headline pin cleared");
      void qc.invalidateQueries({ queryKey: ["city-headline"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not update the headline"),
  });

  const activeSlug = current.data?.article.slug ?? null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Current City Headline
            </p>
            <p className="mt-1 truncate font-semibold text-ink">
              {current.data?.article.title ?? "None yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {current.data?.pinned
                ? `Pinned by an editor${current.data.label ? ` · ${current.data.label}` : ""}`
                : "Automatic fallback — newest city story"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!current.data?.pinned || save.isPending}
            onClick={() => save.mutate({ slug: null })}
          >
            <StarOff className="h-4 w-4" aria-hidden /> Clear pin
          </Button>
        </div>
        <div className="mt-4 max-w-xs">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Banner label</p>
          <Select value={label} onValueChange={setLabel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="space-y-2">
        {(stories.data ?? []).map((a) => {
          const active = a.slug === activeSlug && current.data?.pinned;
          return (
            <Card key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{a.categoryName}</Badge>
                  {a.sourceName ?? "Times Bay Area"}
                </p>
              </div>
              <Button
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={save.isPending}
                onClick={() => save.mutate({ slug: a.slug })}
              >
                <Star className={`h-4 w-4 ${active ? "fill-current" : ""}`} aria-hidden />
                {active ? "Headline" : "Set as headline"}
              </Button>
            </Card>
          );
        })}
        {stories.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading city stories…</p>
        ) : null}
      </div>
    </div>
  );
}
