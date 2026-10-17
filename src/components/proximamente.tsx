export function Proximamente({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <p className="mt-2 text-muted-foreground">{descripcion}</p>
      <div className="mt-8 rounded-lg border border-dashed bg-card p-10 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Próximamente</span>
      </div>
    </div>
  );
}
