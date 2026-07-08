
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  requesting_user uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, title text, source text, chunk text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT d.id, d.title, d.source, d.chunk,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_docs d
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;
