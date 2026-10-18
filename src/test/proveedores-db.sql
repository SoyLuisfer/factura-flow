-- Transactional regression: all test records and events roll back at the end.
DO $$
DECLARE v_id text; n integer;
BEGIN
 BEGIN
  BEGIN
   PERFORM public.guardar_proveedor('{"id":"VTEST_ATOMICO","nombre":"Prueba atómica","pais":"Guatemala","tipo":"proveedor","categoria":"Contratistas","moneda_factura":"GTQ","cuenta_pago":"BANK-GTQ","permite_conversion":false,"expediente_completo":false,"activo":true}'::jsonb, '{"id":"","concepto":"Prueba","tipo":"contrato","monto":10000,"moneda":"GTQ"}'::jsonb, true, 'Luis Samayoa (Finanzas)');
   RAISE EXCEPTION 'TEST_FAILED: invalid contract accepted';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'CONTRATO_INVALIDO' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO n FROM public.proveedores WHERE id='VTEST_ATOMICO';
  IF n<>0 THEN RAISE EXCEPTION 'TEST_FAILED: partial supplier persisted'; END IF;
  v_id := public.guardar_proveedor('{"id":"VTEST_ATOMICO","nombre":"Prueba atómica","pais":"Guatemala","tipo":"proveedor","categoria":"Contratistas","moneda_factura":"GTQ","cuenta_pago":"BANK-GTQ","permite_conversion":false,"expediente_completo":false,"activo":true}'::jsonb, '{"id":"","concepto":"Prueba","tipo":"mensual","monto":10000,"moneda":"GTQ"}'::jsonb, true, 'Luis Samayoa (Finanzas)');
  IF NOT EXISTS (SELECT 1 FROM public.contratos WHERE proveedor_id=v_id AND monto=10000 AND moneda='GTQ' AND tipo='mensual') THEN RAISE EXCEPTION 'TEST_FAILED: contract not stored'; END IF;
  INSERT INTO public.facturas(codigo,emisor,numero) VALUES('TEST_ATOMICO','Prueba atomica','TEST_ATOMICO');
  BEGIN
   PERFORM public.gestionar_baja_proveedor(v_id,'Ana Morales (Contabilidad)','eliminar');
   RAISE EXCEPTION 'TEST_FAILED: historical supplier deleted';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'PROVEEDOR_CON_HISTORIAL' THEN RAISE; END IF;
  END;
  PERFORM public.gestionar_baja_proveedor(v_id,'Ana Morales (Contabilidad)','desactivar');
  IF NOT EXISTS (SELECT 1 FROM public.proveedores WHERE id=v_id AND activo=false) THEN RAISE EXCEPTION 'TEST_FAILED: not deactivated'; END IF;
  BEGIN
   UPDATE public.registro_eventos SET detalle='tampered' WHERE detalle LIKE '%VTEST_ATOMICO%';
   RAISE EXCEPTION 'TEST_FAILED: audit modified';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'registro_eventos es de solo anexado' THEN RAISE; END IF;
  END;
  BEGIN
   DELETE FROM public.registro_eventos WHERE detalle LIKE '%VTEST_ATOMICO%';
   RAISE EXCEPTION 'TEST_FAILED: audit deleted';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'registro_eventos es de solo anexado' THEN RAISE; END IF;
  END;
  RAISE EXCEPTION 'TEST_ROLLBACK_SUCCESS';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'TEST_ROLLBACK_SUCCESS' THEN RAISE; END IF;
 END;
END $$;