ALTER TABLE public.facturas ADD COLUMN prueba_flujo_id uuid;
CREATE OR REPLACE FUNCTION public.guardar_factura_procesada(p_factura jsonb,p_decision jsonb,p_eventos jsonb,p_cotizacion text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE f public.facturas%ROWTYPE; d public.decisiones%ROWTYPE; v_id uuid; v_decision uuid;
BEGIN
 f:=jsonb_populate_record(NULL::public.facturas,p_factura); d:=jsonb_populate_record(NULL::public.decisiones,p_decision);
 IF d.decision IN ('PAGAR','POSTERGAR') AND d.fecha_programada_pago IS NULL THEN RAISE EXCEPTION 'FECHA_PAGO_INVALIDA'; END IF;
 INSERT INTO public.facturas(codigo,canal,nombre_archivo,archivo_url,texto_original,tipo_documento,emisor,receptor,numero,fecha_emision,fecha_vencimiento,fecha_recepcion,descripcion,monto,moneda,pago_banco,pago_cuenta,confianza_extraccion,prueba_flujo_id) VALUES(f.codigo,f.canal,f.nombre_archivo,f.archivo_url,f.texto_original,f.tipo_documento,f.emisor,f.receptor,f.numero,f.fecha_emision,f.fecha_vencimiento,f.fecha_recepcion,f.descripcion,f.monto,f.moneda,f.pago_banco,f.pago_cuenta,f.confianza_extraccion,f.prueba_flujo_id) RETURNING id INTO v_id;
 INSERT INTO public.decisiones(factura_id,decision,estado,motivo,controles,monto_usd,proveedor_id,categoria,cuenta_pago,fecha_programada_pago,escalar_a,factura_relacionada_id,politica_version,decidido_por) VALUES(v_id,d.decision,d.estado,d.motivo,d.controles,d.monto_usd,d.proveedor_id,d.categoria,d.cuenta_pago,d.fecha_programada_pago,d.escalar_a,d.factura_relacionada_id,d.politica_version,d.decidido_por) RETURNING id INTO v_decision;
 INSERT INTO public.registro_eventos(factura_id,evento,actor,detalle) SELECT v_id,e->>'evento',e->>'actor',e->>'detalle' FROM jsonb_array_elements(p_eventos) e;
 IF d.decision IN ('PAGAR','POSTERGAR') THEN
 INSERT INTO public.programacion_pagos(decision_id,factura_id,cuenta_pago,moneda,monto,monto_usd,monto_cuenta,fecha_pago,estado) VALUES(v_decision,v_id,d.cuenta_pago,f.moneda,f.monto,d.monto_usd,(p_decision->>'monto_cuenta')::numeric,d.fecha_programada_pago,CASE WHEN d.decision='PAGAR' THEN 'programado' ELSE 'pospuesto' END);
 END IF;
 IF d.decision='PAGAR' AND p_cotizacion IS NOT NULL THEN PERFORM public.marcar_cotizacion_utilizada(p_cotizacion,v_id,d.decidido_por); END IF;
 RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.guardar_factura_procesada(jsonb,jsonb,jsonb,text) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.limpiar_prueba_flujo(p_prueba uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_prueba IS NULL THEN RAISE EXCEPTION 'PRUEBA_REQUERIDA'; END IF;
 PERFORM set_config('app.permitir_reinicio','on',true);
 DELETE FROM public.registro_eventos WHERE factura_id IN(SELECT id FROM public.facturas WHERE prueba_flujo_id=p_prueba);
 DELETE FROM public.programacion_pagos WHERE factura_id IN(SELECT id FROM public.facturas WHERE prueba_flujo_id=p_prueba);
 DELETE FROM public.decisiones WHERE factura_id IN(SELECT id FROM public.facturas WHERE prueba_flujo_id=p_prueba);
 DELETE FROM public.facturas WHERE prueba_flujo_id=p_prueba;
 PERFORM set_config('app.permitir_reinicio','off',true);
END $$;
GRANT EXECUTE ON FUNCTION public.limpiar_prueba_flujo(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.bloquear_pago_duplicado() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_numero text; v_prueba uuid;
BEGIN
 IF NEW.decision <> 'PAGAR' OR NEW.proveedor_id IS NULL THEN RETURN NEW; END IF;
 SELECT numero,prueba_flujo_id INTO v_numero,v_prueba FROM public.facturas WHERE id=NEW.factura_id;
 IF v_numero IS NOT NULL AND EXISTS(SELECT 1 FROM public.decisiones d JOIN public.facturas f ON f.id=d.factura_id WHERE d.decision='PAGAR' AND d.proveedor_id=NEW.proveedor_id AND f.numero=v_numero AND d.id<>NEW.id AND f.prueba_flujo_id IS NOT DISTINCT FROM v_prueba) THEN RAISE EXCEPTION 'PAGO_DUPLICADO'; END IF;
 RETURN NEW;
END $$;