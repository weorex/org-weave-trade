-- Phase 6: custom roles, invitations, statuses, approvals, allowlisted workflows, notifications, rate limits.
ALTER TABLE public.organization_roles DROP CONSTRAINT organization_roles_role_key_check;
ALTER TABLE public.organization_roles ADD CONSTRAINT organization_roles_role_key_check CHECK (role_key ~ '^[a-z][a-z0-9_]{2,39}$');
ALTER TABLE public.organization_roles ADD COLUMN is_system boolean NOT NULL DEFAULT false;
UPDATE public.organization_roles SET is_system = true WHERE role_key IN ('owner','admin','member');

CREATE TABLE public.role_permissions(
 organization_id uuid NOT NULL, role_key text NOT NULL, permission text NOT NULL,
 PRIMARY KEY(organization_id, role_key, permission),
 FOREIGN KEY(organization_id, role_key) REFERENCES public.organization_roles(organization_id, role_key) ON DELETE CASCADE,
 CHECK (permission IN ('members.invite','members.manage','roles.manage','workflows.manage','workflows.run','approvals.decide','entities.transition','audit.read')));

CREATE TABLE public.organization_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 role_key text NOT NULL, token_hash bytea NOT NULL UNIQUE, created_by uuid NOT NULL, expires_at timestamptz NOT NULL,
 accepted_by uuid, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id, role_key) REFERENCES public.organization_roles(organization_id, role_key), CHECK (role_key <> 'owner'));

CREATE TABLE public.status_transitions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, entity_type_id uuid NOT NULL,
 from_status text NOT NULL CHECK (from_status ~ '^[a-z][a-z0-9_]{1,39}$'), to_status text NOT NULL CHECK (to_status ~ '^[a-z][a-z0-9_]{1,39}$'),
 requires_approval boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
 UNIQUE(organization_id, entity_type_id, from_status, to_status), CHECK (from_status <> to_status));

CREATE TABLE public.entity_states(
 entity_id uuid PRIMARY KEY, organization_id uuid NOT NULL, status text NOT NULL DEFAULT 'new', assignee_user_id uuid,
 updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id, entity_id) REFERENCES public.entities(organization_id, id) ON DELETE CASCADE);

CREATE TABLE public.approval_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, entity_id uuid NOT NULL,
 from_status text NOT NULL, to_status text NOT NULL, requested_by uuid NOT NULL, reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 1000),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','stale')),
 decided_by uuid, decided_at timestamptz, decision_note text NOT NULL DEFAULT '' CHECK (length(decision_note) <= 1000), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id, entity_id) REFERENCES public.entities(organization_id, id) ON DELETE CASCADE);
CREATE UNIQUE INDEX approval_one_pending ON public.approval_requests(entity_id) WHERE status = 'pending';

CREATE TABLE public.workflows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 entity_type_id uuid NOT NULL, name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120), definition jsonb NOT NULL,
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1, created_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id, id));

CREATE TABLE public.workflow_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, workflow_id uuid NOT NULL, workflow_version integer NOT NULL,
 definition jsonb NOT NULL, entity_id uuid NOT NULL, request_id uuid NOT NULL, created_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','pending_approval')),
 attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3, last_error text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 FOREIGN KEY(organization_id, workflow_id) REFERENCES public.workflows(organization_id, id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id, entity_id) REFERENCES public.entities(organization_id, id) ON DELETE CASCADE,
 UNIQUE(organization_id, created_by, request_id));

CREATE TABLE public.workflow_run_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE, organization_id uuid NOT NULL,
 attempt integer NOT NULL, step_index integer NOT NULL, action text NOT NULL, outcome text NOT NULL CHECK (outcome IN ('ok','failed','pending','rolled_back')),
 message text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT clock_timestamp());

CREATE TABLE public.notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, title text NOT NULL, body text NOT NULL DEFAULT '', link_entity_id uuid, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX notifications_user ON public.notifications(user_id, organization_id, created_at DESC);

CREATE TABLE public.rate_limit_counters(
 organization_id uuid NOT NULL, user_id uuid NOT NULL, action text NOT NULL, window_start timestamptz NOT NULL, hits integer NOT NULL DEFAULT 0,
 PRIMARY KEY(organization_id, user_id, action, window_start));

-- Grants: reads only; every write goes through the permission-checked functions below.
REVOKE ALL ON public.role_permissions, public.organization_invitations, public.status_transitions, public.entity_states, public.approval_requests, public.workflows, public.workflow_runs, public.workflow_run_logs, public.notifications, public.rate_limit_counters FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.role_permissions, public.status_transitions, public.entity_states, public.approval_requests, public.workflows, public.workflow_runs, public.workflow_run_logs, public.notifications TO authenticated;
GRANT SELECT (id, organization_id, role_key, created_by, expires_at, accepted_by, accepted_at, revoked_at, created_at) ON public.organization_invitations TO authenticated;
GRANT ALL ON public.role_permissions, public.organization_invitations, public.status_transitions, public.entity_states, public.approval_requests, public.workflows, public.workflow_runs, public.workflow_run_logs, public.notifications, public.rate_limit_counters TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(p_org uuid, p_perm text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT public.is_org_member(p_org) AND EXISTS(SELECT 1 FROM public.organization_memberships m WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND m.status='active'
  AND (m.role_key IN ('owner','admin') OR EXISTS(SELECT 1 FROM public.role_permissions r WHERE r.organization_id=p_org AND r.role_key=m.role_key AND r.permission=p_perm))) $$;

CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY invitations_read ON public.organization_invitations FOR SELECT TO authenticated USING (public.has_permission(organization_id,'members.invite'));
CREATE POLICY transitions_read ON public.status_transitions FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY states_read ON public.entity_states FOR SELECT TO authenticated USING (public.can_trade_entity(organization_id, entity_id, false));
CREATE POLICY approvals_read ON public.approval_requests FOR SELECT TO authenticated USING (public.can_trade_entity(organization_id, entity_id, false) AND (requested_by=auth.uid() OR public.has_permission(organization_id,'approvals.decide')));
CREATE POLICY workflows_read ON public.workflows FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY runs_read ON public.workflow_runs FOR SELECT TO authenticated USING (public.is_org_member(organization_id) AND (created_by=auth.uid() OR public.has_permission(organization_id,'workflows.manage')));
CREATE POLICY run_logs_read ON public.workflow_run_logs FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.workflow_runs r WHERE r.id=run_id AND public.is_org_member(r.organization_id) AND (r.created_by=auth.uid() OR public.has_permission(r.organization_id,'workflows.manage'))));
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.is_org_member(organization_id));
CREATE POLICY audit_read_permission ON public.audit_logs FOR SELECT TO authenticated USING (public.has_permission(organization_id,'audit.read'));

-- Internal helpers (not callable by clients).
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_org uuid, p_action text, p_limit integer, p_window_seconds integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE w timestamptz; n integer; BEGIN
 w := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
 INSERT INTO public.rate_limit_counters(organization_id,user_id,action,window_start,hits) VALUES(p_org,auth.uid(),p_action,w,1)
 ON CONFLICT (organization_id,user_id,action,window_start) DO UPDATE SET hits=public.rate_limit_counters.hits+1 RETURNING hits INTO n;
 DELETE FROM public.rate_limit_counters WHERE window_start < now() - interval '2 days' AND user_id=auth.uid();
 IF n > p_limit THEN RAISE EXCEPTION 'Rate limit exceeded; please wait and try again'; END IF; END $$;

CREATE OR REPLACE FUNCTION public.notify_user(p_org uuid, p_user uuid, p_title text, p_body text, p_entity uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN IF p_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=p_org AND user_id=p_user AND status='active') THEN RETURN; END IF;
 INSERT INTO public.notifications(organization_id,user_id,title,body,link_entity_id) VALUES(p_org,p_user,left(p_title,160),left(coalesce(p_body,''),1000),p_entity); END $$;

CREATE OR REPLACE FUNCTION public.write_audit(p_org uuid, p_action text, p_type text, p_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id) VALUES(p_org,auth.uid(),p_action,p_type,p_id) $$;

CREATE OR REPLACE FUNCTION public.apply_entity_status(p_org uuid, p_entity uuid, p_to text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a uuid; BEGIN
 INSERT INTO public.entity_states(entity_id,organization_id,status,updated_by,updated_at) VALUES(p_entity,p_org,p_to,auth.uid(),now())
 ON CONFLICT (entity_id) DO UPDATE SET status=excluded.status, updated_by=excluded.updated_by, updated_at=now() RETURNING assignee_user_id INTO a;
 PERFORM public.write_audit(p_org,'entity.status_changed','entity',p_entity);
 IF a IS NOT NULL AND a <> auth.uid() THEN PERFORM public.notify_user(p_org,a,'Status changed to '||p_to,'',p_entity); END IF; END $$;

-- Requests a transition: applies it, or opens an approval when the rule needs one. Returns 'applied' or 'pending'.
CREATE OR REPLACE FUNCTION public.request_entity_status(p_org uuid, p_entity uuid, p_to text, p_reason text, p_force_approval boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t uuid; cur text; rule public.status_transitions; BEGIN
 SELECT entity_type_id INTO t FROM public.entities WHERE id=p_entity AND organization_id=p_org;
 IF t IS NULL OR NOT public.can_entity(p_org,t,'read') OR NOT public.can_entity(p_org,t,'update') OR NOT public.has_permission(p_org,'entities.transition') THEN RAISE EXCEPTION 'Status change access denied'; END IF;
 SELECT status INTO cur FROM public.entity_states WHERE entity_id=p_entity FOR UPDATE; cur := coalesce(cur,'new');
 SELECT * INTO rule FROM public.status_transitions WHERE organization_id=p_org AND entity_type_id=t AND from_status=cur AND to_status=p_to;
 IF NOT FOUND THEN RAISE EXCEPTION 'Status change from % to % is not allowed', cur, p_to; END IF;
 IF rule.requires_approval OR p_force_approval THEN
  IF EXISTS(SELECT 1 FROM public.approval_requests WHERE entity_id=p_entity AND status='pending') THEN RAISE EXCEPTION 'An approval is already pending for this record'; END IF;
  INSERT INTO public.approval_requests(organization_id,entity_id,from_status,to_status,requested_by,reason) VALUES(p_org,p_entity,cur,p_to,auth.uid(),left(coalesce(p_reason,''),1000));
  PERFORM public.write_audit(p_org,'approval.requested','entity',p_entity); RETURN 'pending';
 END IF;
 PERFORM public.apply_entity_status(p_org,p_entity,p_to); RETURN 'applied'; END $$;

-- Workflow definitions: an allowlist of four actions with exact keys. Nothing is ever evaluated as code.
CREATE OR REPLACE FUNCTION public.validate_workflow_definition(p_org uuid, p_def jsonb) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s jsonb; a text; BEGIN
 IF jsonb_typeof(p_def) IS DISTINCT FROM 'array' OR jsonb_array_length(p_def) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Workflow needs 1 to 20 steps'; END IF;
 FOR s IN SELECT * FROM jsonb_array_elements(p_def) LOOP
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid workflow step'; END IF;
  a := s->>'action';
  IF a IN ('set_status','request_approval') THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('action','to')) OR coalesce(s->>'to','') !~ '^[a-z][a-z0-9_]{1,39}$' THEN RAISE EXCEPTION 'Invalid status step'; END IF;
  ELSIF a = 'notify' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('action','recipient','role','message')) OR coalesce(s->>'recipient','') NOT IN ('assignee','requester','role')
    OR length(btrim(coalesce(s->>'message',''))) NOT BETWEEN 1 AND 300
    OR ((s->>'recipient')='role' AND NOT EXISTS(SELECT 1 FROM public.organization_roles WHERE organization_id=p_org AND role_key=s->>'role'))
    OR ((s->>'recipient')<>'role' AND s ? 'role') THEN RAISE EXCEPTION 'Invalid notification step'; END IF;
  ELSIF a = 'assign' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('action','user_id')) OR coalesce(s->>'user_id','') !~ '^[0-9a-f-]{36}$'
    OR NOT EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=p_org AND user_id=(s->>'user_id')::uuid AND status='active') THEN RAISE EXCEPTION 'Invalid assignment step'; END IF;
  ELSE RAISE EXCEPTION 'Workflow action is not allowed'; END IF;
 END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.execute_workflow_run(p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.workflow_runs; s jsonb; i integer := 0; logs jsonb := '[]'; outcome text; final text := 'succeeded'; msg text; l jsonb; BEGIN
 SELECT * INTO r FROM public.workflow_runs WHERE id=p_run FOR UPDATE;
 UPDATE public.workflow_runs SET attempts=attempts+1, status='running', last_error='' WHERE id=p_run RETURNING * INTO r;
 BEGIN
  FOR s IN SELECT * FROM jsonb_array_elements(r.definition) LOOP
   outcome := 'ok'; msg := '';
   IF s->>'action' = 'set_status' THEN
    IF public.request_entity_status(r.organization_id, r.entity_id, s->>'to', 'Workflow', false) = 'pending' THEN outcome := 'pending'; final := 'pending_approval'; msg := 'Approval required'; END IF;
   ELSIF s->>'action' = 'request_approval' THEN
    PERFORM public.request_entity_status(r.organization_id, r.entity_id, s->>'to', 'Workflow', true); outcome := 'pending'; final := 'pending_approval';
   ELSIF s->>'action' = 'assign' THEN
    IF NOT EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=r.organization_id AND user_id=(s->>'user_id')::uuid AND status='active') THEN RAISE EXCEPTION 'Assignee is no longer an active member'; END IF;
    INSERT INTO public.entity_states(entity_id,organization_id,assignee_user_id,updated_by) VALUES(r.entity_id,r.organization_id,(s->>'user_id')::uuid,auth.uid())
    ON CONFLICT (entity_id) DO UPDATE SET assignee_user_id=excluded.assignee_user_id, updated_by=excluded.updated_by, updated_at=now();
    PERFORM public.notify_user(r.organization_id,(s->>'user_id')::uuid,'A record was assigned to you','',r.entity_id);
   ELSIF s->>'action' = 'notify' THEN
    IF s->>'recipient' = 'requester' THEN PERFORM public.notify_user(r.organization_id,r.created_by,s->>'message','',r.entity_id);
    ELSIF s->>'recipient' = 'assignee' THEN PERFORM public.notify_user(r.organization_id,(SELECT assignee_user_id FROM public.entity_states WHERE entity_id=r.entity_id),s->>'message','',r.entity_id);
    ELSE PERFORM public.notify_user(r.organization_id,m.user_id,s->>'message','',r.entity_id) FROM public.organization_memberships m WHERE m.organization_id=r.organization_id AND m.role_key=s->>'role' AND m.status='active'; END IF;
   ELSE RAISE EXCEPTION 'Workflow action is not allowed'; END IF;
   logs := logs || jsonb_build_object('i',i,'a',s->>'action','o',outcome,'m',msg); i := i+1;
   EXIT WHEN outcome='pending';
  END LOOP;
 EXCEPTION WHEN OTHERS THEN
  -- Every step of this attempt is rolled back together; only the failure is recorded.
  final := 'failed'; msg := left(SQLERRM,500);
  SELECT coalesce(jsonb_agg(x || jsonb_build_object('o','rolled_back')),'[]') INTO logs FROM jsonb_array_elements(logs) x;
  logs := logs || jsonb_build_object('i',i,'a',coalesce(s->>'action','unknown'),'o','failed','m',msg);
 END;
 FOR l IN SELECT * FROM jsonb_array_elements(logs) LOOP
  INSERT INTO public.workflow_run_logs(run_id,organization_id,attempt,step_index,action,outcome,message) VALUES(r.id,r.organization_id,r.attempts,(l->>'i')::integer,l->>'a',l->>'o',coalesce(l->>'m',''));
 END LOOP;
 UPDATE public.workflow_runs SET status=final, last_error=CASE WHEN final='failed' THEN msg ELSE '' END, finished_at=now() WHERE id=r.id;
 PERFORM public.write_audit(r.organization_id,'workflow.'||final,'workflow_run',r.id);
 IF final='failed' THEN PERFORM public.notify_user(r.organization_id,r.created_by,'Workflow failed',msg,r.entity_id); END IF;
 RETURN jsonb_build_object('runId',r.id,'status',final,'attempts',r.attempts,'error',CASE WHEN final='failed' THEN msg ELSE '' END); END $$;

-- Client-callable operations.
CREATE OR REPLACE FUNCTION public.save_custom_role(p_org uuid, p_key text, p_name text, p_permissions text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p text; BEGIN
 IF NOT public.has_permission(p_org,'roles.manage') THEN RAISE EXCEPTION 'Role management access denied'; END IF;
 IF p_key IS NULL OR p_key !~ '^[a-z][a-z0-9_]{2,39}$' OR p_key IN ('owner','admin') THEN RAISE EXCEPTION 'Invalid role key'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 80 OR coalesce(array_length(p_permissions,1),0) > 8 THEN RAISE EXCEPTION 'Invalid role'; END IF;
 FOREACH p IN ARRAY coalesce(p_permissions,'{}') LOOP
  IF NOT public.has_permission(p_org,p) THEN RAISE EXCEPTION 'You cannot grant a permission you do not hold'; END IF; END LOOP;
 PERFORM public.hit_rate_limit(p_org,'roles.save',30,3600);
 INSERT INTO public.organization_roles(organization_id,role_key,display_name) VALUES(p_org,p_key,btrim(p_name)) ON CONFLICT (organization_id,role_key) DO UPDATE SET display_name=excluded.display_name;
 DELETE FROM public.role_permissions WHERE organization_id=p_org AND role_key=p_key;
 INSERT INTO public.role_permissions(organization_id,role_key,permission) SELECT DISTINCT p_org,p_key,x FROM unnest(coalesce(p_permissions,'{}')) x;
 PERFORM public.write_audit(p_org,'role.saved','role',NULL); END $$;

CREATE OR REPLACE FUNCTION public.create_invitation(p_org uuid, p_role text, p_hours integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE tok text; iid uuid; exp timestamptz; BEGIN
 IF NOT public.has_permission(p_org,'members.invite') THEN RAISE EXCEPTION 'Invitation access denied'; END IF;
 IF p_role = 'owner' OR NOT EXISTS(SELECT 1 FROM public.organization_roles WHERE organization_id=p_org AND role_key=p_role) THEN RAISE EXCEPTION 'Invalid role'; END IF;
 IF p_role = 'admin' AND NOT public.has_org_role(p_org,ARRAY['owner']) THEN RAISE EXCEPTION 'Only the owner can invite administrators'; END IF;
 IF p_hours NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Invitations last 1 to 168 hours'; END IF;
 PERFORM public.hit_rate_limit(p_org,'invite.create',20,3600);
 tok := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''); exp := now() + make_interval(hours => p_hours);
 INSERT INTO public.organization_invitations(organization_id,role_key,token_hash,created_by,expires_at) VALUES(p_org,p_role,sha256(convert_to(tok,'UTF8')),auth.uid(),exp) RETURNING id INTO iid;
 PERFORM public.write_audit(p_org,'invitation.created','invitation',iid);
 RETURN jsonb_build_object('id',iid,'token',tok,'expiresAt',exp); END $$;

CREATE OR REPLACE FUNCTION public.revoke_invitation(p_org uuid, p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN IF NOT public.has_permission(p_org,'members.invite') THEN RAISE EXCEPTION 'Invitation access denied'; END IF;
 UPDATE public.organization_invitations SET revoked_at=now() WHERE id=p_id AND organization_id=p_org AND accepted_at IS NULL AND revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF; PERFORM public.write_audit(p_org,'invitation.revoked','invitation',p_id); END $$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE inv public.organization_invitations; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to accept the invitation'; END IF;
 PERFORM public.hit_rate_limit('00000000-0000-0000-0000-000000000000','invite.accept',10,3600);
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
 SELECT * INTO inv FROM public.organization_invitations WHERE token_hash=sha256(convert_to(p_token,'UTF8')) FOR UPDATE;
 IF NOT FOUND OR inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL OR inv.expires_at < now()
  OR NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=inv.organization_id AND status='active') THEN RAISE EXCEPTION 'Invitation is invalid or expired'; END IF;
 IF EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=inv.organization_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'You already belong to this organization'; END IF;
 INSERT INTO public.organization_memberships(organization_id,user_id,role_key,status) VALUES(inv.organization_id,auth.uid(),inv.role_key,'active');
 UPDATE public.organization_invitations SET accepted_by=auth.uid(), accepted_at=now() WHERE id=inv.id;
 PERFORM public.write_audit(inv.organization_id,'invitation.accepted','invitation',inv.id);
 PERFORM public.notify_user(inv.organization_id,inv.created_by,'Your invitation was accepted','',NULL);
 RETURN inv.organization_id; END $$;

CREATE OR REPLACE FUNCTION public.update_member(p_org uuid, p_membership uuid, p_role text, p_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE m public.organization_memberships; BEGIN
 IF NOT public.has_permission(p_org,'members.manage') THEN RAISE EXCEPTION 'Member management access denied'; END IF;
 SELECT * INTO m FROM public.organization_memberships WHERE id=p_membership AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 IF m.user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own access'; END IF;
 IF m.role_key = 'owner' OR p_role = 'owner' THEN RAISE EXCEPTION 'Ownership cannot be changed here'; END IF;
 IF (m.role_key = 'admin' OR p_role = 'admin') AND NOT public.has_org_role(p_org,ARRAY['owner']) THEN RAISE EXCEPTION 'Only the owner can change administrators'; END IF;
 IF p_status NOT IN ('active','suspended') OR NOT EXISTS(SELECT 1 FROM public.organization_roles WHERE organization_id=p_org AND role_key=p_role) THEN RAISE EXCEPTION 'Invalid member change'; END IF;
 IF NOT public.has_org_role(p_org,ARRAY['owner','admin']) AND EXISTS(SELECT 1 FROM public.role_permissions r WHERE r.organization_id=p_org AND r.role_key=p_role AND NOT public.has_permission(p_org,r.permission)) THEN RAISE EXCEPTION 'You cannot grant a permission you do not hold'; END IF;
 UPDATE public.organization_memberships SET role_key=p_role, status=p_status WHERE id=m.id;
 PERFORM public.write_audit(p_org,'member.updated','membership',m.id); END $$;

CREATE OR REPLACE FUNCTION public.save_status_transition(p_org uuid, p_type uuid, p_from text, p_to text, p_requires_approval boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN IF NOT public.has_permission(p_org,'workflows.manage') OR NOT EXISTS(SELECT 1 FROM public.entity_types WHERE id=p_type AND organization_id=p_org) THEN RAISE EXCEPTION 'Workflow access denied'; END IF;
 INSERT INTO public.status_transitions(organization_id,entity_type_id,from_status,to_status,requires_approval) VALUES(p_org,p_type,p_from,p_to,coalesce(p_requires_approval,false))
 ON CONFLICT (organization_id,entity_type_id,from_status,to_status) DO UPDATE SET requires_approval=excluded.requires_approval;
 PERFORM public.write_audit(p_org,'transition.saved','entity_type',p_type); END $$;

CREATE OR REPLACE FUNCTION public.transition_entity(p_org uuid, p_entity uuid, p_to text, p_reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN PERFORM public.hit_rate_limit(p_org,'entity.transition',120,3600); RETURN public.request_entity_status(p_org,p_entity,p_to,p_reason,false); END $$;

CREATE OR REPLACE FUNCTION public.decide_approval(p_org uuid, p_id uuid, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a public.approval_requests; cur text; BEGIN
 IF NOT public.has_permission(p_org,'approvals.decide') THEN RAISE EXCEPTION 'Approval access denied'; END IF;
 SELECT * INTO a FROM public.approval_requests WHERE id=p_id AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR a.status <> 'pending' THEN RAISE EXCEPTION 'Approval is not pending'; END IF;
 IF a.requested_by = auth.uid() THEN RAISE EXCEPTION 'You cannot approve your own request'; END IF;
 IF NOT public.can_trade_entity(p_org,a.entity_id,true) THEN RAISE EXCEPTION 'Approval access denied'; END IF;
 SELECT coalesce((SELECT status FROM public.entity_states WHERE entity_id=a.entity_id FOR UPDATE),'new') INTO cur;
 IF p_approve AND cur <> a.from_status THEN
  UPDATE public.approval_requests SET status='stale', decided_by=auth.uid(), decided_at=now(), decision_note=left(coalesce(p_note,''),1000) WHERE id=a.id; RETURN 'stale'; END IF;
 UPDATE public.approval_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by=auth.uid(), decided_at=now(), decision_note=left(coalesce(p_note,''),1000) WHERE id=a.id;
 IF p_approve THEN PERFORM public.apply_entity_status(p_org,a.entity_id,a.to_status); END IF;
 UPDATE public.workflow_runs SET status='succeeded', finished_at=now() WHERE entity_id=a.entity_id AND status='pending_approval' AND p_approve;
 PERFORM public.write_audit(p_org,CASE WHEN p_approve THEN 'approval.approved' ELSE 'approval.rejected' END,'approval',a.id);
 PERFORM public.notify_user(p_org,a.requested_by,CASE WHEN p_approve THEN 'Your request was approved' ELSE 'Your request was rejected' END,p_note,a.entity_id);
 RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END; END $$;

CREATE OR REPLACE FUNCTION public.save_workflow(p_org uuid, p_id uuid, p_name text, p_type uuid, p_definition jsonb, p_active boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE wid uuid; BEGIN
 IF NOT public.has_permission(p_org,'workflows.manage') OR NOT EXISTS(SELECT 1 FROM public.entity_types WHERE id=p_type AND organization_id=p_org) THEN RAISE EXCEPTION 'Workflow access denied'; END IF;
 PERFORM public.validate_workflow_definition(p_org,p_definition);
 PERFORM public.hit_rate_limit(p_org,'workflow.save',60,3600);
 IF p_id IS NULL THEN
  INSERT INTO public.workflows(organization_id,entity_type_id,name,definition,active,created_by) VALUES(p_org,p_type,btrim(p_name),p_definition,coalesce(p_active,true),auth.uid()) RETURNING id INTO wid;
 ELSE
  UPDATE public.workflows SET name=btrim(p_name), definition=p_definition, active=coalesce(p_active,true), version=version+1, updated_at=now() WHERE id=p_id AND organization_id=p_org AND entity_type_id=p_type RETURNING id INTO wid;
  IF wid IS NULL THEN RAISE EXCEPTION 'Workflow not found'; END IF;
 END IF;
 PERFORM public.write_audit(p_org,'workflow.saved','workflow',wid); RETURN wid; END $$;

CREATE OR REPLACE FUNCTION public.run_workflow(p_org uuid, p_workflow uuid, p_entity uuid, p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE w public.workflows; prev public.workflow_runs; rid uuid; BEGIN
 IF NOT public.has_permission(p_org,'workflows.run') OR p_request IS NULL THEN RAISE EXCEPTION 'Workflow access denied'; END IF;
 SELECT * INTO prev FROM public.workflow_runs WHERE organization_id=p_org AND created_by=auth.uid() AND request_id=p_request;
 IF FOUND THEN RETURN jsonb_build_object('runId',prev.id,'status',prev.status,'attempts',prev.attempts,'error',prev.last_error,'replayed',true); END IF;
 SELECT * INTO w FROM public.workflows WHERE id=p_workflow AND organization_id=p_org AND active;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.entities WHERE id=p_entity AND organization_id=p_org AND entity_type_id=w.entity_type_id) OR NOT public.can_entity(p_org,w.entity_type_id,'read') THEN RAISE EXCEPTION 'Workflow access denied'; END IF;
 PERFORM public.hit_rate_limit(p_org,'workflow.run',60,3600);
 INSERT INTO public.workflow_runs(organization_id,workflow_id,workflow_version,definition,entity_id,request_id,created_by) VALUES(p_org,w.id,w.version,w.definition,p_entity,p_request,auth.uid()) RETURNING id INTO rid;
 RETURN public.execute_workflow_run(rid); END $$;

CREATE OR REPLACE FUNCTION public.retry_workflow_run(p_org uuid, p_run uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.workflow_runs; BEGIN
 SELECT * INTO r FROM public.workflow_runs WHERE id=p_run AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND OR NOT public.has_permission(p_org,'workflows.run') OR (r.created_by <> auth.uid() AND NOT public.has_permission(p_org,'workflows.manage')) THEN RAISE EXCEPTION 'Workflow access denied'; END IF;
 IF r.status <> 'failed' THEN RAISE EXCEPTION 'Only failed runs can be retried'; END IF;
 IF r.attempts >= r.max_attempts THEN RAISE EXCEPTION 'Retry limit reached'; END IF;
 PERFORM public.hit_rate_limit(p_org,'workflow.run',60,3600);
 RETURN public.execute_workflow_run(r.id); END $$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_org uuid, p_ids uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE n integer; BEGIN IF NOT public.is_org_member(p_org) THEN RAISE EXCEPTION 'Organization access denied'; END IF;
 UPDATE public.notifications SET read_at=now() WHERE organization_id=p_org AND user_id=auth.uid() AND read_at IS NULL AND (p_ids IS NULL OR id = ANY(p_ids)); GET DIAGNOSTICS n = ROW_COUNT; RETURN n; END $$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid,text), public.hit_rate_limit(uuid,text,integer,integer), public.notify_user(uuid,uuid,text,text,uuid), public.write_audit(uuid,text,text,uuid), public.apply_entity_status(uuid,uuid,text), public.request_entity_status(uuid,uuid,text,text,boolean), public.validate_workflow_definition(uuid,jsonb), public.execute_workflow_run(uuid),
 public.save_custom_role(uuid,text,text,text[]), public.create_invitation(uuid,text,integer), public.revoke_invitation(uuid,uuid), public.accept_invitation(text), public.update_member(uuid,uuid,text,text), public.save_status_transition(uuid,uuid,text,text,boolean), public.transition_entity(uuid,uuid,text,text), public.decide_approval(uuid,uuid,boolean,text), public.save_workflow(uuid,uuid,text,uuid,jsonb,boolean), public.run_workflow(uuid,uuid,uuid,uuid), public.retry_workflow_run(uuid,uuid), public.mark_notifications_read(uuid,uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(uuid,text,integer,integer), public.notify_user(uuid,uuid,text,text,uuid), public.write_audit(uuid,text,text,uuid), public.apply_entity_status(uuid,uuid,text), public.request_entity_status(uuid,uuid,text,text,boolean), public.validate_workflow_definition(uuid,jsonb), public.execute_workflow_run(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text), public.save_custom_role(uuid,text,text,text[]), public.create_invitation(uuid,text,integer), public.revoke_invitation(uuid,uuid), public.accept_invitation(text), public.update_member(uuid,uuid,text,text), public.save_status_transition(uuid,uuid,text,text,boolean), public.transition_entity(uuid,uuid,text,text), public.decide_approval(uuid,uuid,boolean,text), public.save_workflow(uuid,uuid,text,uuid,jsonb,boolean), public.run_workflow(uuid,uuid,uuid,uuid), public.retry_workflow_run(uuid,uuid), public.mark_notifications_read(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_organization() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN INSERT INTO public.organization_roles(organization_id,role_key,display_name,is_system) VALUES(new.id,'owner','Owner',true),(new.id,'admin','Administrator',true),(new.id,'member','Member',true);
 INSERT INTO public.organization_memberships(organization_id,user_id,role_key) VALUES(new.id,new.owner_user_id,'owner'); RETURN new; END; $$;
