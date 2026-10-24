-- Integration fixtures are transaction-only; ROLLBACK leaves no business rows.
BEGIN;
SELECT set_config('request.jwt.claim.sub','7f3021a7-5a90-4c55-ab76-5ae502c3c351',true);
INSERT INTO public.organizations(id,name,slug,owner_user_id) VALUES
('a0000000-0000-4000-8000-000000000001','Integration tenant A','integration-phase3-a','7f3021a7-5a90-4c55-ab76-5ae502c3c351'),
('a0000000-0000-4000-8000-000000000002','Integration tenant B','integration-phase3-b','a0000000-0000-4000-8000-000000000099');
SET LOCAL ROLE authenticated;
SELECT public.publish_entity_configuration('a0000000-0000-4000-8000-000000000001',NULL,0,'{"name":"Integration Supplier","key":"integration_supplier","fields":[{"key":"name","label":"Name","type":"text","required":true,"settings":{}}],"layout":{"form":["name"],"detail":["name"],"columns":["name"],"filters":["name"],"tabs":[],"permissions":{"read":["owner","admin","member"],"create":["owner","admin"],"update":["owner","admin"],"delete":["owner","admin"]}}}'::jsonb);
INSERT INTO public.entities(id,organization_id,entity_type_id,configuration_version,data) SELECT 'a0000000-0000-4000-8000-000000000010',organization_id,id,version,'{"name":"Integration Mill"}' FROM public.entity_types WHERE organization_id='a0000000-0000-4000-8000-000000000001';
SELECT public.import_trade_catalogue('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000010','[{"sku":"TEST-RICE","name":"Integration rice","unit":"kg","moq":500,"packaging":"25 kg bags","amount":"12.500000","currency":"USD","effective_date":"2026-10-01"}]');
SELECT public.import_trade_catalogue('a0000000-0000-4000-8000-000000000001',NULL,'[{"sku":"test-rice","name":"Duplicate"}]');
INSERT INTO public.product_prices(organization_id,entity_product_id,amount,currency,unit,min_quantity,effective_date) SELECT organization_id,id,11.25,'USD','kg',500,'2026-10-24' FROM public.entity_products;
INSERT INTO public.product_prices(organization_id,entity_product_id,amount,currency,unit,min_quantity,effective_date) SELECT organization_id,id,1000,'INR','kg',500,'2026-10-24' FROM public.entity_products;
DO $$ DECLARE n integer; v numeric; BEGIN
 SELECT count(*) INTO n FROM public.products; IF n<>1 THEN RAISE EXCEPTION 'SKU duplicates were not skipped'; END IF;
 SELECT count(*) INTO n FROM public.entity_products WHERE moq=500 AND packaging='25 kg bags'; IF n<>1 THEN RAISE EXCEPTION 'Supplier product attributes missing'; END IF;
 SELECT count(*) INTO n FROM public.product_prices WHERE currency='USD'; IF n<>2 THEN RAISE EXCEPTION 'USD price history was overwritten'; END IF;
 SELECT amount INTO v FROM public.product_prices WHERE currency='USD' ORDER BY effective_date DESC LIMIT 1; IF v<>11.25 THEN RAISE EXCEPTION 'Latest price incorrect'; END IF;
 SELECT count(*) INTO n FROM public.product_prices WHERE currency='INR' AND amount=1000; IF n<>1 THEN RAISE EXCEPTION 'Currency histories mixed'; END IF;
 IF has_table_privilege('authenticated','public.product_prices','UPDATE') OR has_table_privilege('authenticated','public.product_prices','DELETE') THEN RAISE EXCEPTION 'Price history is mutable'; END IF;
 BEGIN INSERT INTO public.product_prices(organization_id,entity_product_id,amount,currency,unit,min_quantity,effective_date) SELECT organization_id,id,99,'USD','kg',500,'2026-10-24' FROM public.entity_products; RAISE EXCEPTION 'Duplicate dated price accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN INSERT INTO public.entity_products(organization_id,entity_id,product_id,moq) SELECT organization_id,'a0000000-0000-4000-8000-000000000010',id,0 FROM public.products; RAISE EXCEPTION 'Zero MOQ accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.import_trade_catalogue('a0000000-0000-4000-8000-000000000002',NULL,'[{"sku":"FOREIGN","name":"Foreign product"}]'); RAISE EXCEPTION 'Cross tenant import accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Trade access denied' THEN RAISE; END IF; END;
 BEGIN PERFORM public.import_trade_catalogue('a0000000-0000-4000-8000-000000000001',NULL,'[{"sku":"ROLLBACK-FIRST","name":"Good row"},{"sku":"","name":"Bad row"}]'); RAISE EXCEPTION 'Invalid import accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.products WHERE sku='ROLLBACK-FIRST') THEN RAISE EXCEPTION 'Import was partially saved'; END IF;
 RAISE NOTICE 'PASS: supplier product, duplicate SKU, price history, currency tiers, immutable history, MOQ, tenant denial, atomic import';
END $$;
UPDATE public.entities SET data='{"trade_profile":{"kind":"manufacturer","legal_name":"Integration Mill","certifications":["HACCP"],"capacity":"100 tonnes/month"}}' WHERE id='a0000000-0000-4000-8000-000000000010';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.entities WHERE data->>'name'='Integration Mill' AND data->'trade_profile'->>'legal_name'='Integration Mill') THEN RAISE EXCEPTION 'Profile save lost metadata'; END IF; END $$;
RESET ROLE;
-- Reuse the real user's ID as a read-only member only within this rollback transaction.
UPDATE public.organization_memberships SET role_key='member' WHERE organization_id='a0000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN INSERT INTO public.products(organization_id,sku,name) VALUES('a0000000-0000-4000-8000-000000000001','MEMBER-WRITE','Forbidden'); RAISE EXCEPTION 'Member write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.product_prices(organization_id,entity_product_id,amount,currency,unit,min_quantity,effective_date) SELECT organization_id,id,20,'USD','kg',500,'2026-10-25' FROM public.entity_products; RAISE EXCEPTION 'Member price write accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.organizations WHERE id='a0000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Foreign tenant visible'; END IF;
 RAISE NOTICE 'PASS: read-only member cannot mutate catalogue or price history; foreign organization invisible';
END $$;
ROLLBACK;