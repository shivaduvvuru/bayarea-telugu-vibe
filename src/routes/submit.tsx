import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { submitContent, uploadSubmissionPhoto } from "@/lib/cms.functions";
import { CONTENT_KINDS } from "@/lib/cms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TITLE = "Submit news, events & photos — Bay Area Telugu Times";
const DESC =
  "Share Bay Area Telugu community news, events, temple announcements, classifieds and photos. Our editors review every submission before it goes live.";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmitPage,
});

function SubmitPage() {
  const submit = useServerFn(submitContent);
  const upload = useServerFn(uploadSubmissionPhoto);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    kind: "news",
    title: "",
    summary: "",
    body: "",
    link_url: "",
    image_url: "",
    city: "",
    venue: "",
    event_start: "",
    submitter_name: "",
    submitter_email: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => submit({ data: form as never }),
    onSuccess: () => setDone(true),
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    if (file.size > 5_000_000) {
      toast.error("Please choose an image under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (const byte of buf) binary += String.fromCharCode(byte);
      const res = await upload({
        data: {
          filename: file.name,
          contentType: file.type,
          dataBase64: btoa(binary),
        },
      });
      set("image_url", res.path);
      toast.success("Photo attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl">Thank you</h1>
        <p className="mt-3 text-muted-foreground">
          Your submission is with our editors. Approved items appear on the site, usually
          within a day. We may email you at {form.submitter_email} if we need details.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl">Submit to Bay Area Telugu Times</h1>
      <p className="mt-2 text-sm text-muted-foreground">{DESC}</p>

      <form
        className="mt-8 grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="kind">What are you sharing?</Label>
          <select
            id="kind"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            {CONTENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            minLength={4}
            maxLength={160}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="summary">One-line summary</Label>
          <Input
            id="summary"
            maxLength={400}
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="body">Details</Label>
          <Textarea
            id="body"
            rows={7}
            maxLength={6000}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Bay Area city</Label>
          <Input id="city" maxLength={60} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue">Venue (events)</Label>
          <Input id="venue" maxLength={160} value={form.venue} onChange={(e) => set("venue", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="event_start">Date &amp; time (events)</Label>
          <Input
            id="event_start"
            type="datetime-local"
            value={form.event_start}
            onChange={(e) => set("event_start", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="link_url">Link (optional)</Label>
          <Input
            id="link_url"
            type="url"
            maxLength={500}
            value={form.link_url}
            onChange={(e) => set("link_url", e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="photo">Photo (optional, max 5 MB)</Label>
          <Input
            id="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          {form.image_url && (
            <p className="text-xs text-muted-foreground">Attached: {form.image_url}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="submitter_name">Your name</Label>
          <Input
            id="submitter_name"
            required
            minLength={2}
            maxLength={80}
            value={form.submitter_name}
            onChange={(e) => set("submitter_name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="submitter_email">Your email</Label>
          <Input
            id="submitter_email"
            type="email"
            required
            maxLength={160}
            value={form.submitter_email}
            onChange={(e) => set("submitter_email", e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={mutation.isPending || uploading}>
            {mutation.isPending ? "Sending…" : "Send for review"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Every community submission is reviewed by an editor before publication.
          </p>
        </div>
      </form>
    </div>
  );
}