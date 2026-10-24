-- Phase 6 database tests. Synthetic users/organizations exist only inside this block:
-- the final RAISE rolls everything back. Success = error text 'PHASE6_ALL_PASSED'.
CREATE OR REPLACE FUNCTION pg_temp.act(p uuid) RETURNS void LANGUAGE plpgsql AS $f$ BEGIN
 PERFORM set_config('role','none',true);
 PERFORM set_config('request.jwt.claim.sub',coalesce(p::text,''),true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',p,'role','authenticated')::text,true);
 IF p IS NOT NULL THEN PERFORM set_config('role','authenticated',true); END IF; END $f$;

DO $$
DECLARE
 o1 uuid:='e6000000-0000-4000-8000-000000000001'; o2 uuid:='e6000000-0000-4000-8000-000000000002';
 ua uuid:='e6000000-0000-4000-8000-0000000000a1'; ud uuid:='e6000000-0000-4000-8000-0000000000a2'; um uuid:='e6000000-0000-4000-8000-0000000000a3';
 uc uuid:='e6000000-0000-4000-8000-0000000000a4'; ub uuid:='e6000000-0000-4000-8000-0000000000b1';
 t uuid:='e6000000-0000-4000-8000-000000000010'; e uuid; w uuid; wb uuid; r jsonb; inv jsonb; n integer; s text; ok boolean;
BEGIN
 -- Fixtures (privileged)
 PERFORM pg_temp.act(NULL);
 INSERT INTO public.organizations(id,name,slug,owner_user_id) VALUES(o1,'Tenant A','p6-tenant-a',ua),(o2,'Tenant B','p6-tenant-b',ub);
 INSERT INTO public.organization_memberships(organization_id,user_id,role_key) VALUES(o1,ud,'admin'),(o1,um,'member');
 INSERT INTO public.entity_types(id,organization_id,version,name,type_key,created_by) VALUES(t,o1,1,'Supplier','p6_supplier',ua);
 INSERT INTO public.entity_field_definitions(organization_id,entity_type_id,configuration_version,field_key,label,field_type,required,settings,position) VALUES(o1,t,1,'name','Name','text',true,'{}',0);
 INSERT INTO public.entity_type_layouts VALUES(o1,t,1,'{"form":["name"],"detail":["name"],"columns":["name"],"filters":[],"tabs":[],"permissions":{"read":["owner","admin","member"],"create":["owner","admin"],"update":["owner","admin"],"delete":["owner","admin"]}}');
 INSERT INTO public.entities(organization_id,entity_type_id,configuration_version,data,created_by) VALUES(o1,t,1,'{"name":"Acme"}',ua) RETURNING id INTO e;

 -- Workflow allowlist: unknown actions and extra keys are rejected
 PERFORM pg_temp.act(ua);
 BEGIN PERFORM public.save_workflow(o1,NULL,'Bad',t,'[{"action":"sql","query":"drop table x"}]',true); RAISE EXCEPTION 'T1 unknown action accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Workflow action is not allowed%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_workflow(o1,NULL,'Bad',t,'[{"action":"set_status","to":"done","run":"js"}]',true); RAISE EXCEPTION 'T2 extra key accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Invalid status step%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_workflow(o1,NULL,'Bad',t,'[{"action":"assign","user_id":"e6000000-0000-4000-8000-0000000000b1"}]',true); RAISE EXCEPTION 'T3 foreign assignee accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Invalid assignment step%' THEN RAISE; END IF; END;

 -- Workflow failure: no transition rule -> run fails, all steps roll back, retries capped at 3
 w := public.save_workflow(o1,NULL,'Approve',t,'[{"action":"assign","user_id":"e6000000-0000-4000-8000-0000000000a3"},{"action":"set_status","to":"approved"}]',true);
 r := public.run_workflow(o1,w,e,'e6000000-0000-4000-8000-0000000000f1');
 IF r->>'status'<>'failed' OR r->>'attempts'<>'1' THEN RAISE EXCEPTION 'T4 failure not recorded: %',r; END IF;
 IF EXISTS(SELECT 1 FROM public.entity_states WHERE entity_id=e) THEN RAISE EXCEPTION 'T5 failed run left partial changes'; END IF;
 IF (SELECT count(*) FROM public.workflow_run_logs WHERE run_id=(r->>'runId')::uuid AND outcome='rolled_back')<>1 OR (SELECT count(*) FROM public.workflow_run_logs WHERE run_id=(r->>'runId')::uuid AND outcome='failed')<>1 THEN RAISE EXCEPTION 'T6 run log incomplete'; END IF;
 IF (public.run_workflow(o1,w,e,'e6000000-0000-4000-8000-0000000000f1'))->>'replayed'<>'true' THEN RAISE EXCEPTION 'T7 idempotent replay failed'; END IF;
 IF (public.retry_workflow_run(o1,(r->>'runId')::uuid))->>'attempts'<>'2' THEN RAISE EXCEPTION 'T8 retry failed'; END IF;
 PERFORM public.retry_workflow_run(o1,(r->>'runId')::uuid);
 BEGIN PERFORM public.retry_workflow_run(o1,(r->>'runId')::uuid); RAISE EXCEPTION 'T9 retry limit ignored'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Retry limit reached%' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE user_id=ua AND title='Workflow failed') THEN RAISE EXCEPTION 'T10 failure notification missing'; END IF;

 -- Transition requiring approval: requester cannot approve own request; another approver can
 PERFORM public.save_status_transition(o1,t,'new','approved',true);
 r := public.run_workflow(o1,w,e,'e6000000-0000-4000-8000-0000000000f2');
 IF r->>'status'<>'pending_approval' THEN RAISE EXCEPTION 'T11 approval not requested: %',r; END IF;
 IF (SELECT status FROM public.entity_states WHERE entity_id=e)<>'new' OR (SELECT assignee_user_id FROM public.entity_states WHERE entity_id=e)<>um THEN RAISE EXCEPTION 'T12 state wrong before approval'; END IF;
 BEGIN PERFORM public.decide_approval(o1,(SELECT id FROM public.approval_requests WHERE entity_id=e AND status='pending'),true,''); RAISE EXCEPTION 'T13 self approval allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'You cannot approve your own request%' THEN RAISE; END IF; END;
 PERFORM pg_temp.act(ud);
 IF public.decide_approval(o1,(SELECT id FROM public.approval_requests WHERE entity_id=e AND status='pending'),true,'ok')<>'approved' THEN RAISE EXCEPTION 'T14 approval failed'; END IF;
 IF (SELECT status FROM public.entity_states WHERE entity_id=e)<>'approved' THEN RAISE EXCEPTION 'T15 approved status not applied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE user_id=um AND title='Status changed to approved') THEN RAISE EXCEPTION 'T16 assignee not notified'; END IF;
 IF EXISTS(SELECT 1 FROM public.notifications WHERE user_id<>ud) THEN RAISE EXCEPTION 'T17 notification read leaked other users'; END IF;

 -- Privilege escalation: a member with only "members.invite" cannot widen access
 PERFORM pg_temp.act(ua);
 PERFORM public.save_custom_role(o1,'coordinator','Coordinator',ARRAY['members.invite']);
 PERFORM public.update_member(o1,(SELECT id FROM public.organization_memberships WHERE organization_id=o1 AND user_id=um),'coordinator','active');
 PERFORM pg_temp.act(um);
 IF NOT public.has_permission(o1,'members.invite') OR public.has_permission(o1,'roles.manage') THEN RAISE EXCEPTION 'T18 custom role permissions wrong'; END IF;
 BEGIN PERFORM public.save_custom_role(o1,'coordinator','Coordinator',ARRAY['members.invite','roles.manage']); RAISE EXCEPTION 'T19 self-elevation allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Role management access denied%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.create_invitation(o1,'admin',24); RAISE EXCEPTION 'T20 admin invite allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the owner can invite administrators%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.update_member(o1,(SELECT id FROM public.organization_memberships WHERE organization_id=o1 AND user_id=um),'admin','active'); RAISE EXCEPTION 'T21 member management allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Member management access denied%' THEN RAISE; END IF; END;
 BEGIN INSERT INTO public.role_permissions VALUES(o1,'coordinator','roles.manage'); RAISE EXCEPTION 'T22 direct permission insert allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.organization_memberships SET role_key='admin' WHERE user_id=um; GET DIAGNOSTICS n=ROW_COUNT; IF n>0 THEN RAISE EXCEPTION 'T23 direct role update allowed'; END IF; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.transition_entity(o1,e,'new',''); RAISE EXCEPTION 'T24 transition without permission'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Status change access denied%' THEN RAISE; END IF; END;
 PERFORM pg_temp.act(ud);
 BEGIN PERFORM public.update_member(o1,(SELECT id FROM public.organization_memberships WHERE organization_id=o1 AND user_id=um),'admin','active'); RAISE EXCEPTION 'T25 admin promoted admin'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only the owner can change administrators%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.update_member(o1,(SELECT id FROM public.organization_memberships WHERE organization_id=o1 AND user_id=ua),'member','active'); RAISE EXCEPTION 'T26 owner demoted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Ownership cannot be changed here%' THEN RAISE; END IF; END;

 -- Invitations: single use, hashed, cannot be reused
 PERFORM pg_temp.act(um);
 inv := public.create_invitation(o1,'member',24);
 IF EXISTS(SELECT 1 FROM public.organization_invitations WHERE id=(inv->>'id')::uuid) AND false THEN NULL; END IF;
 BEGIN PERFORM token_hash FROM public.organization_invitations LIMIT 1; RAISE EXCEPTION 'T27 token hash readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM pg_temp.act(uc);
 IF public.accept_invitation(inv->>'token')<>o1 THEN RAISE EXCEPTION 'T28 accept failed'; END IF;
 BEGIN PERFORM public.accept_invitation(inv->>'token'); RAISE EXCEPTION 'T29 invitation reused'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Invitation is invalid or expired%' THEN RAISE; END IF; END;
 PERFORM pg_temp.act(ub);
 BEGIN PERFORM public.accept_invitation(inv->>'token'); RAISE EXCEPTION 'T30 invitation reused by other user'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Invitation is invalid or expired%' THEN RAISE; END IF; END;

 -- Cross-tenant: tenant B sees and changes nothing in tenant A
 IF public.has_permission(o1,'workflows.run') THEN RAISE EXCEPTION 'T31 foreign permission'; END IF;
 SELECT count(*) INTO n FROM public.workflows WHERE organization_id=o1; IF n<>0 THEN RAISE EXCEPTION 'T32 foreign workflows visible'; END IF;
 SELECT count(*) INTO n FROM public.entity_states WHERE organization_id=o1; IF n<>0 THEN RAISE EXCEPTION 'T33 foreign states visible'; END IF;
 SELECT count(*) INTO n FROM public.audit_logs WHERE organization_id=o1; IF n<>0 THEN RAISE EXCEPTION 'T34 foreign audit visible'; END IF;
 BEGIN PERFORM public.run_workflow(o1,w,e,gen_random_uuid()); RAISE EXCEPTION 'T35 foreign run allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Workflow access denied%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_status_transition(o1,t,'approved','closed',false); RAISE EXCEPTION 'T36 foreign rule allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Workflow access denied%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.create_invitation(o1,'member',24); RAISE EXCEPTION 'T37 foreign invite allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Invitation access denied%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_workflow(o2,NULL,'Steal',t,'[{"action":"set_status","to":"done"}]',true); RAISE EXCEPTION 'T38 foreign entity type used'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Workflow access denied%' THEN RAISE; END IF; END;

 -- File access: storage paths of another tenant and malformed paths are refused
 IF public.can_logistics_object(o1::text||'/'||e::text||'/file.pdf',false) OR public.can_logistics_object('../'||o1::text,false) THEN RAISE EXCEPTION 'T39 foreign file access'; END IF;

 -- Duplicate imports: the same SKU imported twice is skipped, never duplicated
 PERFORM pg_temp.act(ua);
 r := public.import_trade_catalogue(o1,NULL,'[{"sku":"P6-1","name":"Widget"}]');
 r := public.import_trade_catalogue(o1,NULL,'[{"sku":"P6-1","name":"Widget changed"},{"sku":"P6-2","name":"Bolt"}]');
 IF r->>'skipped'<>'1' OR r->>'inserted'<>'1' OR (SELECT count(*) FROM public.products WHERE organization_id=o1 AND sku='P6-1')<>1 OR (SELECT name FROM public.products WHERE organization_id=o1 AND sku='P6-1')<>'Widget' THEN RAISE EXCEPTION 'T40 duplicate import: %',r; END IF;

 -- Rate limit: 21st invitation in an hour is refused
 BEGIN FOR n IN 1..25 LOOP PERFORM public.create_invitation(o1,'member',1); END LOOP; RAISE EXCEPTION 'T41 rate limit ignored'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Rate limit exceeded%' THEN RAISE; END IF; END;

 PERFORM pg_temp.act(NULL);
 RAISE EXCEPTION 'PHASE6_ALL_PASSED';
END $$;
