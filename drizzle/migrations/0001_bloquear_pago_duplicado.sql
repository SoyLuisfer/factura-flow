CREATE OR REPLACE FUNCTION public.bloquear_pago_duplicado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero text;
  v_otra uuid;
BEGIN
  IF NEW.decision <> 'PAGAR' OR NEW.proveedor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT f.numero INTO v_numero FROM public.facturas f WHERE f.id = NEW.factura_id;
  IF v_numero IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.id INTO v_otra
  FROM public.decisiones d
  JOIN public.facturas f2 ON f2.id = d.factura_id
  WHERE d.decision = 'PAGAR'
    AND d.proveedor_id = NEW.proveedor_id
    AND f2.numero = v_numero
    AND d.id <> NEW.id
  LIMIT 1;

  IF v_otra IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe una decisión PAGAR para el proveedor % y la factura número % (decisión %). No se puede pagar dos veces la misma factura.',
      NEW.proveedor_id, v_numero, v_otra;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER decisiones_bloquear_pago_duplicado
BEFORE INSERT OR UPDATE ON public.decisiones
FOR EACH ROW EXECUTE FUNCTION public.bloquear_pago_duplicado();