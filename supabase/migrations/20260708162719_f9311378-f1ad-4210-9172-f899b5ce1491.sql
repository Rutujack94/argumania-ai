
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  persona TEXT,
  total_debates INT NOT NULL DEFAULT 0,
  total_wins INT NOT NULL DEFAULT 0,
  average_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles TO anon;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by anyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DEBATES
CREATE TABLE public.debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  user_stance TEXT NOT NULL CHECK (user_stance IN ('for','against')),
  ai_persona TEXT NOT NULL DEFAULT 'balanced',
  difficulty TEXT NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner','intermediate','expert')),
  format TEXT NOT NULL DEFAULT 'text' CHECK (format IN ('text','voice','mixed')),
  seconds_per_turn INT NOT NULL DEFAULT 90,
  max_turns INT NOT NULL DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  overall_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debates TO authenticated;
GRANT ALL ON public.debates TO service_role;
ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debates own read"   ON public.debates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "debates own insert" ON public.debates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debates own update" ON public.debates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "debates own delete" ON public.debates FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_debates_user ON public.debates(user_id, created_at DESC);
CREATE TRIGGER trg_debates_updated BEFORE UPDATE ON public.debates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- DEBATE MESSAGES
CREATE TABLE public.debate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','opponent','system','coach')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  fact_checks JSONB DEFAULT '[]'::jsonb,
  duration_ms INT,
  turn_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_messages TO authenticated;
GRANT ALL ON public.debate_messages TO service_role;
ALTER TABLE public.debate_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msgs own read"   ON public.debate_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "msgs own insert" ON public.debate_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_msgs_debate ON public.debate_messages(debate_id, turn_index);

-- DEBATE SCORES (judge/coach report)
CREATE TABLE public.debate_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL UNIQUE REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logic_score      NUMERIC(5,2) NOT NULL,
  evidence_score   NUMERIC(5,2) NOT NULL,
  persuasion_score NUMERIC(5,2) NOT NULL,
  delivery_score   NUMERIC(5,2) NOT NULL,
  fact_accuracy    NUMERIC(5,2) NOT NULL,
  fallacy_penalty  NUMERIC(5,2) NOT NULL DEFAULT 0,
  overall          NUMERIC(5,2) NOT NULL,
  winner           TEXT CHECK (winner IN ('user','opponent','draw')),
  fallacies        JSONB DEFAULT '[]'::jsonb,
  strengths        JSONB DEFAULT '[]'::jsonb,
  weaknesses       JSONB DEFAULT '[]'::jsonb,
  coach_plan       JSONB DEFAULT '{}'::jsonb,
  summary          TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_scores TO authenticated;
GRANT ALL ON public.debate_scores TO service_role;
ALTER TABLE public.debate_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores own read"   ON public.debate_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "scores own insert" ON public.debate_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scores own update" ON public.debate_scores FOR UPDATE USING (auth.uid() = user_id);

-- KNOWLEDGE DOCS (RAG - 1536 dims from text-embedding-3-small)
CREATE TABLE public.knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source TEXT,
  chunk TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.knowledge_docs TO authenticated;
GRANT ALL ON public.knowledge_docs TO service_role;
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs read own or public" ON public.knowledge_docs FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "docs insert own" ON public.knowledge_docs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "docs delete own" ON public.knowledge_docs FOR DELETE
  USING (auth.uid() = user_id);
CREATE INDEX knowledge_docs_embedding_idx
  ON public.knowledge_docs USING hnsw (embedding vector_cosine_ops);

-- RAG match function
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  requesting_user uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, title text, source text, chunk text, similarity float)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.title, d.source, d.chunk,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_docs d
  WHERE d.is_public = true OR d.user_id = requesting_user
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- LEADERBOARD VIEW
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id, p.display_name, p.avatar_url,
  p.total_debates, p.total_wins, p.average_score,
  RANK() OVER (ORDER BY p.average_score DESC, p.total_wins DESC) AS rank
FROM public.profiles p
WHERE p.total_debates > 0;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
