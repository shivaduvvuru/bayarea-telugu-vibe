import { createFileRoute } from "@tanstack/react-router";

/** Serves images uploaded with community submissions from private storage. */
export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("submissions").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data.stream(), {
          headers: {
            "content-type": data.type || "image/jpeg",
            "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });

      },
    },
  },
});