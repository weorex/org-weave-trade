REVOKE ALL ON public.entity_types,public.entity_field_definitions,public.entity_type_layouts,public.entities FROM authenticated,anon;
GRANT SELECT ON public.entity_types,public.entity_field_definitions,public.entity_type_layouts TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.entities TO authenticated;
GRANT UPDATE(data) ON public.entities TO authenticated;
CREATE FUNCTION public.validate_entity_configuration_input() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE s jsonb; BEGIN
 s:=NEW.settings;
 IF jsonb_typeof(s)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(s) k WHERE k NOT IN ('min','max','minLength','maxLength','options','targetTypeId')) THEN RAISE EXCEPTION 'Invalid settings'; END IF;
 IF s ? 'min' AND jsonb_typeof(s->'min')<>'number' OR s ? 'max' AND jsonb_typeof(s->'max')<>'number' THEN RAISE EXCEPTION 'Invalid numeric constraints'; END IF;
 IF s ? 'min' AND s ? 'max' AND (s->>'min')::numeric>(s->>'max')::numeric THEN RAISE EXCEPTION 'Invalid range'; END IF;
 IF s ? 'minLength' AND ((s->>'minLength')::numeric NOT BETWEEN 0 AND 10000 OR (s->>'minLength')::numeric<>trunc((s->>'minLength')::numeric)) OR s ? 'maxLength' AND ((s->>'maxLength')::numeric NOT BETWEEN 1 AND 10000 OR (s->>'maxLength')::numeric<>trunc((s->>'maxLength')::numeric)) THEN RAISE EXCEPTION 'Invalid length constraints'; END IF;
 IF s ? 'minLength' AND s ? 'maxLength' AND (s->>'minLength')::numeric>(s->>'maxLength')::numeric THEN RAISE EXCEPTION 'Invalid length range'; END IF;
 IF NEW.field_type='select' AND (s->'options' IS NULL OR jsonb_typeof(s->'options')<>'array' OR jsonb_array_length(s->'options') NOT BETWEEN 1 AND 100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'options') o WHERE jsonb_typeof(o)<>'string' OR length(o #>> '{}') NOT BETWEEN 1 AND 100)) THEN RAISE EXCEPTION 'Invalid options'; END IF;
 IF NEW.field_type='relationship' AND (s->>'targetTypeId' IS NULL OR NOT EXISTS(SELECT 1 FROM public.entity_types WHERE id=(s->>'targetTypeId')::uuid AND organization_id=NEW.organization_id)) THEN RAISE EXCEPTION 'Invalid relationship type'; END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.validate_entity_configuration_input() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER metadata_field_settings BEFORE INSERT ON public.entity_field_definitions FOR EACH ROW EXECUTE FUNCTION public.validate_entity_configuration_input();
CREATE FUNCTION public.validate_entity_layout_input() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE a text; BEGIN
 IF jsonb_typeof(NEW.layout) IS DISTINCT FROM 'object' OR jsonb_typeof(NEW.layout->'permissions') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid layout'; END IF;
 FOREACH a IN ARRAY ARRAY['form','detail','columns','filters','tabs'] LOOP IF jsonb_typeof(NEW.layout->a) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid layout section'; END IF; END LOOP;
 FOREACH a IN ARRAY ARRAY['read','create','update','delete'] LOOP IF jsonb_typeof(NEW.layout->'permissions'->a) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid permissions'; END IF; END LOOP;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.validate_entity_layout_input() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER metadata_layout_input BEFORE INSERT ON public.entity_type_layouts FOR EACH ROW EXECUTE FUNCTION public.validate_entity_layout_input();
CREATE FUNCTION public.prevent_referenced_entity_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.entities e JOIN public.entity_field_definitions f ON f.organization_id=e.organization_id AND f.entity_type_id=e.entity_type_id AND f.configuration_version=e.configuration_version WHERE e.organization_id=OLD.organization_id AND f.field_type='relationship' AND e.data->>f.field_key=OLD.id::text AND e.id<>OLD.id) THEN RAISE EXCEPTION 'Record is referenced by another record'; END IF; RETURN OLD; END $$;
REVOKE ALL ON FUNCTION public.prevent_referenced_entity_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_entity_relationships BEFORE DELETE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.prevent_referenced_entity_delete();