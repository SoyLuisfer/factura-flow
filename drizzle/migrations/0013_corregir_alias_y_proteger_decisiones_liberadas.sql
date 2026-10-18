DO $$
DECLARE definicion text; prefijo text; resto text;
BEGIN
 definicion:=pg_get_functiondef('public.liberar_fondos(text,date,uuid[],numeric,text,text)'::regprocedure);
 prefijo:=split_part(definicion,' SELECT sum(p.monto_cuenta)',1);
 resto:=substring(definicion from length(prefijo)+1);
 prefijo:=replace(replace(prefijo,' f public.facturas%ROWTYPE',' v_factura public.facturas%ROWTYPE'),'f.','v_factura.');
 prefijo:=replace(prefijo,'INTO f FROM','INTO v_factura FROM');
 EXECUTE prefijo||resto;
END $$;
CREATE FUNCTION public.proteger_decision_liberada() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_setting('app.permitir_reinicio',true)='on' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF EXISTS(SELECT 1 FROM public.lotes_pago_facturas WHERE factura_id=CASE WHEN TG_OP='DELETE' THEN OLD.factura_id ELSE NEW.factura_id END) THEN RAISE EXCEPTION 'FONDOS_YA_LIBERADOS'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER proteger_decision_liberada BEFORE INSERT OR UPDATE OR DELETE ON public.decisiones FOR EACH ROW EXECUTE FUNCTION public.proteger_decision_liberada();