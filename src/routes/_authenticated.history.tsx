import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { listDebates } from "@/lib/debate.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — LovableDebate" }] }),
  component: History,
});

function History() {
  const { data = [] } = useQuery({ queryKey: ["debates"], queryFn: () => listDebates() });
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">All your past debates.</p>
      <div className="mt-6 grid gap-3">
        {data.map((d) => (
          <Link
            key={d.id}
            to="/debate/$id"
            params={{ id: d.id }}
            className="glass flex items-center justify-between rounded-2xl p-5 transition hover:border-primary/40"
          >
            <div>
              <div className="text-sm text-muted-foreground">
                {new Date(d.created_at).toLocaleString()}
              </div>
              <div className="mt-0.5 font-medium">{d.topic}</div>
              <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                <span>{d.user_stance}</span>·<span>{d.ai_persona}</span>·<span>{d.difficulty}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="font-display text-2xl gradient-text">
                {d.overall_score ?? "—"}
              </div>
            </div>
          </Link>
        ))}
        {data.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No debates yet.
          </div>
        )}
      </div>
    </AppShell>
  );
}
