import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateDebate = z.object({
  topic: z.string().min(5).max(300),
  userStance: z.enum(["for", "against"]),
  aiPersona: z.string().default("balanced"),
  difficulty: z.enum(["beginner", "intermediate", "expert"]).default("intermediate"),
  format: z.enum(["text", "voice", "mixed"]).default("text"),
  secondsPerTurn: z.number().int().min(30).max(600).default(90),
  maxTurns: z.number().int().min(2).max(20).default(6),
});

export const createDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateDebate.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("debates")
      .insert({
        user_id: context.userId,
        topic: data.topic,
        user_stance: data.userStance,
        ai_persona: data.aiPersona,
        difficulty: data.difficulty,
        format: data.format,
        seconds_per_turn: data.secondsPerTurn,
        max_turns: data.maxTurns,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listDebates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("debates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDebate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [debateRes, msgsRes, scoreRes] = await Promise.all([
      context.supabase.from("debates").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("debate_messages")
        .select("*")
        .eq("debate_id", data.id)
        .order("turn_index", { ascending: true }),
      context.supabase.from("debate_scores").select("*").eq("debate_id", data.id).maybeSingle(),
    ]);
    if (debateRes.error) throw new Error(debateRes.error.message);
    return {
      debate: debateRes.data,
      messages: msgsRes.data ?? [],
      score: scoreRes.data ?? null,
    };
  });

export const saveMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      debateId: z.string().uuid(),
      role: z.enum(["user", "opponent"]),
      content: z.string().min(1),
      turnIndex: z.number().int().min(0),
      durationMs: z.number().int().nullable().optional(),
      citations: z.array(z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("debate_messages")
      .insert({
        debate_id: data.debateId,
        user_id: context.userId,
        role: data.role,
        content: data.content,
        turn_index: data.turnIndex,
        duration_ms: data.durationMs ?? null,
        citations: data.citations ?? [],
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const evaluateDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { judgeDebate } = await import("./debate-agents.server");
    const debRes = await context.supabase
      .from("debates")
      .select("*")
      .eq("id", data.debateId)
      .maybeSingle();
    if (debRes.error || !debRes.data) throw new Error("Debate not found");
    const debate = debRes.data;

    const msgsRes = await context.supabase
      .from("debate_messages")
      .select("role, content")
      .eq("debate_id", data.debateId)
      .order("turn_index", { ascending: true });
    if (msgsRes.error) throw new Error(msgsRes.error.message);
    const msgs = (msgsRes.data ?? []) as Array<{ role: string; content: string }>;
    if (msgs.length < 2) throw new Error("Not enough turns to evaluate.");

    const report = await judgeDebate({
      topic: debate.topic,
      userStance: debate.user_stance,
      transcript: msgs,
    });

    const { error: sErr } = await context.supabase.from("debate_scores").upsert(
      {
        debate_id: data.debateId,
        user_id: context.userId,
        logic_score: report.logic_score,
        evidence_score: report.evidence_score,
        persuasion_score: report.persuasion_score,
        delivery_score: report.delivery_score,
        fact_accuracy: report.fact_accuracy,
        fallacy_penalty: report.fallacy_penalty,
        overall: report.overall,
        winner: report.winner,
        fallacies: report.fallacies,
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        coach_plan: report.coach_plan,
        summary: report.summary,
      },
      { onConflict: "debate_id" },
    );
    if (sErr) throw new Error(sErr.message);

    await context.supabase
      .from("debates")
      .update({
        status: "completed",
        overall_score: report.overall,
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.debateId);

    // Update profile aggregate
    const profRes = await context.supabase
      .from("profiles")
      .select("total_debates, total_wins, average_score")
      .eq("id", context.userId)
      .maybeSingle();
    if (profRes.data) {
      const n = profRes.data.total_debates + 1;
      const newAvg =
        (Number(profRes.data.average_score) * profRes.data.total_debates + report.overall) / n;
      await context.supabase
        .from("profiles")
        .update({
          total_debates: n,
          total_wins: profRes.data.total_wins + (report.winner === "user" ? 1 : 0),
          average_score: Math.round(newAvg * 100) / 100,
        })
        .eq("id", context.userId);
    }

    return { report };
  });

export const suggestTopicsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ audience: z.string().max(120).default("") }).parse(d),
  )
  .handler(async ({ data }) => {
    const { suggestTopics } = await import("./debate-agents.server");
    const topics = await suggestTopics(data.audience, 6);
    return { topics };
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leaderboard")
      .select("*")
      .order("rank", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
