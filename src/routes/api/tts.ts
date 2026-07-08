import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, voice } = (await request.json()) as {
            text?: string;
            voice?: string;
          };
          if (!text || text.trim().length === 0)
            return new Response("Missing text", { status: 400 });

          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text.slice(0, 3500),
              voice: voice ?? "onyx",
              response_format: "mp3",
            }),
          });
          if (!upstream.ok) {
            const t = await upstream.text().catch(() => "");
            return new Response(`TTS error ${upstream.status}: ${t}`, { status: 502 });
          }
          return new Response(upstream.body, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "TTS failed", {
            status: 500,
          });
        }
      },
    },
  },
});
