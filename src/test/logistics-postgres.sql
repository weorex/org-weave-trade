-- Rollback-only database constraints; authenticated RLS is verified separately.
BEGIN;
SELECT set_config('request.jwt.claim.sub','7f3021a7-5a90-4c55-ab76-5ae502c3c351',true);
INSERT INTO public.organizations(id,name,slug,owner_user_id) VALUES
('c0000000-0000-4000-8000-000000000001','Logistics test A','logistics-test-a','7f3021a7-5a90-4c55-ab76-5ae502c3c351'),
('c0000000-0000-4000-8000-000000000002','Logistics test B','logistics-test-b','c0000000-0000-4000-8000-000000000099');
INSERT INTO public.entity_types(id,organization_id,version,name,type_key,created_by) VALUES('c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000001',1,'Logistics partner','logistics_partner','7f3021a7-5a90-4c55-ab76-5ae502c3c351');
INSERT INTO public.entities(id,organization_id,entity_type_id,configuration_version,data) VALUES('c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000003',1,'{"name":"Logistics test"}');
INSERT INTO public.logistics_profiles(organization_id,entity_id,kind,legal_name) VALUES('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000010','both','Logistics test');
INSERT INTO public.ports(id,organization_id,code,name,country) VALUES
('c0000000-0000-4000-8000-000000000020','c0000000-0000-4000-8000-000000000001','INMAA','Chennai','IN'),
('c0000000-0000-4000-8000-000000000021','c0000000-0000-4000-8000-000000000001','SGSIN','Singapore','SG'),
('c0000000-0000-4000-8000-000000000022','c0000000-0000-4000-8000-000000000002','AEJEA','Jebel Ali','AE');
INSERT INTO public.shipping_routes(id,organization_id,shipping_agent_entity_id,origin_port_id,destination_port_id,mode,container_type,transit_min_days,transit_max_days) VALUES('c0000000-0000-4000-8000-000000000030','c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000020','c0000000-0000-4000-8000-000000000021','FCL','40HC',7,10);
INSERT INTO public.shipping_rates(organization_id,shipping_route_id,amount,currency,unit,valid_from,valid_until) VALUES
('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000030',1200,'USD','container','2026-10-01','2026-10-31'),
('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000030',1250,'USD','container','2026-11-01','2026-11-30');
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.shipping_rates WHERE shipping_route_id='c0000000-0000-4000-8000-000000000030'; IF n<>2 THEN RAISE EXCEPTION 'Historical rates lost'; END IF;
 BEGIN UPDATE public.shipping_rates SET amount=0 WHERE shipping_route_id='c0000000-0000-4000-8000-000000000030'; RAISE EXCEPTION 'History updated'; EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN raise_exception THEN IF SQLERRM<>'Price history is append-only' THEN RAISE; END IF; END;
 BEGIN DELETE FROM public.shipping_rates WHERE shipping_route_id='c0000000-0000-4000-8000-000000000030'; RAISE EXCEPTION 'History deleted'; EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN raise_exception THEN IF SQLERRM<>'Price history is append-only' THEN RAISE; END IF; END;
 BEGIN INSERT INTO public.shipping_rates(organization_id,shipping_route_id,amount,currency,unit,valid_from,valid_until) VALUES('c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000030',10,'USD','container','2026-10-01','2026-10-31'); RAISE EXCEPTION 'Cross-tenant rate accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.shipping_routes(organization_id,shipping_agent_entity_id,origin_port_id,destination_port_id,mode,container_type,transit_min_days,transit_max_days) VALUES('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000020','c0000000-0000-4000-8000-000000000022','FCL','40HC',7,10); RAISE EXCEPTION 'Cross-tenant port accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.shipping_rates(organization_id,shipping_route_id,amount,currency,unit,valid_from,valid_until) VALUES('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000030',10,'USD','container','2026-11-01','2026-10-31'); RAISE EXCEPTION 'Reversed validity accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF has_table_privilege('authenticated','public.shipping_rates','UPDATE') OR has_table_privilege('authenticated','public.shipping_rates','DELETE') OR has_table_privilege('anon','public.shipping_rates','SELECT') THEN RAISE EXCEPTION 'Unsafe rate grants'; END IF;
 RAISE NOTICE 'PASS: retained rates, immutable updates/deletes, tenant-key rates and ports, validity, restricted grants';
END $$;
ROLLBACK;