import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteKnowledge, ingestKnowledge, listKnowledge } from "@/lib/knowledge.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge — LovableDebate" }] }),
  component: Knowledge,
});

function Knowledge() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => listKnowledge(),
  });
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const ingest = useMutation({
    mutationFn: () =>
      ingestKnowledge({ data: { title, source, content, isPublic } }),
    onSuccess: (res) => {
      toast.success(`Ingested ${res.chunks} chunks`);
      setTitle("");
      setSource("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ingest failed"),
  });
  const del = useMutation({
    mutationFn: (t: string) => deleteKnowledge({ data: { title: t } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">Knowledge Base</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ingest research, papers, or news articles. Chunks are embedded with
        text-embedding-3-small and retrieved during every debate turn.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-lg">Add a source</h2>
          <input
            placeholder="Title (e.g. IPCC AR6 Executive Summary)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-3 w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            placeholder="Source URL or citation"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <textarea
            placeholder="Paste article, paper abstract, or notes…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="mt-2 w-full resize-none rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Share with all users
            </label>
            <button
              onClick={() => {
                if (title.length < 2 || content.length < 20) {
                  toast.error("Add a title and enough content.");
                  return;
                }
                ingest.mutate();
              }}
              disabled={ingest.isPending}
              className="rounded-lg bg-gradient-to-r from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] px-4 py-2 text-sm font-medium text-background shadow-glow disabled:opacity-50"
            >
              {ingest.isPending ? "Embedding…" : "Ingest"}
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-lg">Your sources</h2>
          <div className="mt-3 space-y-2">
            {data.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border bg-white/5 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.source ?? "—"}
                    {d.is_public ? " · public" : " · private"}
                  </div>
                </div>
                <button
                  onClick={() => del.mutate(d.title)}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
            {data.length === 0 && (
              <div className="text-xs text-muted-foreground">No sources ingested yet.</div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
