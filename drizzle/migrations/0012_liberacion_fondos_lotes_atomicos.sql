CREATE TABLE public.lotes_pago (
 id text PRIMARY KEY, cuenta text NOT NULL REFERENCES public.cuentas_bancarias(id), fecha_pago date NOT NULL,
 facturas_incluidas jsonb NOT NULL, total numeric NOT NULL CHECK(total>0), liberado_por text NOT NULL, liberado_en timestamptz NOT NULL DEFAULT now(), comentario text NOT NULL
);
GRANT SELECT ON public.lotes_pago TO anon, authenticated;
GRANT ALL ON public.lotes_pago TO service_role;
ALTER TABLE public.lotes_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo lectura lotes" ON public.lotes_pago FOR SELECT TO anon, authenticated USING(true);
CREATE TABLE public.lotes_pago_facturas (
 factura_id uuid PRIMARY KEY REFERENCES public.facturas(id), lote_id text NOT NULL REFERENCES public.lotes_pago(id)
);
GRANT SELECT ON public.lotes_pago_facturas TO anon, authenticated;
GRANT ALL ON public.lotes_pago_facturas TO service_role;
ALTER TABLE public.lotes_pago_facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo lectura facturas lotes" ON public.lotes_pago_facturas FOR SELECT TO anon, authenticated USING(true);
ALTER TABLE public.programacion_pagos ADD COLUMN liberado_lote_id text REFERENCES public.lotes_pago(id);
CREATE SEQUENCE public.numero_lote_pago;
ALTER TABLE public.registro_eventos DROP CONSTRAINT registro_eventos_evento_check;
ALTER TABLE public.registro_eventos ADD CONSTRAINT registro_eventos_evento_check CHECK(evento = ANY(ARRAY['recibida','extraida','decidida','aprobada','rechazada','corregida','politica_modificada','proveedor_modificado','proveedor_eliminado','cotizacion_utilizada','pago_parcial','pago_postergado','pago_reprogramado','fondos_liberados']));
CREATE FUNCTION public.proteger_programacion_liberada() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_setting('app.permitir_reinicio',true)='on' THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF EXISTS(SELECT 1 FROM public.lotes_pago_facturas WHERE factura_id=CASE WHEN TG_OP='DELETE' THEN OLD.factura_id ELSE NEW.factura_id END) THEN RAISE EXCEPTION 'FONDOS_YA_LIBERADOS'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER proteger_programacion_liberada BEFORE INSERT OR UPDATE OR DELETE ON public.programacion_pagos FOR EACH ROW EXECUTE FUNCTION public.proteger_programacion_liberada();
CREATE FUNCTION public.liberar_fondos(p_cuenta text,p_fecha date,p_facturas uuid[],p_total numeric,p_actor text,p_comentario text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.cuentas_bancarias%ROWTYPE; d public.decisiones%ROWTYPE; f public.facturas%ROWTYPE; v_cuenta numeric; v_tasa numeric; v_fecha date; v_total numeric; v_ids uuid[]; v_detalle jsonb; v_lote text; v_id uuid;
BEGIN
 IF p_actor IS NULL OR p_actor NOT IN ('Luis Samayoa (Finanzas)','Ana Morales (Contabilidad)') THEN RAISE EXCEPTION 'USUARIO_REQUERIDO'; END IF;
 IF coalesce(trim(p_comentario),'')='' THEN RAISE EXCEPTION 'COMENTARIO_REQUERIDO'; END IF;
 SELECT * INTO c FROM public.cuentas_bancarias WHERE id=p_cuenta FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CUENTA_INVALIDA'; END IF;
 -- Lock decisions before materializing virtual schedules, serializing treasury actions.
 FOR d IN SELECT x.* FROM public.decisiones x WHERE x.cuenta_pago=p_cuenta AND x.decision='PAGAR' AND x.estado IN ('final','aprobada_humano') AND NOT EXISTS(SELECT 1 FROM public.decisiones n WHERE n.factura_id=x.factura_id AND n.decidido_en>x.decidido_en) ORDER BY x.id FOR UPDATE LOOP
  IF NOT EXISTS(SELECT 1 FROM public.programacion_pagos WHERE decision_id=d.id) THEN
   SELECT * INTO f FROM public.facturas WHERE id=d.factura_id;
   SELECT por_usd INTO v_tasa FROM public.tipos_cambio WHERE moneda=c.moneda ORDER BY vigente_desde DESC LIMIT 1;
   v_cuenta:=CASE WHEN f.moneda=c.moneda THEN f.monto ELSE round(d.monto_usd*v_tasa,2) END;
   IF d.ajuste->'conversion'->>'monto_final' IS NOT NULL THEN v_cuenta:=least(v_cuenta,(d.ajuste->'conversion'->>'monto_final')::numeric); END IF;
   INSERT INTO public.programacion_pagos(decision_id,factura_id,cuenta_pago,moneda,monto,monto_usd,monto_cuenta,fecha_pago,estado) VALUES(d.id,f.id,p_cuenta,f.moneda,f.monto,d.monto_usd,v_cuenta,d.fecha_programada_pago,'programado');
  END IF;
 END LOOP;
 PERFORM 1 FROM public.programacion_pagos WHERE cuenta_pago=p_cuenta ORDER BY id FOR UPDATE;
 SELECT min(p.fecha_pago) INTO v_fecha FROM public.programacion_pagos p JOIN public.decisiones x ON x.id=p.decision_id WHERE p.cuenta_pago=p_cuenta AND p.estado='programado' AND p.liberado_lote_id IS NULL AND p.fecha_pago>=(now() AT TIME ZONE 'America/Guatemala')::date AND NOT EXISTS(SELECT 1 FROM public.decisiones n WHERE n.factura_id=x.factura_id AND n.decidido_en>x.decidido_en);
 IF v_fecha IS NULL OR v_fecha<>p_fecha THEN RAISE EXCEPTION 'LOTE_DESACTUALIZADO'; END IF;
 IF EXISTS(SELECT 1 FROM public.programacion_pagos p JOIN public.lotes_pago_facturas lf ON lf.factura_id=p.factura_id WHERE p.cuenta_pago=p_cuenta AND p.fecha_pago=p_fecha AND p.estado='programado' AND p.liberado_lote_id IS NULL) THEN RAISE EXCEPTION 'FACTURA_EN_OTRO_LOTE'; END IF;
 SELECT sum(p.monto_cuenta),array_agg(DISTINCT p.factura_id ORDER BY p.factura_id),jsonb_agg(jsonb_build_object('factura_id',p.factura_id,'proveedor',coalesce(v.nombre,f.emisor),'banco',coalesce(v.banco_beneficiario,f.pago_banco),'cuenta_beneficiario',coalesce(v.cuenta_beneficiario,f.pago_cuenta),'factura',coalesce(f.numero,f.codigo),'codigo',f.codigo,'monto',p.monto_cuenta,'moneda',c.moneda,'monto_original',p.monto,'moneda_original',p.moneda) ORDER BY f.codigo,p.id) INTO v_total,v_ids,v_detalle FROM public.programacion_pagos p JOIN public.decisiones x ON x.id=p.decision_id JOIN public.facturas f ON f.id=p.factura_id LEFT JOIN public.proveedores v ON v.id=x.proveedor_id WHERE p.cuenta_pago=p_cuenta AND p.fecha_pago=p_fecha AND p.estado='programado' AND p.liberado_lote_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.decisiones n WHERE n.factura_id=x.factura_id AND n.decidido_en>x.decidido_en);
 IF v_total IS NULL OR p_total IS NULL OR v_total<>p_total OR v_ids IS DISTINCT FROM ARRAY(SELECT DISTINCT unnest(p_facturas) ORDER BY 1) THEN RAISE EXCEPTION 'LOTE_DESACTUALIZADO'; END IF;
 IF v_total>c.saldo_disponible THEN RAISE EXCEPTION 'SALDO_INSUFICIENTE'; END IF;
 v_lote:='LOTE-'||lpad(nextval('public.numero_lote_pago')::text,4,'0');
 INSERT INTO public.lotes_pago(id,cuenta,fecha_pago,facturas_incluidas,total,liberado_por,comentario) VALUES(v_lote,p_cuenta,p_fecha,v_detalle,v_total,p_actor,trim(p_comentario));
 UPDATE public.programacion_pagos SET liberado_lote_id=v_lote,actualizado_en=now() WHERE cuenta_pago=p_cuenta AND fecha_pago=p_fecha AND estado='programado' AND liberado_lote_id IS NULL AND factura_id=ANY(v_ids);
 INSERT INTO public.lotes_pago_facturas(factura_id,lote_id) SELECT unnest(v_ids),v_lote;
 UPDATE public.cuentas_bancarias SET saldo_disponible=saldo_disponible-v_total WHERE id=p_cuenta;
 FOREACH v_id IN ARRAY v_ids LOOP
  INSERT INTO public.registro_eventos(evento,actor,factura_id,detalle) VALUES('fondos_liberados',p_actor,v_id,format('%s · %s · total %s %s · %s facturas · viernes %s · %s',v_lote,p_cuenta,c.moneda,to_char(v_total,'FM999999999990.00'),cardinality(v_ids),to_char(p_fecha,'DD/MM/YYYY'),trim(p_comentario)));
 END LOOP;
 RETURN v_lote;
END $$;
REVOKE ALL ON FUNCTION public.liberar_fondos(text,date,uuid[],numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_fondos(text,date,uuid[],numeric,text,text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.reiniciar_demo() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM set_config('app.permitir_reinicio','on',true);
 DELETE FROM public.registro_eventos WHERE true;
 DELETE FROM public.programacion_pagos WHERE true;
 DELETE FROM public.lotes_pago_facturas WHERE true;
 DELETE FROM public.lotes_pago WHERE true;
 ALTER SEQUENCE public.numero_lote_pago RESTART WITH 1;
 DELETE FROM public.decisiones WHERE true;
 DELETE FROM public.facturas WHERE true;
 DELETE FROM public.pagos_previos WHERE true;
 DELETE FROM public.contratos WHERE true;
 DELETE FROM public.proveedores WHERE true;
 DELETE FROM public.politicas WHERE true;
 DELETE FROM public.tipos_cambio WHERE true;
 DELETE FROM public.cuentas_bancarias WHERE true;
 DELETE FROM public.empresa WHERE true;
 PERFORM public.cargar_datos_maestros();
END $$;