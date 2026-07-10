import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** XP required to reach a given level (quadratic curve). */
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.6));
}
export function levelForXp(xp: number): number {
  let l = 1;
  while (xp >= xpForLevel(l + 1)) l++;
  return l;
}

interface Criteria {
  type: "debates_count" | "wins_count" | "streak_days" | "debate_score" | "level";
  gte: number;
}

/** Award XP, update level & streak, evaluate achievement unlocks. */
export const awardXp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount: z.number().int().min(1).max(2000),
        reason: z.string().min(2).max(120),
        debateId: z.string().uuid().nullable().optional(),
        debateScore: z.number().min(0).max(100).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase.from("xp_events").insert({
      user_id: userId,
      amount: data.amount,
      reason: data.reason,
      debate_id: data.debateId ?? null,
    });

    const { data: prof } = await supabase
      .from("profiles")
      .select("xp,level,streak_days,last_active_date,total_debates,total_wins")
      .eq("id", userId)
      .maybeSingle();

    const today = new Date().toISOString().slice(0, 10);
    let streak = prof?.streak_days ?? 0;
    if (prof?.last_active_date !== today) {
      const y = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
      streak = prof?.last_active_date === y ? streak + 1 : 1;
    }
    const newXp = (prof?.xp ?? 0) + data.amount;
    const newLevel = levelForXp(newXp);
    await supabase
      .from("profiles")
      .update({ xp: newXp, level: newLevel, streak_days: streak, last_active_date: today })
      .eq("id", userId);

    // Evaluate achievements
    const [{ data: achievements }, { data: owned }] = await Promise.all([
      supabase.from("achievements").select("id,code,criteria,xp_reward"),
      supabase.from("user_achievements").select("achievement_id").eq("user_id", userId),
    ]);
    const ownedSet = new Set((owned ?? []).map((r) => r.achievement_id));
    const unlocked: string[] = [];
    const stats = {
      debates_count: prof?.total_debates ?? 0,
      wins_count: prof?.total_wins ?? 0,
      streak_days: streak,
      debate_score: data.debateScore ?? 0,
      level: newLevel,
    };
    for (const a of achievements ?? []) {
      if (ownedSet.has(a.id)) continue;
      const c = a.criteria as unknown as Criteria;
      const val = stats[c.type];
      if (typeof val === "number" && val >= c.gte) {
        await supabase.from("user_achievements").insert({ user_id: userId, achievement_id: a.id });
        if (a.xp_reward > 0) {
          await supabase
            .from("xp_events")
            .insert({ user_id: userId, amount: a.xp_reward, reason: `Achievement: ${a.code}` });
        }
        unlocked.push(a.code);
      }
    }
    return { xp: newXp, level: newLevel, streak, unlocked };
  });

export const getGamificationSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profRes, achievementsRes, ownedRes, xpRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("xp,level,streak_days,total_debates,total_wins,average_score")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("achievements").select("*").order("xp_reward", { ascending: true }),
      supabase.from("user_achievements").select("achievement_id,unlocked_at").eq("user_id", userId),
      supabase
        .from("xp_events")
        .select("amount,reason,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const xp = profRes.data?.xp ?? 0;
    const level = profRes.data?.level ?? 1;
    return {
      profile: profRes.data,
      xp,
      level,
      nextLevelXp: xpForLevel(level + 1),
      currentLevelXp: xpForLevel(level),
      achievements: achievementsRes.data ?? [],
      unlocked: ownedRes.data ?? [],
      recentXp: xpRes.data ?? [],
    };
  });

/** Analytics — radar, trend, heatmap, weekly/monthly summary. */
export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 60 * 86400_000).toISOString();
    const { data: scores } = await supabase
      .from("debate_scores")
      .select(
        "logic_score,evidence_score,persuasion_score,delivery_score,fact_accuracy,fallacy_penalty,overall,created_at",
      )
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    const rows = scores ?? [];

    const avg = (k: keyof (typeof rows)[number]) =>
      rows.length ? rows.reduce((s, r) => s + Number(r[k] ?? 0), 0) / rows.length : 0;
    const radar = [
      { skill: "Logic", value: Math.round(avg("logic_score")) },
      { skill: "Evidence", value: Math.round(avg("evidence_score")) },
      { skill: "Persuasion", value: Math.round(avg("persuasion_score")) },
      { skill: "Delivery", value: Math.round(avg("delivery_score")) },
      { skill: "Facts", value: Math.round(avg("fact_accuracy")) },
    ];

    // Weekly trend (last 8 weeks)
    const trend: Array<{ week: string; overall: number; count: number }> = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 7 * 86400_000);
      const end = new Date(now.getTime() - i * 7 * 86400_000);
      const bucket = rows.filter((r) => {
        const d = new Date(r.created_at);
        return d >= start && d < end;
      });
      trend.push({
        week: end.toISOString().slice(0, 10),
        overall: bucket.length
          ? Math.round(bucket.reduce((s, r) => s + Number(r.overall), 0) / bucket.length)
          : 0,
        count: bucket.length,
      });
    }

    // Heatmap — activity per day (last 60 days)
    const heatmap: Record<string, number> = {};
    for (const r of rows) {
      const d = r.created_at.slice(0, 10);
      heatmap[d] = (heatmap[d] ?? 0) + 1;
    }

    const weekly = trend[trend.length - 1] ?? { week: "", overall: 0, count: 0 };
    const monthly = {
      count: rows.filter((r) => new Date(r.created_at) > new Date(Date.now() - 30 * 86400_000))
        .length,
      overall: (() => {
        const bucket = rows.filter(
          (r) => new Date(r.created_at) > new Date(Date.now() - 30 * 86400_000),
        );
        return bucket.length
          ? Math.round(bucket.reduce((s, r) => s + Number(r.overall), 0) / bucket.length)
          : 0;
      })(),
    };

    return { radar, trend, heatmap, weekly, monthly, totalAnalyzed: rows.length };
  });

/** Daily challenge — get today's + user's completion status. */
export const getDailyChallenge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    let { data: challenge } = await supabase
      .from("daily_challenges")
      .select("*")
      .eq("challenge_date", today)
      .maybeSingle();

    if (!challenge) {
      // Auto-generate a challenge via topic agent
      try {
        const { suggestTopics } = await import("./debate-agents.server");
        const topics = await suggestTopics("general audience", 1);
        const topic = topics[0] ?? "Should AI-generated content require mandatory disclosure?";
        const focus = ["Logic", "Evidence", "Persuasion", "Delivery"][
          new Date().getDate() % 4
        ];
        const { data: created } = await supabase
          .from("daily_challenges")
          .insert({
            challenge_date: today,
            topic,
            difficulty: "intermediate",
            focus_skill: focus,
            xp_reward: 150,
          })
          .select("*")
          .maybeSingle();
        challenge = created;
      } catch (e) {
        console.error("daily challenge generation failed", e);
      }
    }

    if (!challenge) return { challenge: null, completed: false };
    const { data: completion } = await supabase
      .from("user_challenges")
      .select("*")
      .eq("user_id", userId)
      .eq("challenge_id", challenge.id)
      .maybeSingle();
    return { challenge, completed: !!completion };
  });

export const completeDailyChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ challengeId: z.string().uuid(), debateId: z.string().uuid().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ch } = await supabase
      .from("daily_challenges")
      .select("xp_reward")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!ch) throw new Error("Challenge not found");
    const { error } = await supabase.from("user_challenges").insert({
      user_id: userId,
      challenge_id: data.challengeId,
      debate_id: data.debateId ?? null,
    });
    if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
    return { xp_reward: ch.xp_reward };
  });

/** Leaderboard v2 — XP-based ranking. */
export const getXpLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id,display_name,avatar_url,xp,level,streak_days,total_debates,total_wins")
    .order("xp", { ascending: false })
    .limit(50);
  return data ?? [];
});
