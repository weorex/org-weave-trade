CREATE TABLE public.data_captures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 created_by uuid NOT NULL DEFAULT auth.uid(), request_id uuid NOT NULL, entity_id uuid NOT NULL,
 source_url text NOT NULL CHECK(length(source_url)<=2048 AND source_url ~ '^https?://'),
 payload jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,created_by,request_id), FOREIGN KEY(organization_id,entity_id) REFERENCES public.entities(organization_id,id)
);
GRANT SELECT,INSERT ON public.data_captures TO authenticated;
GRANT ALL ON public.data_captures TO service_role;
ALTER TABLE public.data_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY captures_read ON public.data_captures FOR SELECT TO authenticated USING(created_by=auth.uid() AND public.can_trade_entity(organization_id,entity_id,false));
CREATE POLICY captures_insert ON public.data_captures FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.can_trade_entity(organization_id,entity_id,false));
CREATE INDEX captures_tenant_history ON public.data_captures(organization_id,created_at DESC);
CREATE FUNCTION public.audit_data_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id) VALUES(NEW.organization_id,auth.uid(),'capture.saved','data_capture',NEW.id); RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_data_capture() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_capture_saved AFTER INSERT ON public.data_captures FOR EACH ROW EXECUTE FUNCTION public.audit_data_capture();
CREATE FUNCTION public.save_data_capture(p_org uuid,p_type uuid,p_version integer,p_request uuid,p_source text,p_values jsonb,p_products jsonb,p_contacts jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE previous public.data_captures; payload jsonb; eid uuid; pid uuid; row jsonb; result jsonb; added integer:=0; skipped integer:=0; contact_added integer:=0; entity_duplicate boolean:=false; f record; label_key text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_entity(p_org,p_type,'read') OR NOT public.can_entity(p_org,p_type,'create') THEN RAISE EXCEPTION 'Capture access denied'; END IF;
 IF p_request IS NULL OR p_source IS NULL OR length(p_source)>2048 OR p_source !~ '^https?://' OR p_source ~ '[?#]' OR p_source ~ '^https?://[^/]*@' THEN RAISE EXCEPTION 'Invalid source URL'; END IF;
 IF jsonb_typeof(p_values) IS DISTINCT FROM 'object' OR jsonb_typeof(p_products) IS DISTINCT FROM 'array' OR jsonb_typeof(p_contacts) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid capture payload'; END IF;
 IF pg_column_size(p_values)>300000 OR jsonb_array_length(p_products)>200 OR jsonb_array_length(p_contacts)>50 THEN RAISE EXCEPTION 'Capture limit exceeded'; END IF;
 IF (jsonb_array_length(p_products)>0 OR jsonb_array_length(p_contacts)>0) AND (NOT public.has_org_role(p_org,ARRAY['owner','admin']) OR NOT public.can_entity(p_org,p_type,'update')) THEN RAISE EXCEPTION 'Trade capture access denied'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_org::text,15));
 payload:=jsonb_build_object('type',p_type,'version',p_version,'source',p_source,'values',p_values,'products',p_products,'contacts',p_contacts);
 SELECT * INTO previous FROM public.data_captures WHERE organization_id=p_org AND created_by=auth.uid() AND request_id=p_request;
 IF FOUND THEN IF previous.payload<>payload THEN RAISE EXCEPTION 'Idempotency key reused with different data'; END IF; RETURN previous.result || jsonb_build_object('replayed',true); END IF;
 IF p_version IS DISTINCT FROM (SELECT max(version) FROM public.entity_types WHERE organization_id=p_org AND id=p_type) THEN RAISE EXCEPTION 'Configuration changed; reload'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE NOT EXISTS(SELECT 1 FROM public.entity_field_definitions WHERE organization_id=p_org AND entity_type_id=p_type AND configuration_version=p_version AND field_key=k)) THEN RAISE EXCEPTION 'Unknown capture field'; END IF;
 SELECT field_key INTO label_key FROM public.entity_field_definitions WHERE organization_id=p_org AND entity_type_id=p_type AND configuration_version=p_version AND field_type IN ('text','email','url') ORDER BY required DESC,position LIMIT 1;
 -- Candidate duplicate: same normalized identity field. Never overwrite a candidate.
 IF label_key IS NOT NULL AND length(btrim(coalesce(p_values->>label_key,'')))>0 THEN
 SELECT id INTO eid FROM public.entities WHERE organization_id=p_org AND entity_type_id=p_type AND lower(btrim(data->>label_key))=lower(btrim(p_values->>label_key)) ORDER BY created_at LIMIT 1;
 END IF;
 IF eid IS NOT NULL THEN
 entity_duplicate:=true;
 IF (jsonb_array_length(p_products)>0 OR jsonb_array_length(p_contacts)>0) AND NOT public.can_trade_entity(p_org,eid,true) THEN RAISE EXCEPTION 'Existing partner access denied'; END IF;
 ELSE
 INSERT INTO public.entities(organization_id,entity_type_id,configuration_version,data,created_by) VALUES(p_org,p_type,p_version,p_values,auth.uid()) RETURNING id INTO eid;
 END IF;
 FOR row IN SELECT * FROM jsonb_array_elements(p_products) LOOP
 IF jsonb_typeof(row) IS DISTINCT FROM 'object' OR length(btrim(coalesce(row->>'sku',''))) NOT BETWEEN 1 AND 80 OR length(btrim(coalesce(row->>'name',''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Invalid product'; END IF;
 SELECT id INTO pid FROM public.products WHERE organization_id=p_org AND lower(btrim(sku))=lower(btrim(row->>'sku'));
 IF pid IS NULL THEN
 INSERT INTO public.products(organization_id,sku,name,category,description,unit,status,created_by) VALUES(p_org,row->>'sku',row->>'name',coalesce(row->>'category',''),coalesce(row->>'description',''),coalesce(nullif(row->>'unit',''),'piece'),'active',auth.uid()) RETURNING id INTO pid; added:=added+1;
 ELSE skipped:=skipped+1; END IF;
 INSERT INTO public.entity_products(organization_id,entity_id,product_id,moq) VALUES(p_org,eid,pid,1) ON CONFLICT DO NOTHING;
 END LOOP;
 FOR row IN SELECT * FROM jsonb_array_elements(p_contacts) LOOP
 IF jsonb_typeof(row) IS DISTINCT FROM 'object' OR length(btrim(coalesce(row->>'name',''))) NOT BETWEEN 1 AND 160 OR (coalesce(row->>'email','')<>'' AND row->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Invalid contact'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contacts WHERE organization_id=p_org AND entity_id=eid AND lower(btrim(name))=lower(btrim(row->>'name')) AND lower(btrim(email))=lower(btrim(coalesce(row->>'email',''))) AND phone=coalesce(row->>'phone','')) THEN
 INSERT INTO public.contacts(organization_id,entity_id,name,email,phone,position,notes) VALUES(p_org,eid,row->>'name',coalesce(row->>'email',''),coalesce(row->>'phone',''),coalesce(row->>'position',''),coalesce(row->>'notes','')); contact_added:=contact_added+1;
 END IF;
 END LOOP;
 result:=jsonb_build_object('entityId',eid,'entityDuplicate',entity_duplicate,'productsInserted',added,'productsSkipped',skipped,'contactsInserted',contact_added,'replayed',false);
 INSERT INTO public.data_captures(organization_id,created_by,request_id,entity_id,source_url,payload,result) VALUES(p_org,auth.uid(),p_request,eid,p_source,payload,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_data_capture(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_data_capture(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb) TO authenticated;