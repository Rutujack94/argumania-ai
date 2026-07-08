import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { listDebates } from "@/lib/debate.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LovableDebate" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: debates = [] } = useQuery({
    queryKey: ["debates"],
    queryFn: () => listDebates(),
  });
  const completed = debates.filter((d) => d.status === "completed");
  const avg = completed.length
    ? Math.round(
        (completed.reduce((acc, d) => acc + Number(d.overall_score ?? 0), 0) /
          completed.length) *
          10,
      ) / 10
    : 0;

  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your debate progress at a glance.
          </p>
        </div>
        <Link
          to="/arena"
          className="rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-4 py-2 text-sm font-medium text-background shadow-glow"
        >
          + New Debate
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Debates" value={debates.length.toString()} />
        <StatCard label="Completed" value={completed.length.toString()} />
        <StatCard label="Avg. Score" value={avg.toString()} accent />
        <StatCard
          label="Best Score"
          value={
            completed.length
              ? Math.max(...completed.map((d) => Number(d.overall_score ?? 0))).toString()
              : "—"
          }
        />
      </div>

      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold">Recent Debates</h2>
        <div className="mt-4 glass overflow-hidden rounded-2xl">
          {debates.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              You haven't started a debate yet.{" "}
              <Link to="/arena" className="text-primary underline">Start one</Link>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Topic</th>
                  <th className="px-5 py-3">Stance</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Score</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {debates.slice(0, 10).map((d) => (
                  <tr key={d.id} className="border-t border-border/60">
                    <td className="px-5 py-3 font-medium">{d.topic}</td>
                    <td className="px-5 py-3 text-muted-foreground">{d.user_stance}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${d.status === "completed" ? "bg-[oklch(0.72_0.18_155)]/20 text-[oklch(0.85_0.15_155)]" : "bg-white/10 text-muted-foreground"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-display">{d.overall_score ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to="/debate/$id"
                        params={{ id: d.id }}
                        className="text-primary hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl ${accent ? "gradient-text" : ""}`}>{value}</div>
    </div>
  );
}
