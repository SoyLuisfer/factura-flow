ALTER TABLE public.proveedores ADD COLUMN tipo_relacion text NOT NULL DEFAULT 'compra_directa';
ALTER TABLE public.proveedores ADD CONSTRAINT proveedores_tipo_relacion_check CHECK (tipo_relacion IN ('compra_directa','recurrente','cotizacion'));
ALTER TABLE public.contratos ADD COLUMN estado text NOT NULL DEFAULT 'vigente';
ALTER TABLE public.contratos ADD CONSTRAINT contratos_estado_check CHECK (estado IN ('vigente','utilizada'));
ALTER TABLE public.contratos ADD COLUMN factura_id_uso uuid;

UPDATE public.proveedores p SET tipo_relacion = CASE WHEN c.tipo = 'mensual' THEN 'recurrente' WHEN c.tipo = 'unica' THEN 'cotizacion' ELSE 'compra_directa' END FROM public.contratos c WHERE c.proveedor_id = p.id;

ALTER TABLE public.registro_eventos DROP CONSTRAINT registro_eventos_evento_check;
ALTER TABLE public.registro_eventos ADD CONSTRAINT registro_eventos_evento_check CHECK (evento = ANY (ARRAY['recibida','extraida','decidida','aprobada','rechazada','corregida','politica_modificada','proveedor_modificado','proveedor_eliminado','cotizacion_utilizada']));

CREATE OR REPLACE FUNCTION public.cargar_datos_maestros() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO empresa (id, razon_social, pais_constitucion, id_fiscal, direccion, actividad, moneda_reporte) VALUES
  (1,'Andes Labs LLC','Estados Unidos (Delaware)','EIN 00-0000000 (ficticio)','1200 Demo Street, Suite 400, Wilmington, DE 19801, USA','Desarrollo de software','USD');
  INSERT INTO cuentas_bancarias VALUES
  ('BANK-USD','Banco Andino Demo','USD','DEMO-USD-0001',120000.0),
  ('BANK-GTQ','Banco del Valle Demo','GTQ','DEMO-GTQ-0002',150000.0);
  INSERT INTO politicas (version, vigente, creada_en, creada_por, parametros) VALUES
  ('v1', true, '2026-10-01T00:00:00Z', 'Dirección Financiera',
    '{"receptor_valido":"Andes Labs LLC","campos_obligatorios":["tipo_documento","emisor","receptor","numero","fecha_emision","descripcion","monto","moneda"],"tipos_documento_validos":["factura","cuenta de cobro","invoice"],"tope_por_pago_usd":25000.0,"tolerancia_contrato_pct":1.0,"postergacion_automatica_max_usd":5000.0,"calendario_pagos":{"dia_corte":"martes","dia_pago":"viernes"},"presupuesto_por_categoria_usd":{"Contratistas":25000.0,"Software y hosting":1500.0,"Servicios profesionales":3000.0,"Marketing":4000.0,"Proyectos":40000.0,"Oficina":1200.0},"umbral_confianza_extraccion":0.7}'::jsonb);
  INSERT INTO tipos_cambio (moneda, por_usd, vigente_desde, vigente_hasta) VALUES
  ('USD',1.0,'2026-10-01','2026-10-31'),('GTQ',7.7,'2026-10-01','2026-10-31'),
  ('COP',4150.0,'2026-10-01','2026-10-31'),('MXN',18.5,'2026-10-01','2026-10-31');
  INSERT INTO proveedores (id,nombre,pais,tipo,categoria,moneda_factura,cuenta_pago,permite_conversion,banco_beneficiario,cuenta_beneficiario,expediente_completo,activo,tipo_relacion) VALUES
  ('V001','Estudio Ceiba Diseño, S.A.','Guatemala','Agencia','Marketing','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-4521',true,true,'cotizacion'),
  ('V002','María José Castillo','Colombia','Contratista','Contratistas','USD','BANK-USD',false,'Banco Cafetero Demo','DEMO-CO-220-7781',true,true,'recurrente'),
  ('V003','Carlos Méndez','México','Contratista','Contratistas','USD','BANK-USD',false,'Banco Azteca Demo','DEMO-MX-330-1209',true,true,'recurrente'),
  ('V004','Lucía Fernández','Argentina','Contratista','Contratistas','USD','BANK-USD',false,'Banco Pampa Demo','DEMO-AR-440-6630',true,true,'recurrente'),
  ('V005','Quetzal Cloud Hosting S.A.S.','Colombia','Proveedor','Software y hosting','COP','BANK-USD',true,'Banco Cafetero Demo','DEMO-CO-220-9902',true,true,'recurrente'),
  ('V006','Morales & Asociados, Contadores','Guatemala','Proveedor','Servicios profesionales','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-3378',true,true,'recurrente'),
  ('V007','Ríos Abogados, S.C.','México','Proveedor','Servicios profesionales','MXN','BANK-USD',false,'Banco Azteca Demo','DEMO-MX-330-5544',true,true,'cotizacion'),
  ('V008','Cóndor Data Labs Inc.','Estados Unidos','Proveedor','Proyectos','USD','BANK-USD',false,'Banco Andino Demo','DEMO-US-550-0087',true,true,'cotizacion'),
  ('V009','Kevin Ortiz','Guatemala','Contratista','Contratistas','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-8812',true,true,'recurrente'),
  ('V010','Licencias Volcán S.A.','Guatemala','Proveedor','Software y hosting','USD','BANK-USD',false,'Banco del Valle Demo','DEMO-GT-USD-110-2290',true,true,'recurrente'),
  ('V011','Sofía Herrera','Colombia','Contratista','Contratistas','USD','BANK-USD',false,'Banco Cafetero Demo','DEMO-CO-220-4410',true,true,'recurrente'),
  ('V012','Coworking Ceiba Zona 4','Guatemala','Proveedor','Oficina','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-6025',true,true,'recurrente'),
  ('V013','Andrés Pérez','México','Contratista','Contratistas','USD','BANK-USD',false,'Banco Azteca Demo','DEMO-MX-330-7718',true,true,'recurrente'),
  ('V014','Buzón Seguro Ltda.','Colombia','Proveedor','Software y hosting','USD','BANK-USD',false,'Banco Cafetero Demo','DEMO-CO-220-3150',true,true,'recurrente');
  INSERT INTO contratos (id,proveedor_id,concepto,tipo,monto,moneda,estado,factura_id_uso) VALUES
  ('CT-V002','V002','Desarrollo backend','mensual',3200.0,'USD','vigente',NULL),
  ('CT-V003','V003','Desarrollo móvil','mensual',2800.0,'USD','vigente',NULL),
  ('CT-V004','V004','QA y pruebas','mensual',2400.0,'USD','vigente',NULL),
  ('CT-V005','V005','Hosting y servidores','mensual',1245000.0,'COP','vigente',NULL),
  ('CT-V006','V006','Servicios contables mensuales','mensual',6500.0,'GTQ','vigente',NULL),
  ('COT-V001-014','V001','Campaña de lanzamiento Q4','unica',46200.0,'GTQ','vigente',NULL),
  ('COT-V007-003','V007','Revisión de contratos de contratistas','unica',27750.0,'MXN','vigente',NULL),
  ('COT-V008-001','V008','Migración a data warehouse','unica',32000.0,'USD','vigente',NULL),
  ('CT-V009','V009','Diseño UI','mensual',9240.0,'GTQ','vigente',NULL),
  ('CT-V010','V010','Licencias de software de desarrollo','mensual',480.0,'USD','vigente',NULL),
  ('CT-V011','V011','Investigación UX','mensual',2000.0,'USD','vigente',NULL),
  ('CT-V012','V012','Membresía de coworking','mensual',3850.0,'GTQ','vigente',NULL),
  ('CT-V013','V013','Desarrollo frontend','mensual',2600.0,'USD','vigente',NULL),
  ('CT-V014','V014','Correo corporativo','mensual',240.0,'USD','vigente',NULL);
  INSERT INTO pagos_previos VALUES
  ('PAG-0412','V003','CM-2026-09',2800.0,'USD',2800.0,'Contratistas','2026-10-02','BANK-USD','Luis Samayoa (manual)'),
  ('PAG-0413','V002','CC-MJC-009',3200.0,'USD',3200.0,'Contratistas','2026-10-02','BANK-USD','Luis Samayoa (manual)'),
  ('PAG-0414','V004','LF-009',2400.0,'USD',2400.0,'Contratistas','2026-10-02','BANK-USD','Luis Samayoa (manual)'),
  ('PAG-0415','V009','KO-009',9240.0,'GTQ',1200.0,'Contratistas','2026-10-02','BANK-GTQ','Luis Samayoa (manual)'),
  ('PAG-0418','V010','LV-2026-09',480.0,'USD',480.0,'Software y hosting','2026-10-02','BANK-USD','Luis Samayoa (manual)'),
  ('PAG-0420','V005','QC-2026-09',1245000.0,'COP',300.0,'Software y hosting','2026-10-02','BANK-USD','Luis Samayoa (manual)'),
  ('PAG-0421','V014','BS-1009',240.0,'USD',240.0,'Software y hosting','2026-10-09','BANK-USD','Luis Samayoa (manual)'),
  ('PAG-0425','V001','ED-0088',11550.0,'GTQ',1500.0,'Marketing','2026-10-09','BANK-GTQ','Luis Samayoa (manual)'),
  ('PAG-0430','V006','A-2231',6500.0,'GTQ',844.16,'Servicios profesionales','2026-10-09','BANK-GTQ','Luis Samayoa (manual)'),
  ('PAG-0434','V012','SC-0917',3850.0,'GTQ',500.0,'Oficina','2026-10-02','BANK-GTQ','Luis Samayoa (manual)');
END $$;

CREATE OR REPLACE FUNCTION public.guardar_proveedor(p_proveedor jsonb, p_contrato jsonb, p_nuevo boolean, p_actor text) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.proveedores%ROWTYPE; c public.contratos%ROWTYPE; v_id text;
BEGIN
 IF p_actor IS NULL OR p_actor NOT IN ('Luis Samayoa (Finanzas)', 'Ana Morales (Contabilidad)') THEN RAISE EXCEPTION 'USUARIO_REQUERIDO'; END IF;
 IF p_nuevo IS NULL THEN RAISE EXCEPTION 'ACCION_INVALIDA'; END IF;
 p := jsonb_populate_record(NULL::public.proveedores, p_proveedor);
 IF coalesce(trim(p.nombre),'')='' THEN RAISE EXCEPTION 'NOMBRE_REQUERIDO'; END IF;
 IF p.tipo_relacion IS NULL OR p.tipo_relacion NOT IN ('compra_directa','recurrente','cotizacion') THEN RAISE EXCEPTION 'TIPO_RELACION_INVALIDO'; END IF;
 IF p.tipo_relacion = 'compra_directa' THEN p_contrato := NULL; END IF;
 IF p.tipo_relacion <> 'compra_directa' AND p_contrato IS NULL THEN RAISE EXCEPTION 'CONTRATO_REQUERIDO'; END IF;
 IF p_contrato IS NOT NULL THEN
   c := jsonb_populate_record(NULL::public.contratos, p_contrato);
   IF c.tipo IS NULL OR c.tipo NOT IN ('mensual','unica') OR c.monto IS NULL OR c.monto<=0 THEN RAISE EXCEPTION 'CONTRATO_INVALIDO'; END IF;
   IF (p.tipo_relacion = 'recurrente' AND c.tipo <> 'mensual') OR (p.tipo_relacion = 'cotizacion' AND c.tipo <> 'unica') THEN RAISE EXCEPTION 'CONTRATO_INVALIDO'; END IF;
 END IF;
 IF p_nuevo THEN
   INSERT INTO public.proveedores(id,nombre,pais,tipo,categoria,moneda_factura,cuenta_pago,permite_conversion,banco_beneficiario,cuenta_beneficiario,expediente_completo,activo,tipo_relacion)
   VALUES(p.id,trim(p.nombre),p.pais,p.tipo,p.categoria,p.moneda_factura,p.cuenta_pago,p.permite_conversion,p.banco_beneficiario,p.cuenta_beneficiario,p.expediente_completo,p.activo,p.tipo_relacion);
 ELSE
   UPDATE public.proveedores SET nombre=trim(p.nombre),pais=p.pais,tipo=p.tipo,categoria=p.categoria,moneda_factura=p.moneda_factura,cuenta_pago=p.cuenta_pago,permite_conversion=p.permite_conversion,banco_beneficiario=p.banco_beneficiario,cuenta_beneficiario=p.cuenta_beneficiario,expediente_completo=p.expediente_completo,activo=p.activo,tipo_relacion=p.tipo_relacion WHERE id=p.id RETURNING id INTO v_id;
   IF v_id IS NULL THEN RAISE EXCEPTION 'PROVEEDOR_NO_ENCONTRADO'; END IF;
 END IF;
 IF p_contrato IS NOT NULL THEN
   IF coalesce(c.id,'')='' THEN
     INSERT INTO public.contratos(id,proveedor_id,concepto,tipo,monto,moneda) VALUES('CT-'||p.id,p.id,c.concepto,c.tipo,c.monto,c.moneda);
   ELSE
     UPDATE public.contratos SET concepto=c.concepto,tipo=c.tipo,monto=c.monto,moneda=c.moneda WHERE id=c.id AND proveedor_id=p.id RETURNING id INTO v_id;
     IF v_id IS NULL THEN RAISE EXCEPTION 'CONTRATO_NO_ENCONTRADO'; END IF;
   END IF;
 ELSIF p.tipo_relacion = 'compra_directa' THEN
   DELETE FROM public.contratos WHERE proveedor_id = p.id AND estado = 'vigente' AND factura_id_uso IS NULL;
 END IF;
 INSERT INTO public.registro_eventos(evento,actor,detalle) VALUES('proveedor_modificado',p_actor,format('%s del proveedor %s (%s). %s',CASE WHEN p_nuevo THEN 'Alta' ELSE 'Edición' END,trim(p.nombre),p.id,CASE WHEN p.tipo_relacion = 'compra_directa' THEN 'Compra directa, sin contrato ni cotización.' ELSE format('Contrato/cotización: %s %s, %s.',c.moneda,c.monto,c.tipo) END));
 RETURN p.id;
END; $$;
REVOKE ALL ON FUNCTION public.guardar_proveedor(jsonb,jsonb,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_proveedor(jsonb,jsonb,boolean,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.marcar_cotizacion_utilizada(p_contrato_id text, p_factura_id uuid, p_actor text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE c public.contratos%ROWTYPE; f public.facturas%ROWTYPE;
BEGIN
 IF p_actor IS NULL OR trim(p_actor) = '' THEN RAISE EXCEPTION 'USUARIO_REQUERIDO'; END IF;
 SELECT * INTO c FROM public.contratos WHERE id = p_contrato_id;
 IF c.id IS NULL THEN RAISE EXCEPTION 'CONTRATO_NO_ENCONTRADO'; END IF;
 IF c.tipo <> 'unica' THEN RAISE EXCEPTION 'NO_ES_COTIZACION'; END IF;
 IF c.estado = 'utilizada' THEN RAISE EXCEPTION 'COTIZACION_YA_UTILIZADA'; END IF;
 SELECT * INTO f FROM public.facturas WHERE id = p_factura_id;
 UPDATE public.contratos SET estado = 'utilizada', factura_id_uso = p_factura_id WHERE id = p_contrato_id;
 INSERT INTO public.registro_eventos(evento, actor, factura_id, detalle) VALUES('cotizacion_utilizada', p_actor, p_factura_id, format('La cotización %s quedó utilizada por la factura %s.', c.id, coalesce(f.codigo, f.numero, p_factura_id::text)));
END; $$;
REVOKE ALL ON FUNCTION public.marcar_cotizacion_utilizada(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_cotizacion_utilizada(text,uuid,text) TO anon, authenticated, service_role;