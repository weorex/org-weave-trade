REVOKE ALL ON public.profiles, public.organizations, public.organization_roles, public.organization_memberships, public.audit_logs FROM anon;
REVOKE ALL ON public.profiles, public.organizations, public.organization_roles, public.organization_memberships, public.audit_logs FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.organizations TO authenticated;
GRANT UPDATE(name,default_currency,default_country,timezone) ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_roles, public.organization_memberships, public.audit_logs TO authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid), public.has_org_role(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid), public.has_org_role(uuid,text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_organization(), public.create_user_profile(), public.audit_organization_changes() FROM PUBLIC, anon, authenticated;