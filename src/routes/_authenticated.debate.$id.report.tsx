import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getDebate } from "@/lib/debate.functions";

export const Route = createFileRoute("/_authenticated/debate/$id/report")({
  head: () => ({ meta: [{ title: "Debate Report — LovableDebate" }] }),
  component: Report,
});

const DIMS: Array<[key: string, label: string, color: string]> = [
  ["logic_score", "Logic", "from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)]"],
  ["evidence_score", "Evidence", "from-[oklch(0.78_0.16_210)] to-[oklch(0.72_0.18_155)]"],
  ["persuasion_score", "Persuasion", "from-[oklch(0.68_0.2_340)] to-[oklch(0.72_0.22_300)]"],
  ["delivery_score", "Delivery", "from-[oklch(0.82_0.16_85)] to-[oklch(0.72_0.18_155)]"],
  ["fact_accuracy", "Fact Accuracy", "from-[oklch(0.72_0.18_155)] to-[oklch(0.78_0.16_210)]"],
];

function Report() {
  const { id } = useParams({ from: "/_authenticated/debate/$id/report" });
  const { data, isLoading } = useQuery({
    queryKey: ["debate", id],
    queryFn: () => getDebate({ data: { id } }),
  });

  if (isLoading || !data || !data.debate) {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">Loading report…</div>
      </AppShell>
    );
  }
  const { debate, score } = data;
  if (!score) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-10 text-center">
          <h1 className="font-display text-xl">No report yet.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish more turns and press "End & Evaluate".
          </p>
          <Link
            to="/debate/$id"
            params={{ id }}
            className="mt-4 inline-block text-primary underline"
          >
            Back to debate
          </Link>
        </div>
      </AppShell>
    );
  }

  const fallacies = (score.fallacies as Array<{ name: string; quote: string; explanation: string }>) ?? [];
  const strengths = (score.strengths as string[]) ?? [];
  const weaknesses = (score.weaknesses as string[]) ?? [];
  const coach = (score.coach_plan as {
    focus_areas?: string[];
    exercises?: string[];
    weekly_targets?: string[];
  }) ?? {};

  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Judge Report
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold">{debate.topic}</h1>
        </div>
        <Link
          to="/debate/$id"
          params={{ id }}
          className="rounded-lg border border-border px-3 py-2 text-xs"
        >
          ← Transcript
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-8 text-center lg:col-span-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Overall Score
          </div>
          <div className="mt-3 font-display text-7xl gradient-text">
            {Math.round(Number(score.overall))}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">out of 100</div>
          <div className="mt-6 inline-flex rounded-full border border-border bg-white/5 px-4 py-1.5 text-xs uppercase tracking-wider">
            Winner:{" "}
            <span className="ml-1 font-semibold text-foreground">{score.winner}</span>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{score.summary}</p>
        </div>

        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground">
            Multi-Agent Breakdown
          </h2>
          <div className="mt-4 space-y-4">
            {DIMS.map(([k, label, color]) => {
              const v = Number((score as Record<string, unknown>)[k] ?? 0);
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs">
                    <span>{label}</span>
                    <span className="font-display">{Math.round(v)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color}`}
                      style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Number(score.fallacy_penalty) > 0 && (
              <div>
                <div className="flex justify-between text-xs text-destructive">
                  <span>Fallacy penalty</span>
                  <span>-{Math.round(Number(score.fallacy_penalty))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Strengths" items={strengths} tone="success" />
        <Section title="Weaknesses" items={weaknesses} tone="warning" />
      </div>

      {fallacies.length > 0 && (
        <div className="mt-6 glass rounded-2xl p-6">
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground">
            Logical Fallacies Detected
          </h2>
          <div className="mt-4 space-y-3">
            {fallacies.map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-white/5 p-4">
                <div className="text-sm font-semibold text-destructive">{f.name}</div>
                <div className="mt-1 text-xs italic text-muted-foreground">"{f.quote}"</div>
                <div className="mt-2 text-sm">{f.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 glass rounded-2xl p-6">
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground">
          Coach Plan
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PlanBlock title="Focus areas" items={coach.focus_areas ?? []} />
          <PlanBlock title="Exercises" items={coach.exercises ?? []} />
          <PlanBlock title="Weekly targets" items={coach.weekly_targets ?? []} />
        </div>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 rounded-full ${tone === "success" ? "bg-[oklch(0.72_0.18_155)]" : "bg-[oklch(0.82_0.16_85)]"}`}
            />
            <span>{s}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}
function PlanBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-white/5 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i}>• {it}</li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}
