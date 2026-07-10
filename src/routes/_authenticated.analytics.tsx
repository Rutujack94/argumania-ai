import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import {
  getAnalytics,
  getGamificationSummary,
  getDailyChallenge,
} from "@/lib/gamification.functions";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — AI Debate Coach" },
      { name: "description", content: "Skill radar, weekly & monthly trends, streaks, and personalized recommendations." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: () => getAnalytics() });
  const gam = useQuery({ queryKey: ["gam"], queryFn: () => getGamificationSummary() });
  const daily = useQuery({ queryKey: ["daily"], queryFn: () => getDailyChallenge() });

  const a = analytics.data;
  const g = gam.data;
  const d = daily.data;

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Your Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Personalized reports across your last 60 days of debating.
      </p>

      {/* Top row: level card + daily challenge */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Level</div>
          <div className="mt-1 font-display text-4xl font-semibold">{g?.level ?? 1}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            {g?.xp ?? 0} / {g?.nextLevelXp ?? 100} XP to next level
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)]"
              style={{
                width: `${Math.min(100, Math.round(
                  ((g?.xp ?? 0) - (g?.currentLevelXp ?? 0)) /
                    Math.max(1, (g?.nextLevelXp ?? 100) - (g?.currentLevelXp ?? 0)) *
                    100,
                ))}%`,
              }}
            />
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Streak</div>
          <div className="mt-1 font-display text-4xl font-semibold">
            {g?.profile?.streak_days ?? 0}🔥
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {g?.profile?.total_wins ?? 0} wins · {g?.profile?.total_debates ?? 0} debates
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Daily Challenge</div>
          {d?.challenge ? (
            <>
              <div className="mt-1 text-sm font-medium line-clamp-2">{d.challenge.topic}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Focus: {d.challenge.focus_skill ?? "General"} · +{d.challenge.xp_reward} XP
              </div>
              {d.completed ? (
                <div className="mt-3 text-xs text-primary">✓ Completed today</div>
              ) : (
                <Link
                  to="/arena"
                  className="mt-3 inline-block rounded-md bg-primary/15 px-3 py-1.5 text-xs text-primary"
                >
                  Take the challenge →
                </Link>
              )}
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Loading…</div>
          )}
        </div>
      </div>

      {/* Radar + trend */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Skill Radar</div>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={a?.radar ?? []}>
                <PolarGrid stroke="oklch(0.35 0.02 260)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "oklch(0.75 0.02 260)", fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "oklch(0.55 0.02 260)", fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="oklch(0.72 0.22 300)"
                  fill="oklch(0.72 0.22 300)"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Weekly Trend (last 8 weeks)
          </div>
          <div className="mt-2 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={a?.trend ?? []}>
                <CartesianGrid stroke="oklch(0.25 0.02 260)" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fill: "oklch(0.55 0.02 260)", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "oklch(0.55 0.02 260)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.15 0.02 260)",
                    border: "1px solid oklch(0.3 0.02 260)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="oklch(0.78 0.16 210)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="mt-6 glass rounded-2xl p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Activity Heatmap (last 60 days)
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {Array.from({ length: 60 }).map((_, i) => {
            const d = new Date(Date.now() - (59 - i) * 86400_000).toISOString().slice(0, 10);
            const v = a?.heatmap?.[d] ?? 0;
            const intensity = v === 0 ? 0.05 : Math.min(1, 0.2 + v * 0.25);
            return (
              <div
                key={d}
                title={`${d}: ${v} debate${v === 1 ? "" : "s"}`}
                className="h-4 w-4 rounded-sm"
                style={{ background: `oklch(0.72 0.22 300 / ${intensity})` }}
              />
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground">This week</div>
            <div className="font-display text-2xl">
              {a?.weekly?.overall ?? 0}
              <span className="text-sm text-muted-foreground"> avg · {a?.weekly?.count ?? 0} debates</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Last 30 days</div>
            <div className="font-display text-2xl">
              {a?.monthly?.overall ?? 0}
              <span className="text-sm text-muted-foreground"> avg · {a?.monthly?.count ?? 0} debates</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
