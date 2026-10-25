CREATE OR REPLACE FUNCTION public.list_org_member_names(p_org uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 IF NOT public.is_org_member(p_org) THEN RAISE EXCEPTION 'Organization access denied'; END IF;
 RETURN QUERY SELECT m.user_id, p.display_name FROM public.organization_memberships m JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=p_org;
END;
$$;
REVOKE ALL ON FUNCTION public.list_org_member_names(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_org_member_names(uuid) TO authenticated, service_role;