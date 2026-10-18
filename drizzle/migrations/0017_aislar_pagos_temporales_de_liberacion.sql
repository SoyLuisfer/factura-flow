DO $$ DECLARE cuerpo text; BEGIN
 SELECT pg_get_functiondef('public.liberar_fondos(text,date,uuid[],numeric,text,text)'::regprocedure) INTO cuerpo;
 cuerpo:=replace(cuerpo, 'WHERE x.cuenta_pago=p_cuenta', 'WHERE EXISTS (SELECT 1 FROM public.facturas real_f WHERE real_f.id=x.factura_id AND real_f.prueba_flujo_id IS NULL) AND x.cuenta_pago=p_cuenta');
 cuerpo:=replace(cuerpo, 'WHERE p.cuenta_pago=p_cuenta', 'WHERE EXISTS (SELECT 1 FROM public.facturas real_f WHERE real_f.id=p.factura_id AND real_f.prueba_flujo_id IS NULL) AND p.cuenta_pago=p_cuenta');
 EXECUTE cuerpo;
END $$;