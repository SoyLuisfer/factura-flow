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
- Payment decisions come only from the pure deterministic rules engine in `src/lib/motorReglas.ts` (no AI calls); AI only extracts invoice data. Why: hackathon judging requires auditable, non-AI decisions.
- A DB trigger on `decisiones` rejects PAGAR unless all controles are OK/NO_APLICA or a human approval has approver, timestamp and comment. Why: defense in depth beyond app code.
- `registro_eventos` is append-only, enforced by trigger; only the `reiniciar_demo()` SQL function may clear it. Why: audit integrity.
- Demo has no auth; tables are accessed with anon RLS policies, and seeding/reset run via SQL functions `seed_demo_si_vacio()` / `reiniciar_demo()`. Why: judges enter directly.
