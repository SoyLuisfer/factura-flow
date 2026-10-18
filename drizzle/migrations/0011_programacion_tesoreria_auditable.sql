CREATE TABLE public.programacion_pagos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 decision_id uuid NOT NULL REFERENCES public.decisiones(id) ON DELETE CASCADE,
 factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
 cuenta_pago text NOT NULL REFERENCES public.cuentas_bancarias(id),
 moneda text NOT NULL CHECK (moneda IN ('USD','GTQ')),
 monto numeric NOT NULL CHECK (monto > 0),
 monto_usd numeric NOT NULL CHECK (monto_usd > 0),
 monto_cuenta numeric NOT NULL CHECK (monto_cuenta > 0),
 fecha_pago date NOT NULL,
 estado text NOT NULL CHECK (estado IN ('programado','pospuesto')),
 actualizado_en timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.programacion_pagos TO anon, authenticated;
GRANT ALL ON public.programacion_pagos TO service_role;
ALTER TABLE public.programacion_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo lectura programacion" ON public.programacion_pagos FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX programacion_pagos_decision_idx ON public.programacion_pagos(decision_id);
ALTER TABLE public.registro_eventos DROP CONSTRAINT registro_eventos_evento_check;
ALTER TABLE public.registro_eventos ADD CONSTRAINT registro_eventos_evento_check CHECK (evento = ANY (ARRAY['recibida','extraida','decidida','aprobada','rechazada','corregida','politica_modificada','proveedor_modificado','proveedor_eliminado','cotizacion_utilizada','pago_parcial','pago_postergado','pago_reprogramado']));
CREATE OR REPLACE FUNCTION public.accion_tesoreria(p_decision uuid, p_programacion uuid, p_accion text, p_monto numeric, p_fecha date, p_actor text, p_comentario text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.decisiones%ROWTYPE; f public.facturas%ROWTYPE; r public.programacion_pagos%ROWTYPE; v_tasa numeric; v_total numeric; v_usd numeric; v_cuenta numeric; v_moneda text; v_evento text; v_original numeric; v_fecha_original date;
BEGIN
 IF p_actor IS NULL OR p_actor NOT IN ('Luis Samayoa (Finanzas)','Ana Morales (Contabilidad)') THEN RAISE EXCEPTION 'USUARIO_REQUERIDO'; END IF;
 IF coalesce(trim(p_comentario),'')='' THEN RAISE EXCEPTION 'COMENTARIO_REQUERIDO'; END IF;
 IF p_accion IS NULL OR p_accion NOT IN ('parcial','postergar','reprogramar') THEN RAISE EXCEPTION 'ACCION_INVALIDA'; END IF;
 SELECT * INTO d FROM public.decisiones WHERE id=p_decision FOR UPDATE;
 IF NOT FOUND OR d.decision NOT IN ('PAGAR','POSTERGAR') OR d.estado NOT IN ('final','aprobada_humano') THEN RAISE EXCEPTION 'PAGO_NO_AUTORIZADO'; END IF;
 IF EXISTS (SELECT 1 FROM public.decisiones x WHERE x.factura_id=d.factura_id AND x.decidido_en>d.decidido_en) THEN RAISE EXCEPTION 'DECISION_DESACTUALIZADA'; END IF;
 SELECT * INTO f FROM public.facturas WHERE id=d.factura_id;
 IF f.monto IS NULL OR f.monto<=0 OR f.moneda NOT IN ('USD','GTQ') OR d.cuenta_pago IS NULL OR d.fecha_programada_pago IS NULL OR d.monto_usd IS NULL OR d.monto_usd<=0 THEN RAISE EXCEPTION 'PAGO_NO_AUTORIZADO'; END IF;
 IF p_programacion IS NULL THEN
  IF EXISTS (SELECT 1 FROM public.programacion_pagos WHERE decision_id=d.id) THEN RAISE EXCEPTION 'PROGRAMACION_DESACTUALIZADA'; END IF;
  SELECT moneda INTO v_moneda FROM public.cuentas_bancarias WHERE id=d.cuenta_pago;
  SELECT por_usd INTO v_tasa FROM public.tipos_cambio WHERE moneda=v_moneda ORDER BY vigente_desde DESC LIMIT 1;
  v_total:=f.monto; v_usd:=d.monto_usd; v_cuenta:=CASE WHEN f.moneda=v_moneda THEN f.monto ELSE round(d.monto_usd*v_tasa,2) END;
  IF d.ajuste->'conversion'->>'monto_final' IS NOT NULL THEN
   v_cuenta:=least(v_cuenta,(d.ajuste->'conversion'->>'monto_final')::numeric);
  END IF;
  IF v_cuenta IS NULL OR v_cuenta<=0 THEN RAISE EXCEPTION 'PAGO_NO_AUTORIZADO'; END IF;
  INSERT INTO public.programacion_pagos(decision_id,factura_id,cuenta_pago,moneda,monto,monto_usd,monto_cuenta,fecha_pago,estado) VALUES(d.id,f.id,d.cuenta_pago,f.moneda,v_total,v_usd,v_cuenta,d.fecha_programada_pago,CASE WHEN d.decision='PAGAR' THEN 'programado' ELSE 'pospuesto' END) RETURNING * INTO r;
 ELSE
  SELECT * INTO r FROM public.programacion_pagos WHERE id=p_programacion AND decision_id=d.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROGRAMACION_DESACTUALIZADA'; END IF;
 END IF;
 v_original:=r.monto; v_fecha_original:=r.fecha_pago;
 IF p_accion='parcial' THEN
  IF r.estado<>'programado' OR p_monto IS NULL OR p_monto<=0 OR p_monto>=r.monto OR round(p_monto,2)<>p_monto THEN RAISE EXCEPTION 'MONTO_PARCIAL_INVALIDO'; END IF;
  IF p_fecha IS NULL OR p_fecha<=r.fecha_pago THEN RAISE EXCEPTION 'FECHA_POSTERIOR_REQUERIDA'; END IF;
  v_usd:=round(r.monto_usd*p_monto/r.monto,2); v_cuenta:=round(r.monto_cuenta*p_monto/r.monto,2);
  IF v_usd<=0 OR v_cuenta<=0 OR v_usd>=r.monto_usd OR v_cuenta>=r.monto_cuenta THEN RAISE EXCEPTION 'MONTO_PARCIAL_INVALIDO'; END IF;
  UPDATE public.programacion_pagos SET monto=p_monto,monto_usd=v_usd,monto_cuenta=v_cuenta,actualizado_en=now() WHERE id=r.id;
  INSERT INTO public.programacion_pagos(decision_id,factura_id,cuenta_pago,moneda,monto,monto_usd,monto_cuenta,fecha_pago,estado) VALUES(r.decision_id,r.factura_id,r.cuenta_pago,r.moneda,r.monto-p_monto,r.monto_usd-v_usd,r.monto_cuenta-v_cuenta,p_fecha,'pospuesto');
  v_evento:='pago_parcial';
 ELSIF p_accion='postergar' THEN
  IF r.estado<>'programado' THEN RAISE EXCEPTION 'PROGRAMACION_DESACTUALIZADA'; END IF;
  IF p_fecha IS NULL OR p_fecha<=r.fecha_pago THEN RAISE EXCEPTION 'FECHA_POSTERIOR_REQUERIDA'; END IF;
  UPDATE public.programacion_pagos SET fecha_pago=p_fecha,estado='pospuesto',actualizado_en=now() WHERE id=r.id;
  v_evento:='pago_postergado';
 ELSE
  IF r.estado<>'pospuesto' THEN RAISE EXCEPTION 'PROGRAMACION_DESACTUALIZADA'; END IF;
  p_fecha:=(now() AT TIME ZONE 'America/Guatemala')::date;
  p_fecha:=p_fecha+CASE WHEN extract(isodow FROM p_fecha)::int<5 THEN 5-extract(isodow FROM p_fecha)::int ELSE 12-extract(isodow FROM p_fecha)::int END;
  UPDATE public.programacion_pagos SET fecha_pago=p_fecha,estado='programado',actualizado_en=now() WHERE id=r.id;
  v_evento:='pago_reprogramado';
 END IF;
 INSERT INTO public.registro_eventos(evento,actor,factura_id,detalle) VALUES(v_evento,p_actor,f.id,format('%s · %s: %s. Monto original %s %s; monto programado %s %s; fecha anterior %s; nueva fecha/saldo %s. %s',coalesce(f.codigo,f.numero),v_evento,d.cuenta_pago,r.moneda,v_original,r.moneda,CASE WHEN p_accion='parcial' THEN p_monto ELSE v_original END,to_char(v_fecha_original,'DD/MM/YYYY'),to_char(p_fecha,'DD/MM/YYYY'),trim(p_comentario)));
END $$;
REVOKE ALL ON FUNCTION public.accion_tesoreria(uuid,uuid,text,numeric,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accion_tesoreria(uuid,uuid,text,numeric,date,text,text) TO anon, authenticated, service_role;
