-- Transactional regression, uses existing demo F01 and rolls back every change.
BEGIN;
DO $$
DECLARE d public.decisiones%ROWTYPE; original jsonb; r uuid; total numeric;
BEGIN
 SELECT x.* INTO d FROM public.decisiones x JOIN public.facturas f ON f.id=x.factura_id WHERE f.codigo='F01' ORDER BY x.decidido_en DESC LIMIT 1;
 original:=to_jsonb(d);
 DELETE FROM public.programacion_pagos WHERE decision_id=d.id;
 BEGIN
  PERFORM public.accion_tesoreria(d.id,NULL,'parcial',2800,'2026-10-30','Luis Samayoa (Finanzas)','Prueba');
  RAISE EXCEPTION 'Expected invalid amount';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%MONTO_PARCIAL_INVALIDO%' THEN RAISE; END IF; END;
 PERFORM public.accion_tesoreria(d.id,NULL,'parcial',1000,'2026-10-30','Luis Samayoa (Finanzas)','Prueba');
 SELECT sum(monto) INTO total FROM public.programacion_pagos WHERE decision_id=d.id;
 IF total<>2800 THEN RAISE EXCEPTION 'Total increased or lost'; END IF;
 SELECT sum(monto_cuenta) INTO total FROM public.programacion_pagos WHERE decision_id=d.id AND estado='programado';
 IF total<>1000 THEN RAISE EXCEPTION 'Partial cash not 1000'; END IF;
 SELECT id INTO r FROM public.programacion_pagos WHERE decision_id=d.id AND estado='pospuesto';
 PERFORM public.accion_tesoreria(d.id,r,'reprogramar',NULL,NULL,'Ana Morales (Contabilidad)','Prueba');
 SELECT sum(monto_cuenta) INTO total FROM public.programacion_pagos WHERE decision_id=d.id AND estado='programado';
 IF total<>2800 THEN RAISE EXCEPTION 'Reschedule not restored'; END IF;
 PERFORM public.accion_tesoreria(d.id,r,'postergar',NULL,'2026-11-06','Luis Samayoa (Finanzas)','Prueba');
 SELECT sum(monto_cuenta) INTO total FROM public.programacion_pagos WHERE decision_id=d.id AND estado='programado';
 IF total<>1000 THEN RAISE EXCEPTION 'Deferred cash still reserved'; END IF;
 IF original<>(SELECT to_jsonb(x) FROM public.decisiones x WHERE id=d.id) THEN RAISE EXCEPTION 'Agent decision or trace changed'; END IF;
END $$;
ROLLBACK;