-- USER MEMORY (Memory Agent)
CREATE TABLE public.user_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  recurring_fallacies jsonb NOT NULL DEFAULT '[]'::jsonb,
  style_notes text NOT NULL DEFAULT '',
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  debates_analyzed int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_memory TO authenticated;
GRANT ALL ON public.user_memory TO service_role;
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory read"   ON public.user_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own memory insert" ON public.user_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own memory update" ON public.user_memory FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own memory delete" ON public.user_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TURN ANALYSES (inline light-agent output per user turn)
CREATE TABLE public.turn_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_index int NOT NULL,
  fact_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  fallacies jsonb NOT NULL DEFAULT '[]'::jsonb,
  emotion jsonb NOT NULL DEFAULT '{}'::jsonb,
  clarity_score int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX turn_analyses_debate_idx ON public.turn_analyses(debate_id, turn_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turn_analyses TO authenticated;
GRANT ALL ON public.turn_analyses TO service_role;
ALTER TABLE public.turn_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own turn analyses"       ON public.turn_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own turn analyses write" ON public.turn_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RECOMMENDATIONS (Recommendation Agent)
CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  rationale text NOT NULL,
  difficulty text NOT NULL DEFAULT 'intermediate',
  focus_skill text,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);
CREATE INDEX recommendations_user_idx ON public.recommendations(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recs read"   ON public.recommendations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own recs insert" ON public.recommendations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own recs update" ON public.recommendations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);