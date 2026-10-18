-- Atomic ingestion rollback regression. No permanent writes.
BEGIN;
DO $$
DECLARE v_prueba uuid := gen_random_uuid(); v_total bigint;
BEGIN
 SELECT count(*) INTO v_total FROM public.facturas;
 BEGIN
  PERFORM public.guardar_factura_procesada(
   jsonb_build_object('prueba_flujo_id',v_prueba,'canal','correo','emisor','Prueba atómica','fecha_recepcion','2026-10-19T12:00:00-06:00'),
   jsonb_build_object('decision','ESCALAR','estado','pendiente_aprobacion','motivo','Prueba','controles','[]'::jsonb,'decidido_por','Agente (automático)'),
   '[{"evento":"evento_invalido","actor":"Agente (automático)"}]'::jsonb,NULL);
  RAISE EXCEPTION 'Invalid event unexpectedly committed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.facturas) <> v_total THEN RAISE EXCEPTION 'Failed ingestion left an orphan'; END IF;
 IF EXISTS(SELECT 1 FROM public.facturas WHERE prueba_flujo_id=v_prueba) THEN RAISE EXCEPTION 'Failed ingestion left temporary data'; END IF;
END $$;
ROLLBACK;