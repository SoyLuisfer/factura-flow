/** Una fecha civil no es un instante: no desplazarla de zona horaria. */
export function fechaPura(valor: string | null | undefined): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor ? valor : null;
}

export function diaGuatemala(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (valor.length === 10) return fechaPura(valor);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(valor) || !fechaPura(valor.slice(0, 10))) return null;
  const d = new Date(valor);
  if (!Number.isFinite(d.getTime())) return null;
  const partes = new Intl.DateTimeFormat('en', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
  return fechaPura(`${parte('year')}-${parte('month')}-${parte('day')}`);
}

/** Semana civil lunes–domingo; corte martes, pago viernes. */
export function viernesRecepcion(valor: string | null | undefined): string | null {
  const dia = diaGuatemala(valor);
  if (!dia) return null;
  const d = new Date(`${dia}T12:00:00Z`);
  const semana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 5 - semana + (semana > 2 ? 7 : 0));
  return d.toISOString().slice(0, 10);
}