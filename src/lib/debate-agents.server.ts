// AI Debate Coach — Multi-agent orchestration (LangGraph-style DAG in TypeScript).
// Server-only. Each agent is a specialized node over the Lovable AI Gateway.
//
// Agents implemented (role / goal / prompt / inputs / outputs / tools):
//   1.  TopicAgent          — propose motions tailored to an audience.
//   2.  ResearchAgent       — retrieve grounded evidence from pgvector (RAG).
//   3.  ArgumentAgent       — construct user-side arguments (assist mode).
//   4.  CounterArgumentAgent- generate opponent's counter-argument (streamed).
//   5.  CrossExaminationAgent-generate probing cross-ex questions.
//   6.  FactCheckerAgent    — flag dubious empirical claims.
//   7.  LogicalFallacyAgent — detect named fallacies with quotes.
//   8.  SpeechEvaluationAgent-clarity/structure/delivery scoring.
//   9.  EmotionAnalysisAgent- valence/arousal/dominant emotion.
//  10.  JudgeAgent          — ensemble scoring + winner.
//  11.  CoachAgent          — personalized coaching plan (uses Memory).
//  12.  RecommendationAgent - next-topic recommendations from memory + weaknesses.
//  13.  MemoryAgent         — update long-term user profile (strengths etc).
//
// Orchestration graphs:
//   • liveTurnGraph: FactChecker → Fallacy → Emotion → SpeechEval  (parallel, fast)
//   • debateEndGraph: Research(context) → Judge → Coach → Memory → Recommendation
//
// SOLID:
//   • Single-Responsibility: each agent is one function.
//   • Open/Closed: add nodes by extending the graph, not editing existing ones.
//   • Dependency-Inversion: agents accept plain data; storage/RAG passed in.

import { chatCompletion, embed, type ChatMessage } from "./ai.server";

/* ============================================================
 * SHARED TYPES
 * ============================================================ */

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
  memory?: UserMemorySnapshot | null;
}

export interface UserMemorySnapshot {
  strengths: string[];
  weaknesses: string[];
  recurring_fallacies: string[];
  style_notes: string;
  preferences: Record<string, unknown>;
}

export interface FactFlag {
  claim: string;
  verdict: "likely_true" | "uncertain" | "likely_false";
  reasoning: string;
}

export interface FallacyHit {
  name: string;
  quote: string;
  explanation: string;
}

export interface EmotionReading {
  valence: number;   // -1..1
  arousal: number;   // 0..1
  dominant: string;  // e.g. "confident", "anxious"
}

export interface TurnAnalysis {
  fact_flags: FactFlag[];
  fallacies: FallacyHit[];
  emotion: EmotionReading;
  clarity_score: number;
}

/* ============================================================
 * PROMPTS (single source of truth for each agent's system prompt)
 * ============================================================ */

const PERSONAS: Record<string, string> = {
  balanced: "You are a fair, evidence-driven debater.",
  aggressive: "You are a sharp, combative debater who challenges every weak claim.",
  socratic: "You are a Socratic debater who probes assumptions with pointed questions.",
  academic: "You are a formal academic debater, citing frameworks and thinkers.",
  lawyer: "You are a courtroom-style lawyer, building tight logical cases.",
};

const DIFFICULTIES: Record<string, string> = {
  beginner: "Use accessible vocabulary. Keep arguments short (2-3 sentences).",
  intermediate: "Use structured arguments (claim → reasoning → example). 4-6 sentences.",
  expert: "Deploy rigorous logic, cite evidence, use rhetorical devices, and pre-empt counterarguments. 6-9 sentences.",
};

function personaTone(persona: string, difficulty: string): string {
  return `${PERSONAS[persona] ?? PERSONAS.balanced} ${DIFFICULTIES[difficulty] ?? DIFFICULTIES.intermediate}`;
}

/* ============================================================
 * 1. TOPIC AGENT
 * ============================================================ */

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

/* ============================================================
 * 2. RESEARCH AGENT (RAG)
 * ============================================================ */

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

/* ============================================================
 * 3. ARGUMENT AGENT (assist the user on their own turn)
 * ============================================================ */

export async function draftUserArgument(ctx: DebateContext): Promise<string> {
  const evidence = ctx.ragHits
    .map((h, i) => `[${i + 1}] ${h.title}: ${h.chunk}`)
    .join("\n");
  return await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content: `You are the ArgumentAgent. Draft ONE strong opening argument for the USER's side.
Structure: Claim → Reasoning → Evidence → Impact. Cite evidence inline as [n]. Plain prose, no headers.`,
      },
      {
        role: "user",
        content: `TOPIC: ${ctx.topic}\nUSER STANCE: ${ctx.userStance}\nEVIDENCE:\n${evidence || "(none)"}\nHISTORY:\n${ctx.history.map((m) => `${m.role}: ${m.content}`).join("\n") || "(fresh debate)"}`,
      },
    ],
  });
}

/* ============================================================
 * 4. COUNTER-ARGUMENT AGENT (streamed opponent turn)
 * ============================================================ */

export async function streamOpponentTurn(ctx: DebateContext): Promise<Response> {
  const aiStance = ctx.userStance === "for" ? "against" : "for";
  const ragBlock =
    ctx.ragHits.length > 0
      ? `\n\nRELEVANT EVIDENCE (from knowledge base):\n${ctx.ragHits
          .map((h, i) => `[${i + 1}] ${h.title}${h.source ? ` (${h.source})` : ""}: ${h.chunk}`)
          .join("\n")}\n\nWhen you use a fact from this evidence, cite it inline as [1], [2], etc.`
      : "";

  const memoryBlock =
    ctx.memory && (ctx.memory.weaknesses.length || ctx.memory.recurring_fallacies.length)
      ? `\n\nUSER PROFILE (private — use to calibrate difficulty, not to insult):
Recurring weaknesses: ${ctx.memory.weaknesses.slice(0, 5).join(", ") || "n/a"}
Recurring fallacies to gently pressure: ${ctx.memory.recurring_fallacies.slice(0, 5).join(", ") || "n/a"}`
      : "";

  const system = `You are the CounterArgumentAgent on the LovableDebate platform.
TOPIC: "${ctx.topic}"
Your stance: ${aiStance.toUpperCase()} the motion. User's stance: ${ctx.userStance.toUpperCase()}.

${personaTone(ctx.aiPersona, ctx.difficulty)}

Rules:
- Argue only your side. Never concede your position.
- Address the user's most recent point directly, then advance a new argument.
- Use plain prose, no markdown headers, no bullet points, no meta commentary.
- If evidence is provided below, weave it in naturally with inline [n] citations.
${ragBlock}${memoryBlock}`;

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...ctx.history.map<ChatMessage>((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
  ];
  if (ctx.turnIndex === 0) {
    messages.push({ role: "user", content: "Please open the debate with your first argument." });
  }

  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
}

/* ============================================================
 * 5. CROSS-EXAMINATION AGENT
 * ============================================================ */

export async function generateCrossExamination(
  topic: string,
  targetArgument: string,
  n = 3,
): Promise<string[]> {
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the CrossExaminationAgent. Produce ${n} sharp, targeted questions that probe the weakest assumption, missing evidence, or scope-error in the opponent argument. JSON: {"questions": string[]}`,
      },
      { role: "user", content: `TOPIC: ${topic}\n\nOPPONENT ARGUMENT:\n${targetArgument}` },
    ],
  });
  return (JSON.parse(raw) as { questions: string[] }).questions ?? [];
}

/* ============================================================
 * 6. FACT-CHECKER AGENT
 * ============================================================ */

export async function factCheckTurn(text: string, ragHits: RagHit[]): Promise<FactFlag[]> {
  if (text.length < 20) return [];
  const evidence = ragHits.map((h, i) => `[${i + 1}] ${h.title}: ${h.chunk}`).join("\n");
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the FactCheckerAgent. Identify at most 3 CHECKABLE empirical claims in the text (numbers, dates, causal claims, attributions). For each: verdict ∈ likely_true|uncertain|likely_false, one-sentence reasoning grounded in the evidence when available, otherwise general knowledge. Ignore value/policy claims. JSON: {"flags": [{"claim","verdict","reasoning"}]}`,
      },
      { role: "user", content: `EVIDENCE:\n${evidence || "(none)"}\n\nTEXT:\n${text}` },
    ],
  });
  return (JSON.parse(raw) as { flags: FactFlag[] }).flags ?? [];
}

/* ============================================================
 * 7. LOGICAL FALLACY AGENT
 * ============================================================ */

export async function detectFallacies(text: string): Promise<FallacyHit[]> {
  if (text.length < 20) return [];
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the LogicalFallacyAgent. Detect up to 3 formal or informal fallacies in the text. Each entry: name (e.g. "Straw Man", "Ad Hominem", "Hasty Generalization"), quote (verbatim phrase from text), explanation (one sentence). Return {"fallacies":[]} if none. JSON: {"fallacies":[{"name","quote","explanation"}]}`,
      },
      { role: "user", content: text },
    ],
  });
  return (JSON.parse(raw) as { fallacies: FallacyHit[] }).fallacies ?? [];
}

/* ============================================================
 * 8. SPEECH EVALUATION AGENT
 * ============================================================ */

export async function evaluateSpeech(text: string): Promise<{ clarity_score: number; notes: string }> {
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the SpeechEvaluationAgent. Score clarity/structure/concision on a 0-100 scale and give one actionable note. JSON: {"clarity_score": number, "notes": string}`,
      },
      { role: "user", content: text },
    ],
  });
  const j = JSON.parse(raw) as { clarity_score: number; notes: string };
  return { clarity_score: Math.max(0, Math.min(100, Math.round(j.clarity_score ?? 60))), notes: j.notes ?? "" };
}

/* ============================================================
 * 9. EMOTION ANALYSIS AGENT
 * ============================================================ */

export async function analyzeEmotion(text: string): Promise<EmotionReading> {
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the EmotionAnalysisAgent. From the text infer valence (-1..1), arousal (0..1), and a dominant single-word emotion (confident, anxious, angry, hopeful, defensive, empathic, sarcastic, calm). JSON: {"valence","arousal","dominant"}`,
      },
      { role: "user", content: text },
    ],
  });
  const j = JSON.parse(raw) as EmotionReading;
  return {
    valence: Math.max(-1, Math.min(1, Number(j.valence ?? 0))),
    arousal: Math.max(0, Math.min(1, Number(j.arousal ?? 0.3))),
    dominant: (j.dominant ?? "calm").toString().toLowerCase(),
  };
}

/* ============================================================
 * LIVE-TURN GRAPH (inline light analysis, parallel)
 * ============================================================ */

export async function runLiveTurnGraph(userText: string, ragHits: RagHit[]): Promise<TurnAnalysis> {
  const [facts, fallacies, emotion, speech] = await Promise.all([
    factCheckTurn(userText, ragHits).catch(() => []),
    detectFallacies(userText).catch(() => []),
    analyzeEmotion(userText).catch(() => ({ valence: 0, arousal: 0.3, dominant: "calm" } as EmotionReading)),
    evaluateSpeech(userText).catch(() => ({ clarity_score: 60, notes: "" })),
  ]);
  return { fact_flags: facts, fallacies, emotion, clarity_score: speech.clarity_score };
}

/* ============================================================
 * 10. JUDGE AGENT (ensemble)
 * ============================================================ */

export interface JudgeReport {
  logic_score: number;
  evidence_score: number;
  persuasion_score: number;
  delivery_score: number;
  fact_accuracy: number;
  fallacy_penalty: number;
  overall: number;
  winner: "user" | "opponent" | "draw";
  fallacies: FallacyHit[];
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
  memory?: UserMemorySnapshot | null;
}): Promise<JudgeReport> {
  const script = input.transcript
    .map((t) => `${t.role === "user" ? "USER" : "OPPONENT"}: ${t.content}`)
    .join("\n\n");

  const memoryContext = input.memory
    ? `\n\nUSER LONG-TERM PROFILE (for personalized coaching):
- Recurring weaknesses: ${input.memory.weaknesses.slice(0, 5).join(", ") || "n/a"}
- Recurring fallacies: ${input.memory.recurring_fallacies.slice(0, 5).join(", ") || "n/a"}
- Style: ${input.memory.style_notes || "n/a"}`
    : "";

  const raw = await chatCompletion({
    model: "google/gemini-2.5-pro",
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the JudgeAgent — an ensemble composing Logic, Evidence, Persuasion, Delivery, FactChecker, FallacyDetector, and Coach analyses.
Score each dimension 0-100. fallacy_penalty is 0-15 proportional to fallacies. overall = weighted average minus penalty.
Respond ONLY with valid JSON:
{
  "logic_score","evidence_score","persuasion_score","delivery_score","fact_accuracy","fallacy_penalty","overall": number,
  "winner": "user"|"opponent"|"draw",
  "fallacies": [{"name","quote","explanation"}],
  "strengths": [string], "weaknesses": [string],
  "coach_plan": {"focus_areas":[string],"exercises":[string],"weekly_targets":[string]},
  "summary": string
}
Judge ONLY the USER's performance for scores/strengths/weaknesses/coach_plan. "winner" compares user vs opponent overall.${memoryContext}`,
      },
      { role: "user", content: `TOPIC: ${input.topic}\nUSER STANCE: ${input.userStance}\n\nTRANSCRIPT:\n${script}` },
    ],
  });

  const jsonStr = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  return JSON.parse(jsonStr) as JudgeReport;
}

/* ============================================================
 * 11. COACH AGENT — already produced inside JudgeReport.coach_plan.
 *      Exposed separately for standalone coaching sessions.
 * ============================================================ */

export async function coachFromMemory(memory: UserMemorySnapshot): Promise<string> {
  return await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content: `You are the CoachAgent. Given a user's long-term debate profile, write a short (120-180 word) personalized coaching note in second person. Encouraging but specific.`,
      },
      { role: "user", content: JSON.stringify(memory) },
    ],
  });
}

/* ============================================================
 * 12. RECOMMENDATION AGENT
 * ============================================================ */

export interface Recommendation {
  topic: string;
  rationale: string;
  difficulty: "beginner" | "intermediate" | "expert";
  focus_skill: string;
}

export async function recommendNext(
  memory: UserMemorySnapshot,
  recentTopics: string[],
  n = 4,
): Promise<Recommendation[]> {
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.75,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the RecommendationAgent. Suggest ${n} next debate motions that target the user's weaknesses without repeating recent topics. Each item: topic (motion), rationale (one sentence tying it to a weakness/skill), difficulty ∈ beginner|intermediate|expert, focus_skill ∈ evidence|logic|persuasion|delivery|rebuttal|fact-accuracy. JSON: {"recommendations":[...]}`,
      },
      {
        role: "user",
        content: `PROFILE:\n${JSON.stringify(memory)}\n\nRECENT TOPICS (avoid):\n${recentTopics.join("\n") || "(none)"}`,
      },
    ],
  });
  return (JSON.parse(raw) as { recommendations: Recommendation[] }).recommendations ?? [];
}

/* ============================================================
 * 13. MEMORY AGENT — updates the long-term user profile from a debate + judge report.
 * ============================================================ */

export async function updateMemory(input: {
  prior: UserMemorySnapshot;
  report: JudgeReport;
}): Promise<UserMemorySnapshot> {
  const raw = await chatCompletion({
    model: "google/gemini-2.5-flash",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the MemoryAgent. Merge the new debate's findings into the user's long-term profile. Deduplicate; keep at most 8 strengths, 8 weaknesses, 8 recurring_fallacies (most-frequent first). style_notes is 1-2 sentences summarizing their voice. preserve preferences. Return JSON matching:
{"strengths":[string],"weaknesses":[string],"recurring_fallacies":[string],"style_notes":string,"preferences":object}`,
      },
      {
        role: "user",
        content: `PRIOR:\n${JSON.stringify(input.prior)}\n\nNEW REPORT:\n${JSON.stringify({
          strengths: input.report.strengths,
          weaknesses: input.report.weaknesses,
          fallacies: input.report.fallacies.map((f) => f.name),
          summary: input.report.summary,
        })}`,
      },
    ],
  });
  const j = JSON.parse(raw) as UserMemorySnapshot;
  return {
    strengths: (j.strengths ?? []).slice(0, 8),
    weaknesses: (j.weaknesses ?? []).slice(0, 8),
    recurring_fallacies: (j.recurring_fallacies ?? []).slice(0, 8),
    style_notes: j.style_notes ?? input.prior.style_notes ?? "",
    preferences: j.preferences ?? input.prior.preferences ?? {},
  };
}
