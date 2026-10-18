import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Skeleton } from "@/components/ui/skeleton";

function PaginaCargando() {
  return <div className="space-y-8 p-6" aria-label="Cargando página"><Skeleton className="h-8 w-64" /><Skeleton className="h-16 w-full" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-32" />)}</div><Skeleton className="h-64 w-full" /></div>;
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PaginaCargando,
    defaultPendingMs: 150,
  });

  return router;
};
