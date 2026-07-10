
-- ============= ROLES =============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

DROP POLICY IF EXISTS "own roles readable" ON public.user_roles;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============= PROFILE GAMIFICATION COLUMNS =============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date date;

-- ============= XP EVENTS =============
CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  debate_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own xp readable" ON public.xp_events FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own xp insertable" ON public.xp_events FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE INDEX IF NOT EXISTS xp_events_user_created ON public.xp_events(user_id, created_at DESC);

-- ============= ACHIEVEMENTS =============
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏆',
  xp_reward integer NOT NULL DEFAULT 50,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated, anon;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "admins manage achievements" ON public.achievements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own achievements readable" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own achievements insertable" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);

-- ============= DAILY CHALLENGES =============
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL UNIQUE,
  topic text NOT NULL,
  difficulty text NOT NULL DEFAULT 'intermediate',
  focus_skill text,
  xp_reward integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_challenges TO authenticated, anon;
GRANT ALL ON public.daily_challenges TO service_role;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily challenges readable" ON public.daily_challenges FOR SELECT USING (true);
CREATE POLICY "admins manage daily challenges" ON public.daily_challenges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.user_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  debate_id uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);
GRANT SELECT, INSERT ON public.user_challenges TO authenticated;
GRANT ALL ON public.user_challenges TO service_role;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenges readable" ON public.user_challenges FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "own challenges insertable" ON public.user_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);

-- ============= SEED ACHIEVEMENTS =============
INSERT INTO public.achievements (code,title,description,icon,xp_reward,criteria) VALUES
  ('first_debate','First Steps','Complete your very first debate.','🎯',50,'{"type":"debates_count","gte":1}'),
  ('five_debates','Getting Warmed Up','Complete 5 debates.','🔥',100,'{"type":"debates_count","gte":5}'),
  ('twenty_debates','Seasoned Debater','Complete 20 debates.','🎖️',250,'{"type":"debates_count","gte":20}'),
  ('first_win','First Victory','Win your first debate.','🏆',100,'{"type":"wins_count","gte":1}'),
  ('streak_3','3-Day Streak','Debate 3 days in a row.','⚡',75,'{"type":"streak_days","gte":3}'),
  ('streak_7','Week Warrior','Debate 7 days in a row.','🌟',200,'{"type":"streak_days","gte":7}'),
  ('score_85','Sharp Mind','Score 85+ on a debate.','🧠',150,'{"type":"debate_score","gte":85}'),
  ('score_95','Master Orator','Score 95+ on a debate.','👑',400,'{"type":"debate_score","gte":95}'),
  ('level_5','Rising Voice','Reach Level 5.','📈',0,'{"type":"level","gte":5}'),
  ('level_10','Distinguished','Reach Level 10.','💎',0,'{"type":"level","gte":10}')
ON CONFLICT (code) DO NOTHING;
