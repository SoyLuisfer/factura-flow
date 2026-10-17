// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Pre-bundle UI deps up front so a mid-session re-optimization can't load two React copies.
    optimizeDeps: {
      include: [
        "@radix-ui/react-dialog", "@radix-ui/react-separator", "@radix-ui/react-slot",
        "@radix-ui/react-tooltip", "class-variance-authority", "clsx", "lucide-react",
        "sonner", "tailwind-merge", "@supabase/supabase-js",
      ],
    },
  },
});
