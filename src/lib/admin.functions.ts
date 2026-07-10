import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

/** First-run bootstrap: if no admins exist yet, promote the current user. */
export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An admin already exists");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,display_name,avatar_url,xp,level,total_debates,total_wins,average_score,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    });
    return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "moderator", "user"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role })
        .select();
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }
    return { ok: true };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [users, debates, completed, docs] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("debates").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("debates")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabaseAdmin.from("knowledge_docs").select("id", { count: "exact", head: true }),
    ]);
    return {
      users: users.count ?? 0,
      debates: debates.count ?? 0,
      completed: completed.count ?? 0,
      knowledge_docs: docs.count ?? 0,
    };
  });

export const adminUpsertChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        challenge_date: z.string(),
        topic: z.string().min(5),
        difficulty: z.enum(["beginner", "intermediate", "expert"]),
        focus_skill: z.string().nullable().optional(),
        xp_reward: z.number().int().min(10).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("daily_challenges")
      .upsert(data, { onConflict: "challenge_date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("daily_challenges")
      .select("*")
      .order("challenge_date", { ascending: false })
      .limit(60);
    return data ?? [];
  });
