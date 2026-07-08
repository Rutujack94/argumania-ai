import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks.slice(0, 40); // safety cap
}

export const ingestKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(2).max(200),
        source: z.string().max(500).optional().default(""),
        content: z.string().min(20).max(80_000),
        isPublic: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { embed } = await import("./ai.server");
    const pieces = chunkText(data.content);
    const rows = [] as Array<{
      user_id: string; title: string; source: string | null;
      chunk: string; embedding: string; is_public: boolean;
    }>;
    for (const piece of pieces) {
      const vec = await embed(piece);
      rows.push({
        user_id: context.userId,
        title: data.title,
        source: data.source || null,
        chunk: piece,
        embedding: `[${vec.join(",")}]`,
        is_public: data.isPublic,
      });
    }
    const { error } = await context.supabase.from("knowledge_docs").insert(rows);
    if (error) throw new Error(error.message);
    return { chunks: rows.length };
  });

export const listKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_docs")
      .select("id, title, source, is_public, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // Deduplicate by title
    const seen = new Set<string>();
    const dedup: typeof data = [];
    for (const r of data ?? []) {
      const key = `${r.title}::${r.source ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(r);
    }
    return dedup;
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("knowledge_docs")
      .delete()
      .eq("user_id", context.userId)
      .eq("title", data.title);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
