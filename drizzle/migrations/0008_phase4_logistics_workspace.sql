CREATE TABLE public.logistics_profiles (
 organization_id uuid NOT NULL REFERENCES public.organizations(id), entity_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('shipping_agent','transporter','both')), legal_name text NOT NULL CHECK(length(btrim(legal_name)) BETWEEN 1 AND 160), country text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', license_number text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,entity_id), FOREIGN KEY(organization_id,entity_id) REFERENCES public.entities(organization_id,id)
);
GRANT SELECT,INSERT ON public.logistics_profiles TO authenticated; GRANT ALL ON public.logistics_profiles TO service_role;
ALTER TABLE public.logistics_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_profiles_read ON public.logistics_profiles FOR SELECT TO authenticated USING(public.can_trade_entity(organization_id,entity_id,false));
CREATE POLICY logistics_profiles_create ON public.logistics_profiles FOR INSERT TO authenticated WITH CHECK(public.can_trade_entity(organization_id,entity_id,true));
CREATE TABLE public.ports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), code text NOT NULL CHECK(code ~ '^[A-Z]{2}[A-Z0-9]{3}$'), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160), country text NOT NULL CHECK(country ~ '^[A-Z]{2}$'), city text NOT NULL DEFAULT '', UNIQUE(organization_id,id), UNIQUE(organization_id,code)
);
GRANT SELECT,INSERT ON public.ports TO authenticated; GRANT ALL ON public.ports TO service_role;
ALTER TABLE public.ports ENABLE ROW LEVEL SECURITY;
CREATE POLICY ports_read ON public.ports FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY ports_create ON public.ports FOR INSERT TO authenticated WITH CHECK(public.has_org_role(organization_id,ARRAY['owner','admin']));
CREATE TABLE public.shipping_routes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), shipping_agent_entity_id uuid NOT NULL, origin_port_id uuid NOT NULL, destination_port_id uuid NOT NULL, mode text NOT NULL CHECK(mode IN ('FCL','LCL')), container_type text NOT NULL DEFAULT '', transit_min_days integer NOT NULL CHECK(transit_min_days>=0), transit_max_days integer NOT NULL CHECK(transit_max_days>=transit_min_days), frequency text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), CHECK(origin_port_id<>destination_port_id), CHECK((mode='FCL' AND container_type IN ('20GP','40GP','40HC','20RF','40RF','20OT','40OT','FLAT_RACK')) OR (mode='LCL' AND container_type='')),
 FOREIGN KEY(organization_id,shipping_agent_entity_id) REFERENCES public.logistics_profiles(organization_id,entity_id), FOREIGN KEY(organization_id,origin_port_id) REFERENCES public.ports(organization_id,id), FOREIGN KEY(organization_id,destination_port_id) REFERENCES public.ports(organization_id,id)
);
GRANT SELECT,INSERT ON public.shipping_routes TO authenticated; GRANT ALL ON public.shipping_routes TO service_role;
ALTER TABLE public.shipping_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY routes_read ON public.shipping_routes FOR SELECT TO authenticated USING(public.can_trade_entity(organization_id,shipping_agent_entity_id,false));
CREATE POLICY routes_create ON public.shipping_routes FOR INSERT TO authenticated WITH CHECK(public.can_trade_entity(organization_id,shipping_agent_entity_id,true));
CREATE TABLE public.transporter_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), transporter_entity_id uuid NOT NULL, registration text NOT NULL CHECK(length(btrim(registration)) BETWEEN 1 AND 80), vehicle_type text NOT NULL CHECK(vehicle_type IN ('truck','van','trailer','reefer','container_truck')), capacity_kg numeric(18,3) NOT NULL CHECK(capacity_kg>0), capacity_cbm numeric(18,3) NOT NULL CHECK(capacity_cbm>0), notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), UNIQUE(organization_id,registration), FOREIGN KEY(organization_id,transporter_entity_id) REFERENCES public.logistics_profiles(organization_id,entity_id)
);
GRANT SELECT,INSERT ON public.transporter_assets TO authenticated; GRANT ALL ON public.transporter_assets TO service_role;
ALTER TABLE public.transporter_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_read ON public.transporter_assets FOR SELECT TO authenticated USING(public.can_trade_entity(organization_id,transporter_entity_id,false));
CREATE POLICY assets_create ON public.transporter_assets FOR INSERT TO authenticated WITH CHECK(public.can_trade_entity(organization_id,transporter_entity_id,true));
CREATE TABLE public.transporter_service_areas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), transporter_entity_id uuid NOT NULL, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160), country text NOT NULL CHECK(country ~ '^[A-Z]{2}$'), pickup_zone text NOT NULL CHECK(length(btrim(pickup_zone)) BETWEEN 1 AND 500), delivery_zone text NOT NULL CHECK(length(btrim(delivery_zone)) BETWEEN 1 AND 500), transit_min_days integer NOT NULL DEFAULT 0 CHECK(transit_min_days>=0), transit_max_days integer NOT NULL DEFAULT 0 CHECK(transit_max_days>=transit_min_days), notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), FOREIGN KEY(organization_id,transporter_entity_id) REFERENCES public.logistics_profiles(organization_id,entity_id)
);
GRANT SELECT,INSERT ON public.transporter_service_areas TO authenticated; GRANT ALL ON public.transporter_service_areas TO service_role;
ALTER TABLE public.transporter_service_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY areas_read ON public.transporter_service_areas FOR SELECT TO authenticated USING(public.can_trade_entity(organization_id,transporter_entity_id,false));
CREATE POLICY areas_create ON public.transporter_service_areas FOR INSERT TO authenticated WITH CHECK(public.can_trade_entity(organization_id,transporter_entity_id,true));
CREATE TABLE public.shipping_rates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), shipping_route_id uuid, service_area_id uuid, asset_id uuid, amount numeric(18,6) NOT NULL CHECK(amount>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), unit text NOT NULL CHECK(unit IN ('container','cbm','tonne','trip','km','kg')), min_quantity numeric(18,3) NOT NULL DEFAULT 1 CHECK(min_quantity>0), valid_from date NOT NULL, valid_until date NOT NULL CHECK(valid_until>=valid_from), notes text NOT NULL DEFAULT '', created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), CHECK(num_nonnulls(shipping_route_id,service_area_id)=1), CHECK(asset_id IS NULL OR service_area_id IS NOT NULL), FOREIGN KEY(organization_id,shipping_route_id) REFERENCES public.shipping_routes(organization_id,id), FOREIGN KEY(organization_id,service_area_id) REFERENCES public.transporter_service_areas(organization_id,id), FOREIGN KEY(organization_id,asset_id) REFERENCES public.transporter_assets(organization_id,id)
);
GRANT SELECT,INSERT ON public.shipping_rates TO authenticated; GRANT ALL ON public.shipping_rates TO service_role;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.can_logistics_rate(p_org uuid,p_route uuid,p_area uuid,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN p_route IS NOT NULL THEN EXISTS(SELECT 1 FROM public.shipping_routes r WHERE r.organization_id=p_org AND r.id=p_route AND public.can_trade_entity(p_org,r.shipping_agent_entity_id,p_write)) ELSE EXISTS(SELECT 1 FROM public.transporter_service_areas a WHERE a.organization_id=p_org AND a.id=p_area AND public.can_trade_entity(p_org,a.transporter_entity_id,p_write)) END $$;
REVOKE ALL ON FUNCTION public.can_logistics_rate(uuid,uuid,uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.can_logistics_rate(uuid,uuid,uuid,boolean) TO authenticated;
CREATE POLICY rates_read ON public.shipping_rates FOR SELECT TO authenticated USING(public.can_logistics_rate(organization_id,shipping_route_id,service_area_id,false));
CREATE POLICY rates_create ON public.shipping_rates FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.can_logistics_rate(organization_id,shipping_route_id,service_area_id,true) AND (asset_id IS NULL OR EXISTS(SELECT 1 FROM public.transporter_assets t JOIN public.transporter_service_areas a ON a.organization_id=t.organization_id AND a.transporter_entity_id=t.transporter_entity_id WHERE t.organization_id=shipping_rates.organization_id AND t.id=shipping_rates.asset_id AND a.id=shipping_rates.service_area_id)));
CREATE TRIGGER immutable_shipping_rates BEFORE UPDATE OR DELETE ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.reject_price_history_change();
CREATE TABLE public.logistics_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), entity_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200), object_path text NOT NULL UNIQUE, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(organization_id,entity_id) REFERENCES public.logistics_profiles(organization_id,entity_id), CHECK(object_path LIKE organization_id::text||'/'||entity_id::text||'/%')
);
GRANT SELECT,INSERT ON public.logistics_documents TO authenticated; GRANT ALL ON public.logistics_documents TO service_role;
ALTER TABLE public.logistics_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_documents_read ON public.logistics_documents FOR SELECT TO authenticated USING(public.can_trade_entity(organization_id,entity_id,false));
CREATE POLICY logistics_documents_create ON public.logistics_documents FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND public.can_trade_entity(organization_id,entity_id,true));
CREATE FUNCTION public.can_logistics_object(p_name text,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE o uuid; e uuid; BEGIN IF p_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/' THEN RETURN false; END IF; o:=split_part(p_name,'/',1)::uuid; e:=split_part(p_name,'/',2)::uuid; RETURN EXISTS(SELECT 1 FROM public.logistics_profiles WHERE organization_id=o AND entity_id=e) AND public.can_trade_entity(o,e,p_write); EXCEPTION WHEN invalid_text_representation THEN RETURN false; END $$;
REVOKE ALL ON FUNCTION public.can_logistics_object(text,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.can_logistics_object(text,boolean) TO authenticated;
CREATE POLICY logistics_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='logistics-documents' AND public.can_logistics_object(name,false));
CREATE POLICY logistics_storage_create ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='logistics-documents' AND public.can_logistics_object(name,true));
CREATE POLICY logistics_storage_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='logistics-documents' AND public.can_logistics_object(name,true) AND NOT EXISTS(SELECT 1 FROM public.logistics_documents WHERE object_path=storage.objects.name));
CREATE TABLE public.logistics_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id), entity_id uuid, actor_user_id uuid, resource_type text NOT NULL, resource_id uuid, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.logistics_activity TO authenticated; GRANT ALL ON public.logistics_activity TO service_role;
ALTER TABLE public.logistics_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_activity_read ON public.logistics_activity FOR SELECT TO authenticated USING(public.is_org_member(organization_id) AND (entity_id IS NULL OR public.can_trade_entity(organization_id,entity_id,false)));
CREATE FUNCTION public.audit_logistics_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE e uuid; j jsonb; BEGIN j:=to_jsonb(NEW); e:=coalesce(j->>'entity_id',j->>'shipping_agent_entity_id',j->>'transporter_entity_id')::uuid; IF TG_TABLE_NAME='shipping_rates' THEN IF NEW.shipping_route_id IS NOT NULL THEN SELECT shipping_agent_entity_id INTO e FROM public.shipping_routes WHERE id=NEW.shipping_route_id AND organization_id=NEW.organization_id; ELSE SELECT transporter_entity_id INTO e FROM public.transporter_service_areas WHERE id=NEW.service_area_id AND organization_id=NEW.organization_id; END IF; END IF; INSERT INTO public.logistics_activity(organization_id,entity_id,actor_user_id,resource_type,resource_id,action) VALUES(NEW.organization_id,e,auth.uid(),TG_TABLE_NAME,coalesce(j->>'id',j->>'entity_id')::uuid,'created'); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.audit_logistics_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER logistics_profile_audit AFTER INSERT ON public.logistics_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_logistics_insert();
CREATE TRIGGER ports_audit AFTER INSERT ON public.ports FOR EACH ROW EXECUTE FUNCTION public.audit_logistics_insert();
CREATE TRIGGER routes_audit AFTER INSERT ON public.shipping_routes FOR EACH ROW EXECUTE FUNCTION public.audit_logistics_insert();
CREATE TRIGGER assets_audit AFTER INSERT ON public.transporter_assets FOR EACH ROW EXECUTE FUNCTION public.audit_logistics_insert();
CREATE TRIGGER areas_audit AFTER INSERT ON public.transporter_service_areas FOR EACH ROW EXECUTE FUNCTION public.audit_logistics_insert();
CREATE TRIGGER rates_audit AFTER INSERT ON public.shipping_rates FOR EACH ROW EXECUTE FUNCTION public.audit_logistics_insert();
CREATE TRIGGER documents_audit AFTER INSERT ON public.logistics_documents FOR EACH ROW EXECUTE FUNCTION public.audit_logistics_insert();
CREATE INDEX logistics_rates_validity ON public.shipping_rates(organization_id,valid_from DESC,valid_until);
CREATE INDEX logistics_routes_agent ON public.shipping_routes(organization_id,shipping_agent_entity_id);
CREATE INDEX logistics_assets_transporter ON public.transporter_assets(organization_id,transporter_entity_id);
CREATE INDEX logistics_areas_transporter ON public.transporter_service_areas(organization_id,transporter_entity_id);
CREATE INDEX logistics_activity_org ON public.logistics_activity(organization_id,created_at DESC);