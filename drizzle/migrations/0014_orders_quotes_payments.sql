-- Orders tie one deal together: buyer (export orders only), items, supplier and logistics quotes with
-- accept/reject decisions and revisions, payments in and out, documents and an automatic timeline.
-- Members read; owners/admins write. Quote amounts and payments are never edited in place.
CREATE TABLE public.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 order_number text NOT NULL CHECK(order_number ~ '^[A-Za-z0-9][A-Za-z0-9/_.-]{0,39}$'),
 order_type text NOT NULL CHECK(order_type IN ('export','stock')), buyer_entity_id uuid,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sourcing','confirmed','in_production','shipped','delivered','closed','cancelled')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), order_value numeric(18,2) CHECK(order_value>=0),
 incoterm text NOT NULL DEFAULT '' CHECK(incoterm IN ('','EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP')),
 destination text NOT NULL DEFAULT '' CHECK(length(destination)<=160), required_by date, notes text NOT NULL DEFAULT '' CHECK(length(notes)<=5000),
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,order_number),
 FOREIGN KEY(organization_id,buyer_entity_id) REFERENCES public.entities(organization_id,id),
 -- Export orders always have a buyer and may carry a sale value; stock purchases never do.
 CHECK((order_type='export' AND buyer_entity_id IS NOT NULL) OR (order_type='stock' AND buyer_entity_id IS NULL AND order_value IS NULL))
);
-- Supabase grants new tables to API roles by default; start from nothing.
REVOKE ALL ON public.orders FROM anon,authenticated;
GRANT SELECT,INSERT ON public.orders TO authenticated;
GRANT UPDATE(title,status,currency,order_value,incoterm,destination,required_by,notes,buyer_entity_id) ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_read ON public.orders FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY orders_create ON public.orders FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.has_org_role(organization_id,ARRAY['owner','admin']) AND (buyer_entity_id IS NULL OR public.can_trade_entity(organization_id,buyer_entity_id,false)));
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated USING(public.has_org_role(organization_id,ARRAY['owner','admin'])) WITH CHECK(public.has_org_role(organization_id,ARRAY['owner','admin']) AND (buyer_entity_id IS NULL OR public.can_trade_entity(organization_id,buyer_entity_id,false)));

CREATE TABLE public.order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, order_id uuid NOT NULL, product_id uuid,
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 300), quantity numeric(18,3) NOT NULL CHECK(quantity>0),
 unit text NOT NULL CHECK(length(btrim(unit)) BETWEEN 1 AND 40), target_price numeric(18,4) CHECK(target_price>=0), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,order_id) REFERENCES public.orders(organization_id,id), FOREIGN KEY(organization_id,product_id) REFERENCES public.products(organization_id,id)
);
-- Supabase grants new tables to API roles by default; start from nothing.
REVOKE ALL ON public.order_items FROM anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.order_items TO authenticated; GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_items_read ON public.order_items FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY order_items_create ON public.order_items FOR INSERT TO authenticated WITH CHECK(public.has_org_role(organization_id,ARRAY['owner','admin']));
CREATE POLICY order_items_delete ON public.order_items FOR DELETE TO authenticated USING(public.has_org_role(organization_id,ARRAY['owner','admin']));

CREATE TABLE public.order_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, order_id uuid NOT NULL, party_entity_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('supplier','shipping','transport','other')), quote_number text NOT NULL DEFAULT '' CHECK(length(quote_number)<=80),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500), amount numeric(18,4) NOT NULL CHECK(amount>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 received_on date NOT NULL DEFAULT current_date, valid_until date,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn','superseded')),
 decision_note text NOT NULL DEFAULT '' CHECK(length(decision_note)<=1000), decided_by uuid, decided_at timestamptz,
 revises_quote_id uuid, notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), CHECK(valid_until IS NULL OR valid_until>=received_on),
 FOREIGN KEY(organization_id,order_id) REFERENCES public.orders(organization_id,id), FOREIGN KEY(organization_id,party_entity_id) REFERENCES public.entities(organization_id,id),
 FOREIGN KEY(organization_id,revises_quote_id) REFERENCES public.order_quotes(organization_id,id)
);
-- No UPDATE grant: amounts are fixed once received; decisions go through decide_order_quote.
-- Supabase grants new tables to API roles by default; start from nothing.
REVOKE ALL ON public.order_quotes FROM anon,authenticated;
GRANT SELECT,INSERT ON public.order_quotes TO authenticated; GRANT ALL ON public.order_quotes TO service_role;
ALTER TABLE public.order_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_quotes_read ON public.order_quotes FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY order_quotes_create ON public.order_quotes FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND status='pending' AND decided_by IS NULL AND public.has_org_role(organization_id,ARRAY['owner','admin']) AND public.can_trade_entity(organization_id,party_entity_id,false));

CREATE TABLE public.order_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, order_id uuid NOT NULL,
 direction text NOT NULL CHECK(direction IN ('in','out')), party_entity_id uuid NOT NULL, quote_id uuid,
 amount numeric(18,2) NOT NULL CHECK(amount>0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), paid_on date NOT NULL,
 method text NOT NULL CHECK(method IN ('bank_transfer','lc','upi','cheque','cash','card','other')), reference text NOT NULL DEFAULT '' CHECK(length(reference)<=120),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000), created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,order_id) REFERENCES public.orders(organization_id,id), FOREIGN KEY(organization_id,party_entity_id) REFERENCES public.entities(organization_id,id),
 FOREIGN KEY(organization_id,quote_id) REFERENCES public.order_quotes(organization_id,id)
);
-- No UPDATE grant. A wrong entry can be removed by an owner/admin; the removal stays in the timeline and audit log.
-- Supabase grants new tables to API roles by default; start from nothing.
REVOKE ALL ON public.order_payments FROM anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.order_payments TO authenticated; GRANT ALL ON public.order_payments TO service_role;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_payments_read ON public.order_payments FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY order_payments_create ON public.order_payments FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.has_org_role(organization_id,ARRAY['owner','admin']) AND public.can_trade_entity(organization_id,party_entity_id,false));
CREATE POLICY order_payments_delete ON public.order_payments FOR DELETE TO authenticated USING(public.has_org_role(organization_id,ARRAY['owner','admin']));

CREATE TABLE public.order_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, order_id uuid NOT NULL,
 doc_type text NOT NULL CHECK(doc_type IN ('proforma_invoice','purchase_order','commercial_invoice','packing_list','bill_of_lading','certificate','quote','payment_proof','other')),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200), object_path text NOT NULL UNIQUE,
 created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,order_id) REFERENCES public.orders(organization_id,id),
 CHECK(object_path LIKE organization_id::text || '/' || order_id::text || '/%')
);
-- Supabase grants new tables to API roles by default; start from nothing.
REVOKE ALL ON public.order_documents FROM anon,authenticated;
GRANT SELECT,INSERT ON public.order_documents TO authenticated; GRANT ALL ON public.order_documents TO service_role;
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_documents_read ON public.order_documents FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY order_documents_create ON public.order_documents FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.has_org_role(organization_id,ARRAY['owner','admin']));

CREATE TABLE public.order_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, order_id uuid NOT NULL, actor_user_id uuid,
 action text NOT NULL, detail text NOT NULL DEFAULT '' CHECK(length(detail)<=2000), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,order_id) REFERENCES public.orders(organization_id,id)
);
-- Timeline rows are written only by the protected functions and triggers below.
-- Supabase grants new tables to API roles by default; start from nothing.
REVOKE ALL ON public.order_events FROM anon,authenticated;
GRANT SELECT ON public.order_events TO authenticated; GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_events_read ON public.order_events FOR SELECT TO authenticated USING(public.is_org_member(organization_id));

CREATE FUNCTION public.order_event(p_org uuid,p_order uuid,p_action text,p_detail text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.order_events(organization_id,order_id,actor_user_id,action,detail) VALUES(p_org,p_order,auth.uid(),p_action,left(coalesce(p_detail,''),2000)) $$;
REVOKE ALL ON FUNCTION public.order_event(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;

-- Cross-row rules a CHECK cannot express.
CREATE FUNCTION public.validate_order_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE o public.orders; q public.order_quotes; BEGIN
 SELECT * INTO o FROM public.orders WHERE id=NEW.order_id AND organization_id=NEW.organization_id;
 IF TG_TABLE_NAME='order_payments' THEN
  IF NEW.direction='in' AND (o.order_type<>'export' OR NEW.party_entity_id IS DISTINCT FROM o.buyer_entity_id) THEN RAISE EXCEPTION 'Incoming payments must come from the order''s buyer'; END IF;
  IF NEW.quote_id IS NOT NULL THEN SELECT * INTO q FROM public.order_quotes WHERE id=NEW.quote_id AND organization_id=NEW.organization_id;
   IF q.order_id<>NEW.order_id OR q.party_entity_id<>NEW.party_entity_id THEN RAISE EXCEPTION 'Payment quote must belong to this order and party'; END IF; END IF;
 ELSIF TG_TABLE_NAME='order_quotes' AND NEW.revises_quote_id IS NOT NULL THEN
  SELECT * INTO q FROM public.order_quotes WHERE id=NEW.revises_quote_id AND organization_id=NEW.organization_id;
  IF q.order_id<>NEW.order_id OR q.party_entity_id<>NEW.party_entity_id OR q.kind<>NEW.kind THEN RAISE EXCEPTION 'A revision must be for the same order, party and quote type'; END IF;
  IF q.status='accepted' THEN RAISE EXCEPTION 'An accepted quote cannot be revised'; END IF;
 END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.validate_order_row() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER order_payments_validate BEFORE INSERT ON public.order_payments FOR EACH ROW EXECUTE FUNCTION public.validate_order_row();
CREATE TRIGGER order_quotes_validate BEFORE INSERT ON public.order_quotes FOR EACH ROW EXECUTE FUNCTION public.validate_order_row();

-- Timeline + audit for every change; a pending quote that receives a revision becomes "superseded".
CREATE FUNCTION public.log_order_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r record; BEGIN
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 IF TG_TABLE_NAME='orders' THEN
  IF TG_OP='INSERT' THEN PERFORM public.order_event(NEW.organization_id,NEW.id,'order.created',NEW.order_type||' order '||NEW.order_number); PERFORM public.write_audit(NEW.organization_id,'order.created','order',NEW.id);
  ELSIF NEW.status<>OLD.status THEN PERFORM public.order_event(NEW.organization_id,NEW.id,'order.status',OLD.status||' → '||NEW.status); PERFORM public.write_audit(NEW.organization_id,'order.status','order',NEW.id);
  ELSE PERFORM public.order_event(NEW.organization_id,NEW.id,'order.updated','Order details updated'); END IF;
  IF TG_OP='UPDATE' THEN NEW.updated_at:=now(); END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='order_items' THEN
  PERFORM public.order_event(r.organization_id,r.order_id,CASE TG_OP WHEN 'INSERT' THEN 'item.added' ELSE 'item.removed' END,r.description||' · '||r.quantity||' '||r.unit);
 ELSIF TG_TABLE_NAME='order_quotes' THEN
  PERFORM public.order_event(NEW.organization_id,NEW.order_id,CASE WHEN NEW.revises_quote_id IS NULL THEN 'quote.received' ELSE 'quote.revised' END,NEW.kind||' quote '||coalesce(nullif(NEW.quote_number,''),'(no number)')||' · '||NEW.currency||' '||trim_scale(NEW.amount));
  PERFORM public.write_audit(NEW.organization_id,'order.quote_received','order_quote',NEW.id);
  IF NEW.revises_quote_id IS NOT NULL THEN UPDATE public.order_quotes SET status='superseded',decided_at=now(),decided_by=auth.uid() WHERE id=NEW.revises_quote_id AND organization_id=NEW.organization_id AND status='pending'; END IF;
 ELSIF TG_TABLE_NAME='order_payments' THEN
  PERFORM public.order_event(r.organization_id,r.order_id,CASE TG_OP WHEN 'INSERT' THEN 'payment.recorded' ELSE 'payment.removed' END,CASE r.direction WHEN 'in' THEN 'Received ' ELSE 'Paid ' END||r.currency||' '||r.amount||' on '||r.paid_on||coalesce(' · ref '||nullif(r.reference,''),''));
  PERFORM public.write_audit(r.organization_id,CASE TG_OP WHEN 'INSERT' THEN 'order.payment_recorded' ELSE 'order.payment_removed' END,'order_payment',r.id);
 ELSIF TG_TABLE_NAME='order_documents' THEN
  PERFORM public.order_event(NEW.organization_id,NEW.order_id,'document.added',replace(NEW.doc_type,'_',' ')||': '||NEW.name);
 END IF;
 RETURN r; END $$;
REVOKE ALL ON FUNCTION public.log_order_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER orders_log_insert AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_change();
CREATE TRIGGER orders_log_update BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_order_change();
CREATE TRIGGER order_items_log AFTER INSERT OR DELETE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.log_order_change();
CREATE TRIGGER order_quotes_log AFTER INSERT ON public.order_quotes FOR EACH ROW EXECUTE FUNCTION public.log_order_change();
CREATE TRIGGER order_payments_log AFTER INSERT OR DELETE ON public.order_payments FOR EACH ROW EXECUTE FUNCTION public.log_order_change();
CREATE TRIGGER order_documents_log AFTER INSERT ON public.order_documents FOR EACH ROW EXECUTE FUNCTION public.log_order_change();

-- Accept / reject / withdraw a pending quote (owner/admin). Accepted quotes can be withdrawn with a reason.
CREATE FUNCTION public.decide_order_quote(p_org uuid,p_quote uuid,p_status text,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE q public.order_quotes; BEGIN
 IF NOT public.has_org_role(p_org,ARRAY['owner','admin']) THEN RAISE EXCEPTION 'Only owners and administrators can decide quotes'; END IF;
 IF p_status NOT IN ('accepted','rejected','withdrawn') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 SELECT * INTO q FROM public.order_quotes WHERE id=p_quote AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
 IF NOT (q.status='pending' OR (q.status='accepted' AND p_status='withdrawn')) THEN RAISE EXCEPTION 'This quote was already decided'; END IF;
 IF p_status IN ('rejected','withdrawn') AND length(btrim(coalesce(p_note,'')))=0 THEN RAISE EXCEPTION 'Give a reason'; END IF;
 UPDATE public.order_quotes SET status=p_status,decision_note=left(btrim(coalesce(p_note,'')),1000),decided_by=auth.uid(),decided_at=now() WHERE id=p_quote;
 PERFORM public.order_event(p_org,q.order_id,'quote.'||p_status,q.kind||' quote '||coalesce(nullif(q.quote_number,''),'(no number)')||coalesce(' · '||nullif(btrim(p_note),''),''));
 PERFORM public.write_audit(p_org,'order.quote_'||p_status,'order_quote',p_quote);
END $$;
REVOKE ALL ON FUNCTION public.decide_order_quote(uuid,uuid,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.decide_order_quote(uuid,uuid,text,text) TO authenticated;

CREATE FUNCTION public.add_order_note(p_org uuid,p_order uuid,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.has_org_role(p_org,ARRAY['owner','admin']) OR NOT EXISTS(SELECT 1 FROM public.orders WHERE id=p_order AND organization_id=p_org) THEN RAISE EXCEPTION 'Order access denied'; END IF;
 IF length(btrim(coalesce(p_note,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Write a note of up to 2000 characters'; END IF;
 PERFORM public.order_event(p_org,p_order,'note',btrim(p_note));
END $$;
REVOKE ALL ON FUNCTION public.add_order_note(uuid,uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.add_order_note(uuid,uuid,text) TO authenticated;

-- Private order documents: <org>/<order>/<file>. Members read; owners/admins upload; unreferenced uploads can be cleaned up.
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('order-documents','order-documents',false,10485760) ON CONFLICT (id) DO NOTHING;
CREATE FUNCTION public.can_order_object(p_name text,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE o uuid; d uuid; BEGIN
 IF p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/' THEN RETURN false; END IF; o:=split_part(p_name,'/',1)::uuid; d:=split_part(p_name,'/',2)::uuid;
 RETURN EXISTS(SELECT 1 FROM public.orders WHERE organization_id=o AND id=d) AND public.is_org_member(o) AND (NOT p_write OR public.has_org_role(o,ARRAY['owner','admin']));
 EXCEPTION WHEN invalid_text_representation THEN RETURN false; END $$;
REVOKE ALL ON FUNCTION public.can_order_object(text,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.can_order_object(text,boolean) TO authenticated;
CREATE POLICY order_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='order-documents' AND public.can_order_object(name,false));
CREATE POLICY order_storage_create ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='order-documents' AND public.can_order_object(name,true));
CREATE POLICY order_storage_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='order-documents' AND public.can_order_object(name,true) AND NOT EXISTS(SELECT 1 FROM public.order_documents WHERE object_path=storage.objects.name));

CREATE INDEX orders_org_status ON public.orders(organization_id,status,created_at DESC);
CREATE INDEX orders_buyer ON public.orders(organization_id,buyer_entity_id);
CREATE INDEX order_items_order ON public.order_items(organization_id,order_id);
CREATE INDEX order_quotes_order ON public.order_quotes(organization_id,order_id,created_at);
CREATE INDEX order_quotes_party ON public.order_quotes(organization_id,party_entity_id);
CREATE INDEX order_payments_order ON public.order_payments(organization_id,order_id,paid_on);
CREATE INDEX order_documents_order ON public.order_documents(organization_id,order_id);
CREATE INDEX order_events_order ON public.order_events(organization_id,order_id,created_at DESC);
