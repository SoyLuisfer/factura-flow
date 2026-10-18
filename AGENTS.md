<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Pre-bundle newly introduced Radix UI primitives in Vite's optimizeDeps.include. Why: mid-session dependency re-optimization can leave the preview using stale React module instances and crash hook-based providers.
- Route loading placeholders use the router's shared default pending component; invoice authorship and timeline labels are presentation-only views of existing audit fields. Why: loading stays visible without changing persistence or attributing human exceptions to the agent.
- Invoice ingestion uses `procesamiento.ts` to adapt Guatemala instants to pure engine dates and atomically persist invoice, decision, schedule, events and quote consumption; real-flow tests use isolated tagged rows and targeted cleanup. Why: malformed dates cannot approve or leave orphan invoices, and regression tests exercise the production persistence path without modifying real history.
- Treasury instalments live in `programacion_pagos` and mutations use the validated, atomic `accion_tesoreria` RPC; `contexto.ts` splits full accrual (R9) from active cash rows without category (R10). Why: treasury never changes the agent decision/trace or double-counts budgets, while cash reservations reflect the actual schedule.
- Human fund releases use atomic `liberar_fondos`, immutable batch snapshots and a unique invoice membership table; released schedules stay for accrual but are excluded from cash reservations and protected against treasury edits. Why: debited balances cannot be reserved twice or invoices released into multiple batches.
- Monetary displays and CSV use `formatearMonto` from `src/lib/formato.ts`; editable amount fields use `MontoInput` with unformatted values for persistence. Why: consistent presentation cannot corrupt numeric writes.
- Currency choices and extraction normalization share the browser-safe exports in `src/lib/extraccion.ts`; the server validates AI output with that helper. Why: unsupported currencies cannot leak from AI into accepted structured data and the decision engine remains unchanged.
- Payment decisions come only from the pure deterministic rules engine in `src/lib/motorReglas.ts` (no AI calls); AI only extracts invoice data. Why: hackathon judging requires auditable, non-AI decisions.
- A DB trigger on `decisiones` rejects PAGAR unless all controles are OK/NO_APLICA or a human approval has approver, timestamp and comment. Why: defense in depth beyond app code.
- `registro_eventos` is append-only, enforced by trigger; only the `reiniciar_demo()` SQL function may clear it. Why: audit integrity.
- Demo has no auth; tables are accessed with anon RLS policies, and seeding/reset run via SQL functions `seed_demo_si_vacio()` / `reiniciar_demo()`. Why: judges enter directly.
- AI extraction lives in `src/lib/extraccion.functions.ts` (createServerFn, Lovable AI Gateway, openai/gpt-6-astra, streamed server-side); it only returns structured data and never decides. Why: keeps LOVABLE_API_KEY server-side and the AI/decision separation auditable.
- Uploaded invoice files go to the private `facturas` storage bucket with anon RLS policies; the detail page renders them via short-lived signed URLs. Why: workspace blocks public buckets and the demo has no auth.
- Supplier removal uses the atomic `gestionar_baja_proveedor` RPC with audit logging; history checks include normalized invoice issuers and linked decisions/payments, and a DELETE trigger blocks historical suppliers. Why: unlinked invoices must also retain their supplier and contract-only removal must not partially fail.

- Supplier creation/editing uses the SECURITY INVOKER `guardar_proveedor` RPC to commit supplier, optional contract and audit event atomically; contract cadence stays `mensual`/`unica`. Why: RLS remains enforced and failed contract writes cannot leave partial supplier records.
- Supplier relationship type lives in `proveedores.tipo_relacion` (compra_directa/recurrente/cotizacion); contratos carry estado (vigente/utilizada) and factura_id_uso. R6 is the only rule that reads them; a PAGAR consumes a vigente cotización via the `marcar_cotizacion_utilizada` RPC (helper `consumirCotizacionSiAplica` in src/lib/cotizaciones.ts), called from banco-pruebas, subir and human approval. Why: one-time quotes must not be reused, and the consumption must be auditable.
