import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { Button } from "@hasu-gallery/ui";

// Root layout
const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink p-4">
        <h1 className="text-2xl font-bold">Hasu Gallery</h1>
      </header>
      <main className="container mx-auto p-4">
        <Outlet />
      </main>
    </div>
  ),
});

// Index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Welcome to Hasu Gallery</h2>
      <p className="text-ink-2">
        双画廊 UGC 平台 - Monorepo 骨架已就位
      </p>
      <div className="flex gap-4">
        <Button>Meme Gallery</Button>
        <Button variant="outline">Art Gallery</Button>
      </div>
    </div>
  ),
});

// Create route tree
const routeTree = rootRoute.addChildren([indexRoute]);

// Create router
export const router = createRouter({ routeTree });

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
