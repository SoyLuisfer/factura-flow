
CREATE TABLE public.empresa (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  razon_social text NOT NULL, pais_constitucion text NOT NULL, id_fiscal text NOT NULL,
  direccion text NOT NULL, actividad text, moneda_reporte text NOT NULL DEFAULT 'USD'
);
CREATE TABLE public.cuentas_bancarias (
  id text PRIMARY KEY, banco text NOT NULL, moneda text NOT NULL, numero text NOT NULL,
  saldo_disponible numeric(14,2) NOT NULL DEFAULT 0
);
CREATE TABLE public.politicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version text NOT NULL UNIQUE,
  vigente boolean NOT NULL DEFAULT false, creada_en timestamptz NOT NULL DEFAULT now(),
  creada_por text NOT NULL, parametros jsonb NOT NULL
);
CREATE UNIQUE INDEX politicas_una_vigente ON public.politicas (vigente) WHERE vigente;
CREATE TABLE public.tipos_cambio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), moneda text NOT NULL, por_usd numeric(14,4) NOT NULL,
  vigente_desde date NOT NULL, vigente_hasta date NOT NULL
);
CREATE TABLE public.proveedores (
  id text PRIMARY KEY, nombre text NOT NULL, pais text NOT NULL, tipo text NOT NULL, categoria text NOT NULL,
  moneda_factura text NOT NULL, cuenta_pago text NOT NULL REFERENCES public.cuentas_bancarias(id),
  permite_conversion boolean NOT NULL DEFAULT false, banco_beneficiario text, cuenta_beneficiario text,
  expediente_completo boolean NOT NULL DEFAULT false, activo boolean NOT NULL DEFAULT true
);
CREATE TABLE public.contratos (
  id text PRIMARY KEY, proveedor_id text NOT NULL REFERENCES public.proveedores(id), concepto text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('mensual','unica')), monto numeric(16,2) NOT NULL, moneda text NOT NULL
);
CREATE TABLE public.pagos_previos (
  id text PRIMARY KEY, proveedor_id text NOT NULL REFERENCES public.proveedores(id), factura text NOT NULL,
  monto numeric(16,2) NOT NULL, moneda text NOT NULL, monto_usd numeric(14,2) NOT NULL, categoria text NOT NULL,
  fecha_pago date NOT NULL, cuenta text NOT NULL REFERENCES public.cuentas_bancarias(id), decidido_por text NOT NULL
);
CREATE TABLE public.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), codigo text, archivo_url text, nombre_archivo text,
  canal text CHECK (canal IN ('correo','whatsapp','slack','otro')), fecha_recepcion timestamptz DEFAULT now(),
  tipo_documento text, emisor text, receptor text, numero text, fecha_emision date, fecha_vencimiento date,
  descripcion text, monto numeric(16,2), moneda text, pago_banco text, pago_cuenta text,
  confianza_extraccion numeric(4,3) CHECK (confianza_extraccion BETWEEN 0 AND 1),
  texto_original text, creada_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.decisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('PAGAR','FRENAR','ESCALAR','POSTERGAR')),
  estado text NOT NULL CHECK (estado IN ('final','pendiente_aprobacion','aprobada_humano','rechazada_humano')),
  decidido_por text NOT NULL, decidido_en timestamptz NOT NULL DEFAULT now(), motivo text NOT NULL,
  controles jsonb NOT NULL DEFAULT '[]'::jsonb, proveedor_id text REFERENCES public.proveedores(id),
  categoria text, monto_usd numeric(14,2), cuenta_pago text, fecha_programada_pago date,
  politica_version text, escalar_a text CHECK (escalar_a IN ('Finanzas','Contabilidad')),
  factura_relacionada_id uuid REFERENCES public.facturas(id) ON DELETE SET NULL,
  aprobador text, aprobado_en timestamptz, comentario_aprobacion text, ajuste jsonb
);
CREATE TABLE public.registro_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fecha_hora timestamptz NOT NULL DEFAULT now(),
  factura_id uuid, evento text NOT NULL CHECK (evento IN ('recibida','extraida','decidida','aprobada','rechazada','politica_modificada','proveedor_modificado')),
  actor text NOT NULL, detalle text
);

-- Principio 4: PAGAR solo con todos los controles OK/NO_APLICA o aprobación humana completa
CREATE OR REPLACE FUNCTION public.validar_decision_pagar() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.decision = 'PAGAR' THEN
    IF NEW.estado = 'aprobada_humano' THEN
      IF coalesce(trim(NEW.aprobador),'') = '' OR NEW.aprobado_en IS NULL OR coalesce(trim(NEW.comentario_aprobacion),'') = '' THEN
        RAISE EXCEPTION 'PAGAR por aprobación humana requiere aprobador, fecha y comentario';
      END IF;
    ELSIF NEW.estado = 'final' THEN
      IF jsonb_typeof(NEW.controles) <> 'array' OR jsonb_array_length(NEW.controles) = 0 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.controles) c WHERE coalesce(c->>'resultado','') NOT IN ('OK','NO_APLICA')
      ) THEN
        RAISE EXCEPTION 'PAGAR automático requiere todos los controles en OK o NO_APLICA';
      END IF;
    ELSE
      RAISE EXCEPTION 'Estado inválido para PAGAR';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validar_pagar BEFORE INSERT OR UPDATE ON public.decisiones FOR EACH ROW EXECUTE FUNCTION public.validar_decision_pagar();

-- Registro append-only
CREATE OR REPLACE FUNCTION public.bloquear_cambios_registro() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('contralor.reinicio', true) = 'on' AND TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'registro_eventos es de solo anexado';
END $$;
CREATE TRIGGER trg_registro_append_only BEFORE UPDATE OR DELETE ON public.registro_eventos FOR EACH ROW EXECUTE FUNCTION public.bloquear_cambios_registro();

-- Grants
GRANT SELECT ON public.empresa, public.cuentas_bancarias, public.tipos_cambio, public.contratos, public.pagos_previos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.politicas, public.proveedores TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.facturas, public.decisiones TO anon, authenticated;
GRANT SELECT, INSERT ON public.registro_eventos TO anon, authenticated;
GRANT ALL ON public.empresa, public.cuentas_bancarias, public.politicas, public.tipos_cambio, public.proveedores, public.contratos, public.pagos_previos, public.facturas, public.decisiones, public.registro_eventos TO service_role;

ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.politicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_cambio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_previos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo lectura" ON public.empresa FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo lectura" ON public.cuentas_bancarias FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo lectura" ON public.tipos_cambio FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo lectura" ON public.contratos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo lectura" ON public.pagos_previos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo lectura" ON public.politicas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo alta" ON public.politicas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo cambio vigencia" ON public.politicas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo lectura" ON public.proveedores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo alta" ON public.proveedores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo edicion" ON public.proveedores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo lectura" ON public.facturas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo alta" ON public.facturas FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo edicion" ON public.facturas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo lectura" ON public.decisiones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo alta" ON public.decisiones FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo edicion" ON public.decisiones FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo lectura" ON public.registro_eventos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo alta" ON public.registro_eventos FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Carga de datos maestros
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
  INSERT INTO proveedores VALUES
  ('V001','Estudio Ceiba Diseño, S.A.','Guatemala','Agencia','Marketing','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-4521',true,true),
  ('V002','María José Castillo','Colombia','Contratista','Contratistas','USD','BANK-USD',false,'Banco Cafetero Demo','DEMO-CO-220-7781',true,true),
  ('V003','Carlos Méndez','México','Contratista','Contratistas','USD','BANK-USD',false,'Banco Azteca Demo','DEMO-MX-330-1209',true,true),
  ('V004','Lucía Fernández','Argentina','Contratista','Contratistas','USD','BANK-USD',false,'Banco Pampa Demo','DEMO-AR-440-6630',true,true),
  ('V005','Quetzal Cloud Hosting S.A.S.','Colombia','Proveedor','Software y hosting','COP','BANK-USD',true,'Banco Cafetero Demo','DEMO-CO-220-9902',true,true),
  ('V006','Morales & Asociados, Contadores','Guatemala','Proveedor','Servicios profesionales','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-3378',true,true),
  ('V007','Ríos Abogados, S.C.','México','Proveedor','Servicios profesionales','MXN','BANK-USD',false,'Banco Azteca Demo','DEMO-MX-330-5544',true,true),
  ('V008','Cóndor Data Labs Inc.','Estados Unidos','Proveedor','Proyectos','USD','BANK-USD',false,'Banco Andino Demo','DEMO-US-550-0087',true,true),
  ('V009','Kevin Ortiz','Guatemala','Contratista','Contratistas','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-8812',true,true),
  ('V010','Licencias Volcán S.A.','Guatemala','Proveedor','Software y hosting','USD','BANK-USD',false,'Banco del Valle Demo','DEMO-GT-USD-110-2290',true,true),
  ('V011','Sofía Herrera','Colombia','Contratista','Contratistas','USD','BANK-USD',false,'Banco Cafetero Demo','DEMO-CO-220-4410',true,true),
  ('V012','Coworking Ceiba Zona 4','Guatemala','Proveedor','Oficina','GTQ','BANK-GTQ',false,'Banco del Valle Demo','DEMO-GT-110-6025',true,true),
  ('V013','Andrés Pérez','México','Contratista','Contratistas','USD','BANK-USD',false,'Banco Azteca Demo','DEMO-MX-330-7718',true,true),
  ('V014','Buzón Seguro Ltda.','Colombia','Proveedor','Software y hosting','USD','BANK-USD',false,'Banco Cafetero Demo','DEMO-CO-220-3150',true,true);
  INSERT INTO contratos VALUES
  ('CT-V002','V002','Desarrollo backend','mensual',3200.0,'USD'),
  ('CT-V003','V003','Desarrollo móvil','mensual',2800.0,'USD'),
  ('CT-V004','V004','QA y pruebas','mensual',2400.0,'USD'),
  ('CT-V005','V005','Hosting y servidores','mensual',1245000.0,'COP'),
  ('CT-V006','V006','Servicios contables mensuales','mensual',6500.0,'GTQ'),
  ('COT-V001-014','V001','Campaña de lanzamiento Q4','unica',46200.0,'GTQ'),
  ('COT-V007-003','V007','Revisión de contratos de contratistas','unica',27750.0,'MXN'),
  ('COT-V008-001','V008','Migración a data warehouse','unica',32000.0,'USD'),
  ('CT-V009','V009','Diseño UI','mensual',9240.0,'GTQ'),
  ('CT-V010','V010','Licencias de software de desarrollo','mensual',480.0,'USD'),
  ('CT-V011','V011','Investigación UX','mensual',2000.0,'USD'),
  ('CT-V012','V012','Membresía de coworking','mensual',3850.0,'GTQ'),
  ('CT-V013','V013','Desarrollo frontend','mensual',2600.0,'USD'),
  ('CT-V014','V014','Correo corporativo','mensual',240.0,'USD');
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

CREATE OR REPLACE FUNCTION public.seed_demo_si_vacio() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM empresa) THEN RETURN false; END IF;
  PERFORM cargar_datos_maestros();
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.reiniciar_demo() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('contralor.reinicio', 'on', true);
  DELETE FROM decisiones; DELETE FROM facturas; DELETE FROM registro_eventos;
  DELETE FROM pagos_previos; DELETE FROM contratos; DELETE FROM proveedores;
  DELETE FROM tipos_cambio; DELETE FROM politicas; DELETE FROM cuentas_bancarias; DELETE FROM empresa;
  PERFORM set_config('contralor.reinicio', 'off', true);
  PERFORM cargar_datos_maestros();
END $$;

REVOKE ALL ON FUNCTION public.cargar_datos_maestros() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_si_vacio() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reiniciar_demo() TO anon, authenticated;

SELECT public.seed_demo_si_vacio();
