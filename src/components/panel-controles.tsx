import { useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import type { Control, ResultadoControl } from "@/lib/motorReglas";
import { formatearTextoNumerico } from "@/lib/formato";

const ICONO_CONTROL: Record<ResultadoControl, React.ReactNode> = {
  OK: <CheckCircle2 className="h-4 w-4 text-decision-pagar" />,
  FALLA: <XCircle className="h-4 w-4 text-decision-frenar" />,
  NO_APLICA: <MinusCircle className="h-4 w-4 text-control-no-aplica" />,
  NO_EVALUABLE: <AlertTriangle className="h-4 w-4 text-decision-escalar" />,
};

const ETIQUETA_CONTROL: Record<ResultadoControl, string> = {
  OK: "OK",
  FALLA: "FALLA",
  NO_APLICA: "NO APLICA",
  NO_EVALUABLE: "NO EVALUABLE",
};

function FilaControl({ c }: { c: Control }) {
  return (
    <li className="flex gap-2 text-sm">
      <span className="mt-0.5 shrink-0">{ICONO_CONTROL[c.resultado]}</span>
      <div>
        <span className="font-medium">
          {c.regla} {c.control}
        </span>{" "}
        <span className="text-xs text-muted-foreground">({ETIQUETA_CONTROL[c.resultado]})</span>
        <p className="text-xs text-muted-foreground">{formatearTextoNumerico(c.detalle)}</p>
      </div>
    </li>
  );
}

/**
 * "¿Por qué?" simplificado: si todo está OK/NO APLICA muestra solo un recuadro verde;
 * si algo falla o no se puede evaluar, muestra solo esos controles.
 * En ambos casos, "Ver todas las reglas" despliega la lista completa R0–R10.
 */
export function PanelControles({ controles }: { controles: Control[] }) {
  const [verTodas, setVerTodas] = useState(false);
  const fallidos = controles.filter((c) => c.resultado === "FALLA" || c.resultado === "NO_EVALUABLE");

  return (
    <div>
      {fallidos.length === 0 ? (
        <div className="rounded-lg border border-decision-pagar/40 bg-decision-pagar/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-decision-pagar">
            <CheckCircle2 className="h-4 w-4" /> Todos los controles se cumplen
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{controles.length} controles revisados</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {fallidos.map((c) => (
            <FilaControl key={c.regla} c={c} />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setVerTodas((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
      >
        {verTodas ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {verTodas ? "Ocultar todas las reglas" : "Ver todas las reglas"}
      </button>

      {verTodas && (
        <ul className="mt-2 space-y-2 border-t pt-3">
          {controles.map((c) => (
            <FilaControl key={c.regla} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
