REVOKE ALL ON public.data_captures FROM anon,authenticated;
GRANT SELECT,INSERT ON public.data_captures TO authenticated;
GRANT ALL ON public.data_captures TO service_role;
COMMENT ON TABLE public.data_captures IS 'Reviewed user-initiated captures only. Immutable tenant and actor-scoped history; no browsing history or raw HTML.';