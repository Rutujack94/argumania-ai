import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getGamificationSummary } from "@/lib/gamification.functions";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — AI Debate Coach" },
      { name: "description", content: "Badges, XP milestones, and unlockables earned through debating." },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const { data } = useQuery({ queryKey: ["gam"], queryFn: () => getGamificationSummary() });
  const unlockedIds = new Set((data?.unlocked ?? []).map((u) => u.achievement_id));

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Achievements</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {unlockedIds.size} of {data?.achievements?.length ?? 0} unlocked · Level {data?.level ?? 1} · {data?.xp ?? 0} XP
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.achievements ?? []).map((a) => {
          const unlocked = unlockedIds.has(a.id);
          return (
            <div
              key={a.id}
              className={`glass rounded-2xl p-5 ${unlocked ? "" : "opacity-50"}`}
            >
              <div className="text-3xl">{a.icon}</div>
              <div className="mt-2 font-display text-lg font-semibold">{a.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{a.description}</div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-primary">+{a.xp_reward} XP</span>
                {unlocked ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Unlocked</span>
                ) : (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-muted-foreground">Locked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 glass rounded-2xl p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent XP</div>
        <ul className="mt-3 space-y-2 text-sm">
          {(data?.recentXp ?? []).map((x, i) => (
            <li key={i} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
              <span>{x.reason}</span>
              <span className="text-primary">+{x.amount}</span>
            </li>
          ))}
          {(!data?.recentXp || data.recentXp.length === 0) && (
            <li className="text-muted-foreground">No XP events yet — complete a debate to earn XP.</li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}
