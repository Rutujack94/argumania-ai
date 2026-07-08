import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  debateId: z.string().uuid(),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = authHeader.slice(7);

          const body = Body.parse(await request.json());

          // Load debate + messages using the user's bearer token (RLS applied)
          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: claims, error: claimErr } = await supabase.auth.getClaims(token);
          if (claimErr || !claims?.claims?.sub) {
            return new Response("Unauthorized", { status: 401 });
          }
          const userId = claims.claims.sub as string;

          const [{ data: debate }, { data: msgs }] = await Promise.all([
            supabase.from("debates").select("*").eq("id", body.debateId).maybeSingle(),
            supabase
              .from("debate_messages")
              .select("role, content, turn_index")
              .eq("debate_id", body.debateId)
              .order("turn_index", { ascending: true }),
          ]);
          if (!debate) return new Response("Not found", { status: 404 });

          const history = (msgs ?? [])
            .filter((m) => m.role === "user" || m.role === "opponent")
            .map((m) => ({ role: m.role as "user" | "opponent", content: m.content }));

          const lastUser = [...history].reverse().find((m) => m.role === "user");
          const queryText = `${debate.topic}\n${lastUser?.content ?? ""}`;

          const { retrieveEvidence, streamOpponentTurn } = await import(
            "@/lib/debate-agents.server"
          );
          const ragHits = await retrieveEvidence(supabase, queryText, userId, 4);

          const upstream = await streamOpponentTurn({
            topic: debate.topic,
            userStance: debate.user_stance,
            aiPersona: debate.ai_persona,
            difficulty: debate.difficulty,
            turnIndex: history.length,
            history,
            ragHits,
          });

          if (!upstream.ok || !upstream.body) {
            const t = await upstream.text().catch(() => "");
            return new Response(`Gateway error ${upstream.status}: ${t}`, { status: 502 });
          }

          // Return SSE + a header carrying the citations JSON for the client
          const headers = new Headers({
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Rag-Citations": JSON.stringify(
              ragHits.map((h, i) => ({
                index: i + 1,
                title: h.title,
                source: h.source,
                similarity: h.similarity,
              })),
            ),
          });
          return new Response(upstream.body, { headers });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
