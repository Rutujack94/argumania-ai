import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/debate.functions";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — LovableDebate" }] }),
  component: Leaderboard,
});

function Leaderboard() {
  const { data = [] } = useQuery({ queryKey: ["leaderboard"], queryFn: () => getLeaderboard() });
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Top debaters ranked by average score & wins.
      </p>
      <div className="mt-6 glass overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Rank</th>
              <th className="px-5 py-3">Debater</th>
              <th className="px-5 py-3">Debates</th>
              <th className="px-5 py-3">Wins</th>
              <th className="px-5 py-3">Avg Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id ?? row.rank} className="border-t border-border/60">
                <td className="px-5 py-3 font-display text-lg">
                  <span
                    className={
                      Number(row.rank) === 1
                        ? "gradient-text"
                        : Number(row.rank) <= 3
                          ? "text-secondary"
                          : ""
                    }
                  >
                    #{row.rank}
                  </span>
                </td>
                <td className="px-5 py-3">{row.display_name ?? "Anonymous"}</td>
                <td className="px-5 py-3">{row.total_debates}</td>
                <td className="px-5 py-3">{row.total_wins}</td>
                <td className="px-5 py-3 font-display">{row.average_score}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  Once anyone completes their first debate, they'll show up here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
