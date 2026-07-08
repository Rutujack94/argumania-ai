import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createDebate, suggestTopicsFn } from "@/lib/debate.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/arena")({
  head: () => ({ meta: [{ title: "New Debate — LovableDebate" }] }),
  component: Arena,
});

const PERSONAS = [
  { id: "balanced", label: "Balanced", desc: "Evidence-driven, fair" },
  { id: "aggressive", label: "Aggressive", desc: "Sharp, combative" },
  { id: "socratic", label: "Socratic", desc: "Probes assumptions" },
  { id: "academic", label: "Academic", desc: "Formal, framework-heavy" },
  { id: "lawyer", label: "Lawyer", desc: "Courtroom-style" },
];

function Arena() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [stance, setStance] = useState<"for" | "against">("for");
  const [persona, setPersona] = useState("balanced");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "expert">("intermediate");
  const [format, setFormat] = useState<"text" | "voice" | "mixed">("mixed");
  const [maxTurns, setMaxTurns] = useState(6);
  const [audience, setAudience] = useState("");

  const suggest = useMutation({
    mutationFn: (aud: string) => suggestTopicsFn({ data: { audience: aud } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const create = useMutation({
    mutationFn: () =>
      createDebate({
        data: {
          topic,
          userStance: stance,
          aiPersona: persona,
          difficulty,
          format,
          maxTurns,
          secondsPerTurn: 90,
        },
      }),
    onSuccess: (row) => {
      navigate({ to: "/debate/$id", params: { id: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <div>
        <h1 className="font-display text-3xl font-semibold">New Debate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your motion, pick an AI persona, and enter the arena.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Motion / Topic
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="This house believes that AI should be regulated by an international treaty."
            className="mt-2 w-full rounded-lg border border-border bg-background/40 px-3 py-3 text-sm outline-none focus:border-primary"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Optional: audience (e.g. UPSC, law school)"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={() => suggest.mutate(audience)}
              disabled={suggest.isPending}
              className="rounded-lg border border-border bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              {suggest.isPending ? "Generating…" : "✨ Suggest topics"}
            </button>
          </div>
          {suggest.data && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggest.data.topics.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className="rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs hover:border-primary"
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your Stance
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["for", "against"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStance(s)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium capitalize transition ${
                    stance === s
                      ? "border-primary bg-primary/15 shadow-glow"
                      : "border-border bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {s} the motion
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Opponent
          </h3>
          <div className="mt-3 grid gap-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={`flex flex-col rounded-lg border px-3 py-2 text-left text-sm transition ${
                  persona === p.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="font-medium">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.desc}</span>
              </button>
            ))}
          </div>

          <h3 className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Difficulty
          </h3>
          <div className="mt-3 flex gap-2">
            {(["beginner", "intermediate", "expert"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize ${
                  difficulty === d ? "border-primary bg-primary/10" : "border-border bg-white/5"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <h3 className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Format
          </h3>
          <div className="mt-3 flex gap-2">
            {(["text", "voice", "mixed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize ${
                  format === f ? "border-primary bg-primary/10" : "border-border bg-white/5"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Max turns: {maxTurns}
            </label>
            <input
              type="range"
              min={2}
              max={12}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Number(e.target.value))}
              className="mt-2 w-full accent-[oklch(0.72_0.22_300)]"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => {
            if (topic.trim().length < 5) {
              toast.error("Enter a topic (≥ 5 chars).");
              return;
            }
            create.mutate();
          }}
          disabled={create.isPending}
          className="rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-6 py-3 text-sm font-medium text-background shadow-glow disabled:opacity-50"
        >
          {create.isPending ? "Starting…" : "Enter the Arena →"}
        </button>
      </div>
    </AppShell>
  );
}
