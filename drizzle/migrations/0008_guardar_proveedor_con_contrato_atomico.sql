GRANT SELECT, INSERT, UPDATE ON public.contratos TO anon, authenticated;
GRANT ALL ON public.contratos TO service_role;
CREATE POLICY "demo alta" ON public.contratos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo edicion" ON public.contratos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.guardar_proveedor(p_proveedor jsonb, p_contrato jsonb, p_nuevo boolean, p_actor text) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.proveedores%ROWTYPE; c public.contratos%ROWTYPE; v_id text;
BEGIN
 IF p_actor IS NULL OR p_actor NOT IN ('Luis Samayoa (Finanzas)', 'Ana Morales (Contabilidad)') THEN RAISE EXCEPTION 'USUARIO_REQUERIDO'; END IF;
 IF p_nuevo IS NULL THEN RAISE EXCEPTION 'ACCION_INVALIDA'; END IF;
 p := jsonb_populate_record(NULL::public.proveedores, p_proveedor);
 IF coalesce(trim(p.nombre),'')='' THEN RAISE EXCEPTION 'NOMBRE_REQUERIDO'; END IF;
 IF p_contrato IS NOT NULL THEN
 c := jsonb_populate_record(NULL::public.contratos, p_contrato);
 IF c.tipo IS NULL OR c.tipo NOT IN ('mensual','unica') OR c.monto IS NULL OR c.monto<=0 THEN RAISE EXCEPTION 'CONTRATO_INVALIDO'; END IF;
 END IF;
 IF p_nuevo THEN
 INSERT INTO public.proveedores(id,nombre,pais,tipo,categoria,moneda_factura,cuenta_pago,permite_conversion,banco_beneficiario,cuenta_beneficiario,expediente_completo,activo)
 VALUES(p.id,trim(p.nombre),p.pais,p.tipo,p.categoria,p.moneda_factura,p.cuenta_pago,p.permite_conversion,p.banco_beneficiario,p.cuenta_beneficiario,p.expediente_completo,p.activo);
 ELSE
 UPDATE public.proveedores SET nombre=trim(p.nombre),pais=p.pais,tipo=p.tipo,categoria=p.categoria,moneda_factura=p.moneda_factura,cuenta_pago=p.cuenta_pago,permite_conversion=p.permite_conversion,banco_beneficiario=p.banco_beneficiario,cuenta_beneficiario=p.cuenta_beneficiario,expediente_completo=p.expediente_completo,activo=p.activo WHERE id=p.id RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'PROVEEDOR_NO_ENCONTRADO'; END IF;
 END IF;
 IF p_contrato IS NOT NULL THEN
 IF coalesce(c.id,'')='' THEN
 INSERT INTO public.contratos(id,proveedor_id,concepto,tipo,monto,moneda) VALUES('CT-'||p.id,p.id,c.concepto,c.tipo,c.monto,c.moneda);
 ELSE
 UPDATE public.contratos SET concepto=c.concepto,tipo=c.tipo,monto=c.monto,moneda=c.moneda WHERE id=c.id AND proveedor_id=p.id RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'CONTRATO_NO_ENCONTRADO'; END IF;
 END IF;
 END IF;
 INSERT INTO public.registro_eventos(evento,actor,detalle) VALUES('proveedor_modificado',p_actor,format('%s del proveedor %s (%s). %s',CASE WHEN p_nuevo THEN 'Alta' ELSE 'Edición' END,trim(p.nombre),p.id,CASE WHEN p_contrato IS NULL THEN 'Sin cambios en contratos.' ELSE format('Contrato/cotización: %s %s, %s.',c.moneda,c.monto,c.tipo) END));
 RETURN p.id;
END; $$;
REVOKE ALL ON FUNCTION public.guardar_proveedor(jsonb,jsonb,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_proveedor(jsonb,jsonb,boolean,text) TO anon, authenticated, service_role;