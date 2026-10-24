-- Rollback-only checks supported by the sandbox SQL role (not RLS impersonation).
BEGIN;
SELECT set_config('request.jwt.claim.sub','7f3021a7-5a90-4c55-ab76-5ae502c3c351',true);
INSERT INTO public.organizations(id,name,slug,owner_user_id) VALUES
('b0000000-0000-4000-8000-000000000001','Constraint test A','constraint-phase3-a','7f3021a7-5a90-4c55-ab76-5ae502c3c351'),
('b0000000-0000-4000-8000-000000000002','Constraint test B','constraint-phase3-b','b0000000-0000-4000-8000-000000000099');
INSERT INTO public.entity_types(id,organization_id,version,name,type_key,created_by) VALUES
('b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001',1,'Supplier','supplier','7f3021a7-5a90-4c55-ab76-5ae502c3c351');
INSERT INTO public.entity_field_definitions(organization_id,entity_type_id,configuration_version,field_key,label,field_type,required) VALUES('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000003',1,'name','Name','text',true);
INSERT INTO public.entities(id,organization_id,entity_type_id,configuration_version,data) VALUES('b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000003',1,'{"name":"Integration Mill","trade_profile":{"kind":"manufacturer","legal_name":"Integration Mill","certifications":["HACCP"]}}');
INSERT INTO public.products(id,organization_id,sku,name,unit) VALUES
('b0000000-0000-4000-8000-000000000020','b0000000-0000-4000-8000-000000000001','TEST-RICE','Integration rice','kg'),
('b0000000-0000-4000-8000-000000000021','b0000000-0000-4000-8000-000000000002','TEST-RICE','Foreign rice','kg');
INSERT INTO public.entity_products(id,organization_id,entity_id,product_id,moq,packaging) VALUES('b0000000-0000-4000-8000-000000000030','b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000020',500,'25 kg bags');
INSERT INTO public.product_prices(organization_id,entity_product_id,amount,currency,unit,min_quantity,effective_date) VALUES
('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000030',12.5,'USD','kg',500,'2026-10-01'),
('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000030',11.25,'USD','kg',500,'2026-10-24'),
('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000030',1000,'INR','kg',500,'2026-10-24');
DO $$ DECLARE n integer; v numeric; BEGIN
 SELECT count(*) INTO n FROM public.entity_products WHERE organization_id='b0000000-0000-4000-8000-000000000001' AND moq=500 AND packaging='25 kg bags'; IF n<>1 THEN RAISE EXCEPTION 'Supplier attributes missing'; END IF;
 SELECT count(*) INTO n FROM public.product_prices WHERE entity_product_id='b0000000-0000-4000-8000-000000000030' AND currency='USD'; IF n<>2 THEN RAISE EXCEPTION 'History overwritten'; END IF;
 SELECT amount INTO v FROM public.product_prices WHERE entity_product_id='b0000000-0000-4000-8000-000000000030' AND currency='USD' ORDER BY effective_date DESC LIMIT 1; IF v<>11.25 THEN RAISE EXCEPTION 'Latest price incorrect'; END IF;
 SELECT count(*) INTO n FROM public.product_prices WHERE entity_product_id='b0000000-0000-4000-8000-000000000030' AND currency='INR' AND amount=1000; IF n<>1 THEN RAISE EXCEPTION 'Currency histories mixed'; END IF;
 BEGIN INSERT INTO public.products(organization_id,sku,name) VALUES('b0000000-0000-4000-8000-000000000001',' test-rice ','Duplicate'); RAISE EXCEPTION 'Duplicate SKU accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN INSERT INTO public.entity_products(organization_id,entity_id,product_id,moq) VALUES('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000021',1); RAISE EXCEPTION 'Cross-tenant supplier-product accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.contacts(organization_id,entity_id,name) VALUES('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000010','Foreign contact'); RAISE EXCEPTION 'Cross-tenant contact accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.product_prices(organization_id,entity_product_id,amount,currency,unit,min_quantity,effective_date) VALUES('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000030',1,'USD','kg',500,'2026-10-25'); RAISE EXCEPTION 'Cross-tenant price accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO public.product_prices(organization_id,entity_product_id,amount,currency,unit,min_quantity,effective_date) VALUES('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000030',99,'USD','kg',500,'2026-10-24'); RAISE EXCEPTION 'Duplicate quote accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN INSERT INTO public.entity_products(organization_id,entity_id,product_id,moq) VALUES('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000020',0); RAISE EXCEPTION 'Zero MOQ accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF has_table_privilege('authenticated','public.product_prices','UPDATE') OR has_table_privilege('authenticated','public.product_prices','DELETE') OR has_table_privilege('anon','public.product_prices','SELECT') THEN RAISE EXCEPTION 'History grants unsafe'; END IF;
 RAISE NOTICE 'PASS: supplier-product attributes, historical USD/INR quotes, duplicate detection, tenant-key foreign keys, dated quote uniqueness, positive MOQ, immutable history grants';
END $$;
ROLLBACK;