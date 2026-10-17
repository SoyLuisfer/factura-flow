CREATE OR REPLACE FUNCTION public.reiniciar_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.registro_eventos WHERE true;
  DELETE FROM public.decisiones WHERE true;
  DELETE FROM public.facturas WHERE true;
  PERFORM public.cargar_datos_maestros();
END;
$$;