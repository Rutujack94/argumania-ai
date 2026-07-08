import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LovableDebate — Train with a multi-agent AI debate coach" },
      {
        name: "description",
        content:
          "Simulate real debates with AI opponents. Fact-check with RAG. Get judged by a multi-agent scoring system on logic, evidence, persuasion, and delivery.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { title: "Live AI Opponents", desc: "Text & voice debates with adjustable personas — Socratic, courtroom, academic, aggressive." },
  { title: "Multi-Agent Judge", desc: "Six specialized judges (logic, evidence, persuasion, delivery, fact-checker, fallacy detector) grade every turn." },
  { title: "RAG Fact-Checker", desc: "Retrieval-Augmented Generation over your uploaded sources plus vector search citations." },
  { title: "Voice Debates", desc: "Whisper-grade transcription, streaming TTS, real-time voice waveforms." },
  { title: "Coach Plans", desc: "Every debate ships a weekly practice plan with focus areas and exercises." },
  { title: "Leaderboards", desc: "Compete with debate clubs, cohorts, and UPSC aspirants across the platform." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 hero-bg" />
      <div className="pointer-events-none fixed -top-20 left-1/2 -z-10 h-[600px] w-[100vw] -translate-x-1/2 mesh-bg" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] font-display font-bold text-background">
            L
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            LovableDebate
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="rounded-md bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-4 py-2 text-sm font-medium text-background shadow-glow transition hover:opacity-90"
          >
            Start free
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-16 pt-10 md:grid-cols-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
            Multi-agent debate simulation · v1
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight md:text-6xl">
            Argue with an AI that <span className="gradient-text">actually pushes back.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            An enterprise-grade AI debate coach for students, lawyers, UPSC aspirants,
            and public speakers. Live opponents, RAG fact-checking, and a six-agent
            judging pipeline scoring every argument.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-6 py-3 text-sm font-medium text-background shadow-glow-lg transition hover:scale-[1.02]"
            >
              Enter the Arena →
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-border px-6 py-3 text-sm text-foreground hover:bg-white/5"
            >
              See how it works
            </a>
          </div>
          <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
            <div>
              <div className="font-display text-2xl text-foreground">12</div>
              AI Agents
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="font-display text-2xl text-foreground">6</div>
              Judge dimensions
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="font-display text-2xl text-foreground">RAG</div>
              Grounded evidence
            </div>
          </div>
        </div>
        <div className="relative">
          <img
            src={heroImg}
            alt="Two glowing AI minds exchanging arguments across a stream of ideas"
            width={1600}
            height={1000}
            className="rounded-2xl border border-border shadow-glow-lg"
          />
          <div className="glass absolute -bottom-6 -left-6 max-w-[240px] rounded-xl p-4">
            <div className="text-xs text-muted-foreground">Live Judge · Turn 3</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="font-display text-3xl gradient-text">87</div>
              <div className="text-xs text-muted-foreground">/ 100</div>
            </div>
            <div className="mt-1 text-xs">Strong evidence, tighten conclusion.</div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight md:text-4xl">
          A full debate ops stack, not a chatbot.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass group rounded-2xl p-6 transition hover:border-primary/40"
            >
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="glass rounded-3xl p-10 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Ready to sharpen your arguments?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free to start. Voice + text debates. Google sign-in in one click.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-block rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-6 py-3 text-sm font-medium text-background shadow-glow"
          >
            Get started
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-6 py-10 text-center text-xs text-muted-foreground">
        Built on Lovable · Multi-agent RAG · Voice & text debates
      </footer>
    </div>
  );
}
