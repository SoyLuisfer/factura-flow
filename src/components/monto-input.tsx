import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatearMonto, leerMonto } from "@/lib/formato";

export function MontoInput({ value, onValueChange, ...props }: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & { value: string; onValueChange: (value: string) => void }) {
  const [enfocado, setEnfocado] = useState(false);
  const [texto, setTexto] = useState(value);
  useEffect(() => { if (!enfocado) setTexto(value); }, [value, enfocado]);
  const numero = leerMonto(texto);
  const visible = !enfocado && texto !== "" && Number.isFinite(numero) ? formatearMonto(numero) : texto;
  return <Input {...props} inputMode="decimal" className={`text-right tabular-nums ${props.className ?? ""}`} value={visible}
    onFocus={() => { setEnfocado(true); setTexto(value); }}
    onChange={(e) => { setTexto(e.target.value); onValueChange(e.target.value.replace(/,/g, "")); }}
    onBlur={() => { setEnfocado(false); if (texto.trim() && Number.isFinite(numero)) onValueChange(String(numero)); }} />;
}