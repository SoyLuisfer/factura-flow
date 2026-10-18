CREATE OR REPLACE FUNCTION public.cargar_datos_maestros() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO empresa (id, razon_social, pais_constitucion, id_fiscal, direccion, actividad, moneda_reporte) VALUES
  (1,'Pollos Hermanos, S. A.','Guatemala','NIT 0000000-0 (ficticio)','Calzada Demo 10-20, Zona 10, Ciudad de Guatemala (ficticia)','Producción y venta de alimentos','GTQ');
  INSERT INTO cuentas_bancarias VALUES
  ('BANK-USD','Banco Andino Demo','USD','DEMO-USD-0001',120000.0),
  ('BANK-GTQ','Banco del Valle Demo','GTQ','DEMO-GTQ-0002',150000.0);
  INSERT INTO politicas (version, vigente, creada_en, creada_por, parametros) VALUES
  ('v1', true, '2026-10-01T00:00:00Z', 'Dirección Financiera',
    '{"receptor_valido":"Pollos Hermanos, S. A.","campos_obligatorios":["tipo_documento","emisor","receptor","numero","fecha_emision","descripcion","monto","moneda"],"tipos_documento_validos":["factura","cuenta de cobro","invoice"],"tope_por_pago_usd":25000.0,"tolerancia_contrato_pct":1.0,"postergacion_automatica_max_usd":5000.0,"calendario_pagos":{"dia_corte":"martes","dia_pago":"viernes"},"presupuesto_por_categoria_usd":{"Contratistas":25000.0,"Software y hosting":1500.0,"Servicios profesionales":3000.0,"Marketing":4000.0,"Proyectos":40000.0,"Oficina":1200.0},"umbral_confianza_extraccion":0.7}'::jsonb);
  INSERT INTO tipos_cambio (moneda, por_usd, vigente_desde, vigente_hasta) VALUES
  ('USD',1.0,'2026-10-01','2026-10-31'),('GTQ',7.7,'2026-10-01','2026-10-31');
  INSERT INTO proveedores (id,nombre,pais,tipo,categoria,moneda_factura,cuenta_pago,permite_conversion,banco_beneficiario,cuenta_beneficiario,expediente_completo,activo,tipo_relacion) VALUES
  ('V001','Estudio Ceiba Diseño, S.A.','Guatemala','Agencia','Marketing','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-4521',true,true,'cotizacion'),
  ('V002','María José Castillo','Colombia','Contratista','Contratistas','USD','BANK-USD',false,'Banco Cafetero Demo','DEMO-CO-220-7781',true,true,'recurrente'),
  ('V003','Carlos Méndez','México','Contratista','Contratistas','USD','BANK-USD',false,'Banco Azteca Demo','DEMO-MX-330-1209',true,true,'recurrente'),
  ('V004','Lucía Fernández','Argentina','Contratista','Contratistas','USD','BANK-USD',false,'Banco Pampa Demo','DEMO-AR-440-6630',true,true,'recurrente'),
  ('V005','Quetzal Cloud Hosting S.A.S.','Colombia','Proveedor','Software y hosting','USD','BANK-GTQ',true,'Banco Cafetero Demo','DEMO-CO-220-9902',true,true,'recurrente'),
  ('V006','Morales & Asociados, Contadores','Guatemala','Proveedor','Servicios profesionales','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-3378',true,true,'recurrente'),
  ('V007','Ríos Abogados, S.C.','México','Proveedor','Servicios profesionales','USD','BANK-GTQ',false,'Banco Azteca Demo','DEMO-MX-330-5544',true,true,'cotizacion'),
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
  ('CT-V005','V005','Hosting y servidores','mensual',300.0,'USD','vigente',NULL),
  ('CT-V006','V006','Servicios contables mensuales','mensual',6500.0,'GTQ','vigente',NULL),
  ('COT-V001-014','V001','Campaña de lanzamiento Q4','unica',46200.0,'GTQ','vigente',NULL),
  ('COT-V007-003','V007','Revisión de contratos de contratistas','unica',1500.0,'USD','vigente',NULL),
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
  ('PAG-0420','V005','QC-2026-09',300.0,'USD',300.0,'Software y hosting','2026-10-02','BANK-GTQ','Luis Samayoa (manual)'),
  ('PAG-0421','V014','BS-1009',240.0,'USD',240.0,'Software y hosting','2026-10-09','BANK-USD','Luis Samayoa (manual)'),
  ('PAG-0425','V001','ED-0088',11550.0,'GTQ',1500.0,'Marketing','2026-10-09','BANK-GTQ','Luis Samayoa (manual)'),
  ('PAG-0430','V006','A-2231',6500.0,'GTQ',844.16,'Servicios profesionales','2026-10-09','BANK-GTQ','Luis Samayoa (manual)'),
  ('PAG-0434','V012','SC-0917',3850.0,'GTQ',500.0,'Oficina','2026-10-02','BANK-GTQ','Luis Samayoa (manual)');
END $$;
