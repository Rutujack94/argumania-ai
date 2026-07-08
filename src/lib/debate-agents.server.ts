// Multi-agent orchestration for the AI Debate Coach.
// Each agent is a specialized prompt over the Lovable AI Gateway.
// Server-only.

import { chatCompletion, embed, type ChatMessage } from "./ai.server";

export interface RagHit {
  title: string;
  source: string | null;
  chunk: string;
  similarity: number;
}

export interface DebateContext {
  topic: string;
  userStance: "for" | "against";
  aiPersona: string;
  difficulty: "beginner" | "intermediate" | "expert";
  turnIndex: number;
  history: Array<{ role: "user" | "opponent"; content: string }>;
  ragHits: RagHit[];
}

function personaTone(persona: string, difficulty: string): string {
  const diffs: Record<string, string> = {
    beginner: "Use accessible vocabulary. Keep arguments short (2-3 sentences).",
    intermediate: "Use structured arguments (claim → reasoning → example). 4-6 sentences.",
    expert: "Deploy rigorous logic, cite evidence, use rhetorical devices, and pre-empt counterarguments. 6-9 sentences.",
  };
  const personas: Record<string, string> = {
    balanced: "You are a fair, evidence-driven debater.",
    aggressive: "You are a sharp, combative debater who challenges every weak claim.",
    socratic: "You are a Socratic debater who probes assumptions with pointed questions.",
    academic: "You are a formal academic debater, citing frameworks and thinkers.",
    lawyer: "You are a courtroom-style lawyer, building tight logical cases.",
  };
  return `${personas[persona] ?? personas.balanced} ${diffs[difficulty] ?? diffs.intermediate}`;
}

/** OPPONENT AGENT — streams a counter-argument from Gateway. Returns the SSE fetch Response for the caller to pipe through. */
export async function streamOpponentTurn(ctx: DebateContext): Promise<Response> {
  const aiStance = ctx.userStance === "for" ? "against" : "for";
  const ragBlock =
    ctx.ragHits.length > 0
      ? `\n\nRELEVANT EVIDENCE (from knowledge base):\n${ctx.ragHits
          .map((h, i) => `[${i + 1}] ${h.title}${h.source ? ` (${h.source})` : ""}: ${h.chunk}`)
          .join("\n")}\n\nWhen you use a fact from this evidence, cite it inline as [1], [2], etc.`
      : "";

  const system = `You are the AI opponent in a formal debate on the LovableDebate platform.
TOPIC: "${ctx.topic}"
Your stance: ${aiStance.toUpperCase()} the motion.
The user's stance: ${ctx.userStance.toUpperCase()}.

${personaTone(ctx.aiPersona, ctx.difficulty)}

Rules:
- Argue only your side. Never concede your position.
- Address the user's most recent point directly, then advance a new argument.
- Use plain prose, no markdown headers, no bullet points, no meta commentary.
- If evidence is provided below, weave it in naturally with inline [n] citations.
${ragBlock}`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...ctx.history.map<ChatMessage>((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
  ];
  if (ctx.turnIndex === 0) {
    messages.push({
      role: "user",
      content: "Please open the debate with your first argument.",
    });
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      stream: true,
      temperature: 0.75,
    }),
  });
  return res;
}

/** RESEARCH / RAG AGENT — embed the topic + last user message and retrieve top-k chunks. */
export async function retrieveEvidence(
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  query: string,
  userId: string,
  k = 4,
): Promise<RagHit[]> {
  try {
    const vec = await embed(query.slice(0, 1500));
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: `[${vec.join(",")}]`,
      match_count: k,
      requesting_user: userId,
    });
    if (error) return [];
    const rows = (data ?? []) as Array<{
      title: string;
      source: string | null;
      chunk: string;
      similarity: number;
    }>;
    return rows.filter((r) => r.similarity > 0.55);
  } catch {
    return [];
  }
}

/** JUDGE + COACH AGENT — evaluates the full transcript, returns structured report. */
export interface JudgeReport {
  logic_score: number;
  evidence_score: number;
  persuasion_score: number;
  delivery_score: number;
  fact_accuracy: number;
  fallacy_penalty: number;
  overall: number;
  winner: "user" | "opponent" | "draw";
  fallacies: Array<{ name: string; quote: string; explanation: string }>;
  strengths: string[];
  weaknesses: string[];
  coach_plan: {
    focus_areas: string[];
    exercises: string[];
    weekly_targets: string[];
  };
  summary: string;
}

export async function judgeDebate(input: {
  topic: string;
  userStance: string;
  transcript: Array<{ role: string; content: string }>;
}): Promise<JudgeReport> {
  const script = input.transcript
    .map((t) => `${t.role === "user" ? "USER" : "OPPONENT"}: ${t.content}`)
    .join("\n\n");

  const raw = await chatCompletion({
    model: "google/gemini-2.5-pro",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an ensemble of specialized AI judges evaluating a formal debate transcript. Compose the analyses of:
- Logic Judge (validity, structure, inference quality)
- Evidence Judge (use of facts, citations, sourcing)
- Persuasion Judge (rhetoric, emotional appeal, framing)
- Delivery Judge (clarity, concision, coherence)
- Fact Checker (accuracy of empirical claims — flag anything dubious)
- Fallacy Detector (name specific fallacies with quotes)
- Coach (produce a concrete improvement plan)

Score each dimension 0-100. Compute a fallacy_penalty (0-15) proportional to fallacies found. Overall = weighted average minus penalty.
Respond ONLY with valid JSON matching this schema:
{
  "logic_score": number, "evidence_score": number, "persuasion_score": number,
  "delivery_score": number, "fact_accuracy": number, "fallacy_penalty": number,
  "overall": number, "winner": "user"|"opponent"|"draw",
  "fallacies": [{"name": string, "quote": string, "explanation": string}],
  "strengths": [string], "weaknesses": [string],
  "coach_plan": {"focus_areas": [string], "exercises": [string], "weekly_targets": [string]},
  "summary": string
}
Judge ONLY the USER's performance for scores/strengths/weaknesses/coach_plan. "winner" compares user vs opponent overall.`,
      },
      {
        role: "user",
        content: `TOPIC: ${input.topic}\nUSER STANCE: ${input.userStance}\n\nTRANSCRIPT:\n${script}`,
      },
    ],
  });

  // Robust JSON extraction
  const jsonStr = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  const parsed = JSON.parse(jsonStr) as JudgeReport;
  return parsed;
}

/** TOPIC AGENT — suggests debate topics tailored to a user category. */
export async function suggestTopics(audience: string, count = 6): Promise<string[]> {
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.9,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Return a JSON object {"topics": string[]} with debatable, well-known motions phrased as "This house believes …" or a clean assertion. No trivia.',
      },
      { role: "user", content: `Give me ${count} debate topics suitable for ${audience || "general practice"}.` },
    ],
  });
  const parsed = JSON.parse(raw) as { topics: string[] };
  return parsed.topics ?? [];
}
