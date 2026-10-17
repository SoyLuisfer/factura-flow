CREATE OR REPLACE FUNCTION public.bloquear_cambios_registro()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.permitir_reinicio', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'registro_eventos es de solo anexado';
END;
$$;

CREATE OR REPLACE FUNCTION public.reiniciar_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.permitir_reinicio', 'on', true);
  DELETE FROM public.registro_eventos WHERE true;
  DELETE FROM public.decisiones WHERE true;
  DELETE FROM public.facturas WHERE true;
  DELETE FROM public.pagos_previos WHERE true;
  DELETE FROM public.contratos WHERE true;
  DELETE FROM public.proveedores WHERE true;
  DELETE FROM public.politicas WHERE true;
  DELETE FROM public.tipos_cambio WHERE true;
  DELETE FROM public.cuentas_bancarias WHERE true;
  DELETE FROM public.empresa WHERE true;
  PERFORM public.cargar_datos_maestros();
END;
$$;