import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { Button } from "@hasu-gallery/ui";
import {
  Images,
  Palette,
  ShieldCheck,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { GalleryPage } from "./pages/GalleryPage";
import { WorkDetailPage } from "./pages/WorkDetailPage";
import { UploadPage } from "./pages/UploadPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ModerationPage } from "./pages/ModerationPage";
import { AuthGuard } from "./components/AuthGuard";
import { useAuthStore } from "./store/auth";

type NavPath = "/gallery/meme" | "/gallery/art" | "/upload" | "/profile" | "/moderation";

interface NavItem {
  to: NavPath;
  desktopLabel: string;
  mobileLabel: string;
  Icon: LucideIcon;
}

const primaryNavItems: NavItem[] = [
  { to: "/gallery/meme", desktopLabel: "Meme", mobileLabel: "Meme", Icon: Images },
  { to: "/gallery/art", desktopLabel: "Art", mobileLabel: "Art", Icon: Palette },
  { to: "/upload", desktopLabel: "Upload", mobileLabel: "Upload", Icon: Upload },
  { to: "/profile", desktopLabel: "Profile", mobileLabel: "Profile", Icon: User },
];

const moderationNavItem: NavItem = {
  to: "/moderation",
  desktopLabel: "Moderation",
  mobileLabel: "Review",
  Icon: ShieldCheck,
};

// Root layout
const rootRoute = createRootRoute({
  component: () => {
    const user = useAuthStore((state) => state.user);
    const isModerator = user && (user.role === 'moderator' || user.role === 'admin');
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;
    const navItems = isModerator ? [...primaryNavItems, moderationNavItem] : primaryNavItems;

    const navLinkClass = (path: NavPath) =>
      currentPath === path
        ? "bg-ink text-paper"
        : "";

    return (
      <div className="min-h-screen bg-paper text-ink">
        <header className="border-b border-ink px-4 py-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="shrink-0 text-xl font-bold md:text-2xl">Hasu Gallery</h1>
            {user && (
              <nav className="hidden max-w-full flex-wrap justify-end gap-4 md:flex" aria-label="Primary navigation">
                {navItems.map((item) => (
                  <Link key={item.to} to={item.to} aria-current={currentPath === item.to ? "page" : undefined}>
                    <Button variant="ghost" size="sm" className={navLinkClass(item.to)}>
                      {item.desktopLabel}
                    </Button>
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </header>
        <main className={user ? "container mx-auto p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-4" : "container mx-auto p-4"}>
          <Outlet />
        </main>
        {user && (
          <nav
            className="fixed inset-x-0 bottom-0 z-50 flex gap-1 border-t border-ink bg-paper px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden"
            aria-label="Primary navigation"
          >
            {navItems.map((item) => {
              const Icon = item.Icon;
              const isActive = currentPath === item.to;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                    isActive ? "bg-ink text-paper" : "text-ink hover:bg-accent",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" strokeWidth={2} />
                  <span className="max-w-full truncate">{item.mobileLabel}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    );
  },
});

// Index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => {
    const user = useAuthStore((state) => state.user);
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Welcome to Hasu Gallery</h2>
        <p className="text-ink-2">
          双画廊 UGC 平台 - Phase 2 功能完整
        </p>
        <div className="flex gap-4">
          {user ? (
            <>
              <Link to="/gallery/meme">
                <Button>Meme Gallery</Button>
              </Link>
              <Link to="/gallery/art">
                <Button>Art Gallery</Button>
              </Link>
              <Link to="/upload">
                <Button variant="outline">Upload</Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button>Login</Button>
              </Link>
              <Link to="/register">
                <Button variant="outline">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    );
  },
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

// Upload route
const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/upload",
  component: () => (
    <AuthGuard>
      <UploadPage />
    </AuthGuard>
  ),
});

// Profile route
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: () => (
    <AuthGuard>
      <ProfilePage />
    </AuthGuard>
  ),
});

// Moderation route (moderator/admin only)
const moderationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/moderation",
  component: ModerationPage,
});

// Create route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  memeGalleryRoute,
  artGalleryRoute,
  workDetailRoute,
  uploadRoute,
  profileRoute,
  moderationRoute,
]);

// Create router
export const router = createRouter({ routeTree });

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
