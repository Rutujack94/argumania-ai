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
    const agents = await import("./debate-agents.server");
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

    // Load prior memory to personalize judging
    const memRes = await context.supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const priorMemory = memRes.data
      ? {
          strengths: (memRes.data.strengths as string[]) ?? [],
          weaknesses: (memRes.data.weaknesses as string[]) ?? [],
          recurring_fallacies: (memRes.data.recurring_fallacies as string[]) ?? [],
          style_notes: memRes.data.style_notes ?? "",
          preferences: (memRes.data.preferences as Record<string, unknown>) ?? {},
        }
      : { strengths: [], weaknesses: [], recurring_fallacies: [], style_notes: "", preferences: {} };

    const report = await agents.judgeDebate({
      topic: debate.topic,
      userStance: debate.user_stance,
      transcript: msgs,
      memory: priorMemory,
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
        fallacies: JSON.parse(JSON.stringify(report.fallacies)),
        strengths: report.strengths,
        weaknesses: report.weaknesses,
        coach_plan: JSON.parse(JSON.stringify(report.coach_plan)),
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

    // MEMORY AGENT — merge findings into long-term profile
    try {
      const nextMemory = await agents.updateMemory({ prior: priorMemory, report });
      await context.supabase.from("user_memory").upsert(
        {
          user_id: context.userId,
          strengths: nextMemory.strengths,
          weaknesses: nextMemory.weaknesses,
          recurring_fallacies: nextMemory.recurring_fallacies,
          style_notes: nextMemory.style_notes,
          preferences: JSON.parse(JSON.stringify(nextMemory.preferences ?? {})),
          debates_analyzed: (memRes.data?.debates_analyzed ?? 0) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      // RECOMMENDATION AGENT — seed next-topic suggestions
      const recentRes = await context.supabase
        .from("debates")
        .select("topic")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10);
      const recentTopics = (recentRes.data ?? []).map((r) => r.topic);
      const recs = await agents.recommendNext(nextMemory, recentTopics, 4);
      if (recs.length > 0) {
        await context.supabase.from("recommendations").insert(
          recs.map((r) => ({
            user_id: context.userId,
            topic: r.topic,
            rationale: r.rationale,
            difficulty: r.difficulty,
            focus_skill: r.focus_skill,
          })),
        );
      }
    } catch (err) {
      console.error("memory/recommendation update failed", err);
    }

    // GAMIFICATION — award XP for completing debate + bonus for high score / win
    try {
      const { awardXp } = await import("./gamification.functions");
      const base = 50;
      const scoreBonus = Math.max(0, Math.round((report.overall - 60) * 2));
      const winBonus = report.winner === "user" ? 75 : 0;
      const total = base + scoreBonus + winBonus;
      await awardXp({
        data: {
          amount: total,
          reason: `Debate completed (${report.overall}/100${report.winner === "user" ? " · win" : ""})`,
          debateId: data.debateId,
          debateScore: report.overall,
        },
      });
    } catch (err) {
      console.error("xp award failed", err);
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

/* ============================================================
 * LIVE TURN ANALYSIS — runs FactChecker + Fallacy + Emotion + SpeechEval
 * in parallel on the user's latest turn. Fast, cached to turn_analyses.
 * ============================================================ */
export const analyzeTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        debateId: z.string().uuid(),
        turnIndex: z.number().int().min(0),
        text: z.string().min(1).max(6000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const agents = await import("./debate-agents.server");
    const hits = await agents.retrieveEvidence(
      context.supabase as unknown as Parameters<typeof agents.retrieveEvidence>[0],
      data.text,
      context.userId,
      3,
    );
    const analysis = await agents.runLiveTurnGraph(data.text, hits);
    await context.supabase.from("turn_analyses").insert({
      debate_id: data.debateId,
      user_id: context.userId,
      turn_index: data.turnIndex,
      fact_flags: JSON.parse(JSON.stringify(analysis.fact_flags)),
      fallacies: JSON.parse(JSON.stringify(analysis.fallacies)),
      emotion: JSON.parse(JSON.stringify(analysis.emotion)),
      clarity_score: analysis.clarity_score,
    });
    return analysis;
  });

/* ============================================================
 * ARGUMENT AGENT — draft an argument for the USER on request.
 * ============================================================ */
export const draftArgument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ debateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const agents = await import("./debate-agents.server");
    const [{ data: debate }, { data: msgs }] = await Promise.all([
      context.supabase.from("debates").select("*").eq("id", data.debateId).maybeSingle(),
      context.supabase
        .from("debate_messages")
        .select("role, content")
        .eq("debate_id", data.debateId)
        .order("turn_index", { ascending: true }),
    ]);
    if (!debate) throw new Error("Debate not found");
    const history = ((msgs ?? []) as Array<{ role: string; content: string }>).map((m) => ({
      role: m.role as "user" | "opponent",
      content: m.content,
    }));
    const hits = await agents.retrieveEvidence(
      context.supabase as unknown as Parameters<typeof agents.retrieveEvidence>[0],
      `${debate.topic}\n${history[history.length - 1]?.content ?? ""}`,
      context.userId,
      4,
    );
    const draft = await agents.draftUserArgument({
      topic: debate.topic,
      userStance: debate.user_stance as "for" | "against",
      aiPersona: debate.ai_persona,
      difficulty: debate.difficulty as "beginner" | "intermediate" | "expert",
      turnIndex: history.length,
      history,
      ragHits: hits,
    });
    return { draft, citations: hits.map((h, i) => ({ index: i + 1, title: h.title, source: h.source })) };
  });

/* ============================================================
 * CROSS-EXAMINATION AGENT — generate probing questions.
 * ============================================================ */
export const crossExamine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().min(3), argument: z.string().min(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const agents = await import("./debate-agents.server");
    const questions = await agents.generateCrossExamination(data.topic, data.argument, 3);
    return { questions };
  });

/* ============================================================
 * MEMORY AGENT surfaces (get / clear)
 * ============================================================ */
export const getMemory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (
      data ?? {
        user_id: context.userId,
        strengths: [],
        weaknesses: [],
        recurring_fallacies: [],
        style_notes: "",
        preferences: {},
        debates_analyzed: 0,
        updated_at: null,
      }
    );
  });

export const clearMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("user_memory").delete().eq("user_id", context.userId);
    return { ok: true };
  });

/* ============================================================
 * RECOMMENDATION AGENT surfaces
 * ============================================================ */
export const getRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recommendations")
      .select("*")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const agents = await import("./debate-agents.server");
    const { data: mem } = await context.supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const memory = mem
      ? {
          strengths: (mem.strengths as string[]) ?? [],
          weaknesses: (mem.weaknesses as string[]) ?? [],
          recurring_fallacies: (mem.recurring_fallacies as string[]) ?? [],
          style_notes: mem.style_notes ?? "",
          preferences: (mem.preferences as Record<string, unknown>) ?? {},
        }
      : { strengths: [], weaknesses: [], recurring_fallacies: [], style_notes: "", preferences: {} };

    const { data: recent } = await context.supabase
      .from("debates")
      .select("topic")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    const recs = await agents.recommendNext(
      memory,
      (recent ?? []).map((r) => r.topic),
      4,
    );
    if (recs.length > 0) {
      await context.supabase.from("recommendations").insert(
        recs.map((r) => ({
          user_id: context.userId,
          topic: r.topic,
          rationale: r.rationale,
          difficulty: r.difficulty,
          focus_skill: r.focus_skill,
        })),
      );
    }
    return { recommendations: recs };
  });

export const consumeRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("recommendations")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
