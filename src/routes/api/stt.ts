import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const inbound = await request.formData();
          const file = inbound.get("file");
          if (!(file instanceof Blob)) {
            return new Response("Missing audio file", { status: 400 });
          }
          const out = new FormData();
          // Preserve original filename/extension where possible
          const name =
            typeof (file as unknown as { name?: string }).name === "string" &&
            (file as unknown as { name: string }).name.length > 0
              ? (file as unknown as { name: string }).name
              : "recording.webm";
          out.append("file", file, name);
          out.append("model", "openai/gpt-4o-transcribe");
          const upstream = await fetch(
            "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
              },
              body: out,
            },
          );
          const bodyText = await upstream.text();
          if (!upstream.ok) {
            return new Response(`STT error ${upstream.status}: ${bodyText}`, {
              status: 502,
            });
          }
          return new Response(bodyText, {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "STT failed", {
            status: 500,
          });
        }
      },
    },
  },
});
