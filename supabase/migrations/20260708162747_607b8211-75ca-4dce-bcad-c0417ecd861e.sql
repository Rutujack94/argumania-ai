
-- View should use querying user's rights
ALTER VIEW public.leaderboard SET (security_invoker = true);

-- handle_new_user is invoked by auth trigger; revoke from anon/auth to satisfy linter
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- match_knowledge: only authenticated users can call
REVOKE EXECUTE ON FUNCTION public.match_knowledge(vector, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge(vector, int, uuid) TO authenticated;

-- tg_set_updated_at: trigger only
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
