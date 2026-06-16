import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { Button } from "@hasu-gallery/ui";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { GalleryPage } from "./pages/GalleryPage";
import { WorkDetailPage } from "./pages/WorkDetailPage";
import { AuthGuard } from "./components/AuthGuard";

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
        双画廊 UGC 平台 - Phase 2.1 认证界面已就位
      </p>
      <div className="flex gap-4">
        <Link to="/login">
          <Button>Login</Button>
        </Link>
        <Link to="/register">
          <Button variant="outline">Register</Button>
        </Link>
      </div>
    </div>
  ),
});

// Login route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

// Register route
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
});

// Protected gallery routes
const memeGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/meme",
  component: () => (
    <AuthGuard>
      <GalleryPage gallery="meme" />
    </AuthGuard>
  ),
});

const artGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/art",
  component: () => (
    <AuthGuard>
      <GalleryPage gallery="art" />
    </AuthGuard>
  ),
});

// Work detail route
const workDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/works/$id",
  component: () => (
    <AuthGuard>
      <WorkDetailPage />
    </AuthGuard>
  ),
});

// Create route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  memeGalleryRoute,
  artGalleryRoute,
  workDetailRoute,
]);

// Create router
export const router = createRouter({ routeTree });

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
