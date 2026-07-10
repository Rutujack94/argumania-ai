import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListChallenges,
  adminListUsers,
  adminSetRole,
  adminStats,
  adminUpsertChallenge,
  claimFirstAdmin,
  isAdmin,
} from "@/lib/admin.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — AI Debate Coach" },
      { name: "description", content: "Platform administration: users, roles, daily challenges, and knowledge base." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
  const claim = useMutation({
    mutationFn: () => claimFirstAdmin(),
    onSuccess: () => {
      toast.success("You are now an admin");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (admin.isLoading) {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">Checking permissions…</div>
      </AppShell>
    );
  }
  if (!admin.data?.admin) {
    return (
      <AppShell>
        <h1 className="font-display text-3xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are not an administrator. If no admin has been assigned yet, you can claim the first admin role.
        </p>
        <button
          onClick={() => claim.mutate()}
          disabled={claim.isPending}
          className="mt-4 rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {claim.isPending ? "Claiming…" : "Claim first admin"}
        </button>
      </AppShell>
    );
  }
  return <AdminDashboard />;
}

function AdminDashboard() {
  const qc = useQueryClient();
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminStats() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => adminListUsers() });
  const challenges = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: () => adminListChallenges(),
  });
  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "moderator"; grant: boolean }) =>
      adminSetRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const [form, setForm] = useState({
    challenge_date: new Date().toISOString().slice(0, 10),
    topic: "",
    difficulty: "intermediate" as "beginner" | "intermediate" | "expert",
    focus_skill: "Logic",
    xp_reward: 150,
  });
  const upsert = useMutation({
    mutationFn: () => adminUpsertChallenge({ data: form }),
    onSuccess: () => {
      toast.success("Challenge saved");
      qc.invalidateQueries({ queryKey: ["admin-challenges"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Admin Console</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Users", stats.data?.users],
          ["Debates", stats.data?.debates],
          ["Completed", stats.data?.completed],
          ["Knowledge Docs", stats.data?.knowledge_docs],
        ].map(([label, v]) => (
          <div key={label as string} className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 font-display text-3xl font-semibold">{v ?? 0}</div>
          </div>
        ))}
      </div>

      <section className="mt-8 glass rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold">Users & Roles</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="pb-2">User</th>
                <th className="pb-2">Level / XP</th>
                <th className="pb-2">Debates</th>
                <th className="pb-2">Roles</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="py-2">{u.display_name ?? u.id.slice(0, 8)}</td>
                  <td className="py-2">
                    L{u.level} · {u.xp} XP
                  </td>
                  <td className="py-2">
                    {u.total_debates} ({u.total_wins} wins)
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                          {r}
                        </span>
                      ))}
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setRole.mutate({
                            userId: u.id,
                            role: "admin",
                            grant: !u.roles.includes("admin"),
                          })
                        }
                        className="rounded-md border border-border px-2 py-1 text-xs"
                      >
                        {u.roles.includes("admin") ? "Revoke admin" : "Make admin"}
                      </button>
                      <button
                        onClick={() =>
                          setRole.mutate({
                            userId: u.id,
                            role: "moderator",
                            grant: !u.roles.includes("moderator"),
                          })
                        }
                        className="rounded-md border border-border px-2 py-1 text-xs"
                      >
                        {u.roles.includes("moderator") ? "Revoke mod" : "Make mod"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 glass rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold">Daily Challenges</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <input
            type="date"
            value={form.challenge_date}
            onChange={(e) => setForm({ ...form, challenge_date: e.target.value })}
            className="rounded-md border border-border bg-background/40 px-2 py-1 text-sm"
          />
          <input
            placeholder="Topic"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            className="md:col-span-2 rounded-md border border-border bg-background/40 px-2 py-1 text-sm"
          />
          <select
            value={form.difficulty}
            onChange={(e) =>
              setForm({ ...form, difficulty: e.target.value as typeof form.difficulty })
            }
            className="rounded-md border border-border bg-background/40 px-2 py-1 text-sm"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
          <button
            onClick={() => upsert.mutate()}
            disabled={upsert.isPending || form.topic.length < 5}
            className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
          >
            {upsert.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        <ul className="mt-5 space-y-2 text-sm">
          {(challenges.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between border-b border-white/5 pb-2">
              <div>
                <div className="font-medium">{c.topic}</div>
                <div className="text-xs text-muted-foreground">
                  {c.challenge_date} · {c.difficulty} · {c.focus_skill} · +{c.xp_reward} XP
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
