-- Transactional regression against the 18 demo cases; every change is rolled back.
BEGIN;
DO $$
DECLARE ids uuid[]; lote text; d public.decisiones%ROWTYPE; antes jsonb; eventos integer;
BEGIN
 SELECT array_agg(f.id ORDER BY f.id) INTO ids FROM public.facturas f WHERE f.codigo IN ('F01','F02');
 IF cardinality(ids)<>2 THEN RAISE EXCEPTION 'Requires 18 demo cases'; END IF;
 SELECT * INTO d FROM public.decisiones WHERE factura_id=ids[1] ORDER BY decidido_en DESC LIMIT 1;
 antes:=to_jsonb(d);
 BEGIN
  PERFORM public.liberar_fondos('BANK-USD','2026-10-23',ids,5200,'Agente (automático)','Prueba');
  RAISE EXCEPTION 'Agent release allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%USUARIO_REQUERIDO%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.liberar_fondos('BANK-USD','2026-10-23',ids,5200,'Luis Samayoa (Finanzas)',' ');
  RAISE EXCEPTION 'Empty comment allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%COMENTARIO_REQUERIDO%' THEN RAISE; END IF; END;
 UPDATE public.cuentas_bancarias SET saldo_disponible=100 WHERE id='BANK-USD';
 BEGIN
  PERFORM public.liberar_fondos('BANK-USD','2026-10-23',ids,5200,'Luis Samayoa (Finanzas)','Prueba');
  RAISE EXCEPTION 'Insufficient balance allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%SALDO_INSUFICIENTE%' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.lotes_pago WHERE cuenta='BANK-USD') THEN RAISE EXCEPTION 'Failed release left a batch'; END IF;
 UPDATE public.cuentas_bancarias SET saldo_disponible=120000 WHERE id='BANK-USD';
 lote:=public.liberar_fondos('BANK-USD','2026-10-23',ids,5200,'Luis Samayoa (Finanzas)','Prueba');
 IF (SELECT saldo_disponible FROM public.cuentas_bancarias WHERE id='BANK-USD')<>114800 THEN RAISE EXCEPTION 'Balance must be 114800'; END IF;
 IF (SELECT count(*) FROM public.lotes_pago_facturas WHERE lote_id=lote)<>2 THEN RAISE EXCEPTION 'Two invoices required'; END IF;
 SELECT count(*) INTO eventos FROM public.registro_eventos WHERE evento='fondos_liberados' AND detalle LIKE lote||'%';
 IF eventos<>2 THEN RAISE EXCEPTION 'Audit event missing on each invoice'; END IF;
 BEGIN
  PERFORM public.liberar_fondos('BANK-USD','2026-10-23',ids,5200,'Luis Samayoa (Finanzas)','Repetido');
  RAISE EXCEPTION 'Duplicate release allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%LOTE_DESACTUALIZADO%' THEN RAISE; END IF; END;
 IF (SELECT saldo_disponible FROM public.cuentas_bancarias WHERE id='BANK-USD')<>114800 THEN RAISE EXCEPTION 'Balance debited twice'; END IF;
 BEGIN
  INSERT INTO public.lotes_pago_facturas(factura_id,lote_id) VALUES(ids[1],lote);
  RAISE EXCEPTION 'Duplicate invoice membership allowed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  PERFORM public.accion_tesoreria(d.id,(SELECT id FROM public.programacion_pagos WHERE decision_id=d.id LIMIT 1),'postergar',NULL,'2026-10-30','Luis Samayoa (Finanzas)','Prueba');
  RAISE EXCEPTION 'Released schedule editable';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%FONDOS_YA_LIBERADOS%' THEN RAISE; END IF; END;
 IF antes IS DISTINCT FROM (SELECT to_jsonb(x) FROM public.decisiones x WHERE id=d.id) THEN RAISE EXCEPTION 'Decision/trace altered'; END IF;
 BEGIN
  DELETE FROM public.registro_eventos WHERE evento='fondos_liberados';
  RAISE EXCEPTION 'Audit deletion allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%solo anexado%' THEN RAISE; END IF; END;
 PERFORM public.reiniciar_demo();
 IF EXISTS(SELECT 1 FROM public.lotes_pago) OR EXISTS(SELECT 1 FROM public.lotes_pago_facturas) OR EXISTS(SELECT 1 FROM public.programacion_pagos) THEN RAISE EXCEPTION 'Reset left releases'; END IF;
 IF (SELECT saldo_disponible FROM public.cuentas_bancarias WHERE id='BANK-GTQ')<>150000 OR (SELECT saldo_disponible FROM public.cuentas_bancarias WHERE id='BANK-USD')<>120000 THEN RAISE EXCEPTION 'Reset balances incorrect'; END IF;
END $$;
ROLLBACK;