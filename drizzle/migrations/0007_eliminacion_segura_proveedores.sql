CREATE OR REPLACE FUNCTION public.normalizar_nombre_proveedor(valor text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT trim(regexp_replace(regexp_replace(translate(lower(coalesce(valor, '')), 'áéíóúüñàèìòùâêîôûäëïöãõç', 'aeiouunaeiouaeiouaeioaoc'), '[.,]', ' ', 'g'), '[[:space:]]+', ' ', 'g')); $$;
CREATE OR REPLACE FUNCTION public.historial_proveedor(p_id text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT jsonb_build_object('facturas', (SELECT count(*) FROM public.facturas f WHERE public.normalizar_nombre_proveedor(f.emisor) = public.normalizar_nombre_proveedor(p.nombre) OR EXISTS (SELECT 1 FROM public.decisiones d WHERE d.factura_id = f.id AND d.proveedor_id = p.id)), 'decisiones', (SELECT count(*) FROM public.decisiones d WHERE d.proveedor_id = p.id), 'pagos', (SELECT count(*) FROM public.pagos_previos pp WHERE pp.proveedor_id = p.id), 'contratos', (SELECT count(*) FROM public.contratos c WHERE c.proveedor_id = p.id)) FROM public.proveedores p WHERE p.id = p_id; $$;
REVOKE ALL ON FUNCTION public.historial_proveedor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.historial_proveedor(text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.proteger_historial_proveedor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h jsonb;
BEGIN
 h := public.historial_proveedor(OLD.id);
 IF (h->>'facturas')::int > 0 OR (h->>'decisiones')::int > 0 OR (h->>'pagos')::int > 0 THEN
 RAISE EXCEPTION 'PROVEEDOR_CON_HISTORIAL: no se puede eliminar; puedes desactivarlo.';
 END IF;
 RETURN OLD;
END; $$;
CREATE TRIGGER proteger_historial_proveedor BEFORE DELETE ON public.proveedores FOR EACH ROW EXECUTE FUNCTION public.proteger_historial_proveedor();
ALTER TABLE public.registro_eventos DROP CONSTRAINT registro_eventos_evento_check;
ALTER TABLE public.registro_eventos ADD CONSTRAINT registro_eventos_evento_check CHECK (evento IN ('recibida','extraida','decidida','aprobada','rechazada','corregida','politica_modificada','proveedor_modificado','proveedor_eliminado'));
CREATE OR REPLACE FUNCTION public.gestionar_baja_proveedor(p_id text, p_actor text, p_accion text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.proveedores%ROWTYPE; h jsonb;
BEGIN
 IF p_actor NOT IN ('Luis Samayoa (Finanzas)', 'Ana Morales (Contabilidad)') OR p_actor IS NULL THEN RAISE EXCEPTION 'USUARIO_REQUERIDO'; END IF;
 IF p_accion NOT IN ('eliminar', 'desactivar') OR p_accion IS NULL THEN RAISE EXCEPTION 'ACCION_INVALIDA'; END IF;
 LOCK TABLE public.facturas, public.decisiones, public.pagos_previos, public.contratos IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO p FROM public.proveedores WHERE id = p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROVEEDOR_NO_ENCONTRADO'; END IF;
 h := public.historial_proveedor(p_id);
 IF p_accion = 'desactivar' THEN
 UPDATE public.proveedores SET activo = false WHERE id = p_id;
 INSERT INTO public.registro_eventos(evento,actor,detalle) VALUES ('proveedor_modificado', p_actor, format('Desactivación del proveedor %s (%s). Historial: %s facturas, %s decisiones, %s pagos previos.', p.nombre, p.id, h->>'facturas', h->>'decisiones', h->>'pagos'));
 ELSE
 IF (h->>'facturas')::int > 0 OR (h->>'decisiones')::int > 0 OR (h->>'pagos')::int > 0 THEN RAISE EXCEPTION 'PROVEEDOR_CON_HISTORIAL'; END IF;
 DELETE FROM public.contratos WHERE proveedor_id = p_id;
 DELETE FROM public.proveedores WHERE id = p_id;
 INSERT INTO public.registro_eventos(evento,actor,detalle) VALUES ('proveedor_eliminado', p_actor, format('Eliminación del proveedor %s (%s). Contratos o cotizaciones eliminados: %s.', p.nombre, p.id, h->>'contratos'));
 END IF;
 RETURN p_accion;
END; $$;
REVOKE ALL ON FUNCTION public.gestionar_baja_proveedor(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestionar_baja_proveedor(text,text,text) TO anon, authenticated, service_role;