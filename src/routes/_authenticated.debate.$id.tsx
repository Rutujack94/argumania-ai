import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { evaluateDebate, getDebate, saveMessage } from "@/lib/debate.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { createParser } from "eventsource-parser";

export const Route = createFileRoute("/_authenticated/debate/$id")({
  head: () => ({ meta: [{ title: "Live Debate — LovableDebate" }] }),
  component: LiveDebate,
});

interface MsgLite {
  id: string;
  role: string;
  content: string;
  turn_index: number;
  citations?: unknown;
}

function LiveDebate() {
  const { id } = useParams({ from: "/_authenticated/debate/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["debate", id],
    queryFn: () => getDebate({ data: { id } }),
  });

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const streamRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length, streamText]);

  const debate = data?.debate;
  const messages = (data?.messages ?? []) as MsgLite[];
  const nextTurn = messages.length;
  const finished = debate?.status === "completed";
  const canEvaluate = messages.filter((m) => m.role === "user").length >= 2;

  const save = useMutation({
    mutationFn: async (m: {
      role: "user" | "opponent";
      content: string;
      turnIndex: number;
      citations?: unknown[];
    }) =>
      saveMessage({
        data: {
          debateId: id,
          role: m.role,
          content: m.content,
          turnIndex: m.turnIndex,
          citations: m.citations as never,
        },
      }),
  });

  const evaluate = useMutation({
    mutationFn: () => evaluateDebate({ data: { debateId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debate", id] });
      navigate({ to: "/debate/$id/report", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Evaluation failed"),
  });

  async function playTts(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "onyx" }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  async function submitTurn() {
    if (!input.trim() || streaming) return;
    const userText = input.trim();
    setInput("");
    const turn = nextTurn;

    // Optimistic: save user message
    await save.mutateAsync({ role: "user", content: userText, turnIndex: turn });
    await qc.invalidateQueries({ queryKey: ["debate", id] });

    // Stream opponent
    setStreaming(true);
    setStreamText("");
    const ctrl = new AbortController();
    streamRef.current = ctrl;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ debateId: id }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        toast.error(`Opponent failed: ${t.slice(0, 120)}`);
        setStreaming(false);
        return;
      }
      const citationsHeader = res.headers.get("X-Rag-Citations");
      const citations: unknown[] = citationsHeader ? JSON.parse(citationsHeader) : [];

      let full = "";
      const parser = createParser({
        onEvent(evt) {
          if (evt.data === "[DONE]") return;
          try {
            const chunk = JSON.parse(evt.data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              full += delta;
              setStreamText(full);
            }
          } catch {
            // ignore keep-alives
          }
        },
      });
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(value);
      }

      if (full.trim().length > 0) {
        await save.mutateAsync({
          role: "opponent",
          content: full,
          turnIndex: turn + 1,
          citations,
        });
        if (voiceOn) playTts(full);
      }
      setStreamText("");
      await qc.invalidateQueries({ queryKey: ["debate", id] });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : "Stream failed");
      }
    } finally {
      setStreaming(false);
      streamRef.current = null;
    }
  }

  async function toggleRecord() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 2048) {
          toast.error("Recording too short.");
          setRecording(false);
          return;
        }
        setTranscribing(true);
        try {
          const fd = new FormData();
          const ext = rec.mimeType.includes("mp4") ? "mp4" : "webm";
          fd.append("file", blob, `speech.${ext}`);
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          const json = (await res.json()) as { text?: string };
          setInput((prev) => (prev ? prev + " " + (json.text ?? "") : json.text ?? ""));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      rec.onstop = ((prev) => {
        return () => {
          setRecording(false);
          prev.call(rec);
        };
      })(rec.onstop as () => void);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  const summary = useMemo(() => {
    const userTurns = messages.filter((m) => m.role === "user").length;
    const oppTurns = messages.filter((m) => m.role === "opponent").length;
    return { userTurns, oppTurns };
  }, [messages]);

  if (isLoading || !debate) {
    return (
      <AppShell>
        <div className="text-sm text-muted-foreground">Loading debate…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Motion · {debate.difficulty} · {debate.ai_persona}
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold">{debate.topic}</h1>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
              You: {debate.user_stance}
            </span>
            <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-secondary">
              AI: {debate.user_stance === "for" ? "against" : "for"}
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-muted-foreground">
              Turns {summary.userTurns + summary.oppTurns}/{debate.max_turns * 2}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVoiceOn((v) => !v)}
            className={`rounded-lg border px-3 py-2 text-xs ${voiceOn ? "border-primary bg-primary/10 text-primary" : "border-border bg-white/5"}`}
          >
            🔊 Voice {voiceOn ? "on" : "off"}
          </button>
          <button
            disabled={!canEvaluate || evaluate.isPending || finished}
            onClick={() => evaluate.mutate()}
            className="rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-4 py-2 text-sm font-medium text-background shadow-glow disabled:opacity-50"
          >
            {finished ? "View Report" : evaluate.isPending ? "Judging…" : "End & Evaluate"}
          </button>
          {finished && (
            <button
              onClick={() => navigate({ to: "/debate/$id/report", params: { id } })}
              className="rounded-lg border border-border px-3 py-2 text-xs"
            >
              Open Report
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 glass rounded-2xl p-2">
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && !streamText && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Open with your first argument — text or press the mic to speak.
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} citations={m.citations as never} />
          ))}
          {streamText && <Bubble role="opponent" content={streamText} streaming />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mt-4 glass rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={toggleRecord}
            disabled={streaming || transcribing || finished}
            className={`grid h-11 w-11 place-items-center rounded-full ${recording ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"} shadow-glow disabled:opacity-40`}
            title={recording ? "Stop" : "Record"}
          >
            {recording ? (
              <div className="flex h-4 items-center gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="block h-4 w-0.5 origin-center bg-current animate-voice-wave"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            ) : transcribing ? (
              "…"
            ) : (
              "🎙"
            )}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming || transcribing || finished}
            rows={2}
            placeholder={finished ? "Debate ended." : "Make your argument…"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitTurn();
              }
            }}
            className="flex-1 resize-none rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={submitTurn}
            disabled={streaming || !input.trim() || finished}
            className="rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-4 py-2 text-sm font-medium text-background shadow-glow disabled:opacity-50"
          >
            {streaming ? "AI arguing…" : "Send ⌘↵"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Bubble({
  role,
  content,
  streaming,
  citations,
}: {
  role: string;
  content: string;
  streaming?: boolean;
  citations?: Array<{ index: number; title: string; source: string | null }>;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-white/5"
        }`}
      >
        <div className="text-[10px] font-medium uppercase tracking-wider opacity-70">
          {isUser ? "You" : "AI Opponent"}
        </div>
        <div className="prose prose-sm prose-invert mt-1 max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        {streaming && (
          <div className="mt-1 inline-flex h-3 w-3">
            <span className="h-full w-full animate-pulse rounded-full bg-current opacity-60" />
          </div>
        )}
        {citations && Array.isArray(citations) && citations.length > 0 && (
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] opacity-80">
            <div className="font-medium">Sources</div>
            <ul className="mt-1 list-none space-y-0.5">
              {citations.map((c) => (
                <li key={c.index}>
                  [{c.index}] {c.title}
                  {c.source ? ` — ${c.source}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
