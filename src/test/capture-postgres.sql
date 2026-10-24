-- Synthetic fixtures exist only inside this rollback transaction.
BEGIN;
SELECT set_config('request.jwt.claim.sub','7f3021a7-5a90-4c55-ab76-5ae502c3c351',true);
INSERT INTO public.organizations(id,name,slug,owner_user_id) VALUES('d0000000-0000-4000-8000-000000000001','Capture test','capture-rollback-test','7f3021a7-5a90-4c55-ab76-5ae502c3c351');
SELECT public.publish_entity_configuration('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002',0,'{}') WHERE false;
SELECT public.publish_entity_configuration('d0000000-0000-4000-8000-000000000001',NULL,0,'{"name":"Capture company","key":"capture_company","fields":[{"key":"name","label":"Name","type":"text","required":true,"settings":{}}],"layout":{"form":["name"],"detail":["name"],"columns":["name"],"filters":[],"tabs":[],"permissions":{"read":["owner","admin","member"],"create":["owner","admin"],"update":["owner","admin"],"delete":["owner","admin"]}}}');
DO $$ DECLARE t uuid; a jsonb; b jsonb; n integer; BEGIN
 SELECT id INTO t FROM public.entity_types WHERE organization_id='d0000000-0000-4000-8000-000000000001';
 a:=public.save_data_capture('d0000000-0000-4000-8000-000000000001',t,1,'d0000000-0000-4000-8000-000000000003','https://example.com/company','{"name":"Test supplier"}','[{"sku":"P1","name":"Product one"}]','[{"name":"Contact","email":"contact@example.com"}]');
 b:=public.save_data_capture('d0000000-0000-4000-8000-000000000001',t,1,'d0000000-0000-4000-8000-000000000003','https://example.com/company','{"name":"Test supplier"}','[{"sku":"P1","name":"Product one"}]','[{"name":"Contact","email":"contact@example.com"}]');
 IF b->>'replayed'<>'true' OR a->>'entityId'<>b->>'entityId' THEN RAISE EXCEPTION 'Replay failed'; END IF;
 SELECT count(*) INTO n FROM public.audit_logs WHERE organization_id='d0000000-0000-4000-8000-000000000001' AND action='capture.saved'; IF n<>1 THEN RAISE EXCEPTION 'Replay duplicated audit'; END IF;
 b:=public.save_data_capture('d0000000-0000-4000-8000-000000000001',t,1,'d0000000-0000-4000-8000-000000000004','https://example.com/company','{"name":" test SUPPLIER "}','[{"sku":"p1","name":"Changed product"}]','[{"name":"Contact","email":"contact@example.com"}]');
 IF b->>'entityDuplicate'<>'true' OR b->>'productsSkipped'<>'1' OR b->>'contactsInserted'<>'0' THEN RAISE EXCEPTION 'Duplicate detection failed'; END IF;
 IF (SELECT name FROM public.products WHERE organization_id='d0000000-0000-4000-8000-000000000001')<>'Product one' THEN RAISE EXCEPTION 'Existing product overwritten'; END IF;
 BEGIN PERFORM public.save_data_capture('d0000000-0000-4000-8000-000000000001',t,1,'d0000000-0000-4000-8000-000000000003','https://example.com/company','{"name":"Changed"}','[]','[]'); RAISE EXCEPTION 'Conflicting retry allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Conflicting retry allowed' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_data_capture('d0000000-0000-4000-8000-000000000099',t,1,gen_random_uuid(),'https://example.com','{"name":"Foreign"}','[]','[]'); RAISE EXCEPTION 'Foreign organization allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Foreign organization allowed' THEN RAISE; END IF; END;
 BEGIN PERFORM public.save_data_capture('d0000000-0000-4000-8000-000000000001',t,1,gen_random_uuid(),'https://example.com','{"name":"Rollback supplier"}','[{"sku":"P2","name":"Rollback product"}]','[{"name":"Invalid","email":"not-an-email"}]'); RAISE EXCEPTION 'Invalid contact allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid contact allowed' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.products WHERE organization_id='d0000000-0000-4000-8000-000000000001' AND sku='P2') OR EXISTS(SELECT 1 FROM public.entities WHERE organization_id='d0000000-0000-4000-8000-000000000001' AND data->>'name'='Rollback supplier') THEN RAISE EXCEPTION 'Partial capture persisted'; END IF;
 RAISE NOTICE 'PASS: atomic capture, idempotency, audit once, duplicate retention, foreign organization denial and rollback';
END $$;
ROLLBACK;