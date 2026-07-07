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
  House,
  Images,
  Palette,
  ShieldCheck,
  Upload,
  User,
  type LucideIcon,
} from "lucide-react";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { GalleryPage } from "./pages/GalleryPage";
import { WorkDetailPage } from "./pages/WorkDetailPage";
import { UploadPage } from "./pages/UploadPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ModerationPage } from "./pages/ModerationPage";
import { AuthGuard } from "./components/AuthGuard";
import { LanguageSelect } from "./components/LanguageSelect";
import { useAuthStore } from "./store/auth";
import { useI18n } from "./i18n";

type NavPath = "/" | "/gallery/meme" | "/gallery/art" | "/upload" | "/profile" | "/moderation";

interface NavItem {
  to: NavPath;
  desktopLabelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  mobileLabelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  Icon: LucideIcon;
}

const publicNavItems: NavItem[] = [
  { to: "/", desktopLabelKey: "nav.home", mobileLabelKey: "nav.home", Icon: House },
  { to: "/gallery/meme", desktopLabelKey: "nav.meme", mobileLabelKey: "nav.meme", Icon: Images },
  { to: "/gallery/art", desktopLabelKey: "nav.art", mobileLabelKey: "nav.art", Icon: Palette },
];

const signedInTaskNavItems: NavItem[] = [
  { to: "/upload", desktopLabelKey: "nav.upload", mobileLabelKey: "nav.upload", Icon: Upload },
  { to: "/profile", desktopLabelKey: "nav.profile", mobileLabelKey: "nav.me", Icon: User },
];

const moderationNavItem: NavItem = {
  to: "/moderation",
  desktopLabelKey: "nav.moderation",
  mobileLabelKey: "nav.review",
  Icon: ShieldCheck,
};

// Root layout
const rootRoute = createRootRoute({
  component: () => {
    const user = useAuthStore((state) => state.user);
    const { t } = useI18n();
    const isModerator = user && (user.role === 'moderator' || user.role === 'admin');
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;
    const desktopNavItems = user
      ? [...publicNavItems, ...signedInTaskNavItems, ...(isModerator ? [moderationNavItem] : [])]
      : publicNavItems;
    const mobileNavItems = user ? [...publicNavItems, ...signedInTaskNavItems] : publicNavItems;

    const navLinkClass = (path: NavPath) =>
      currentPath === path
        ? "bg-ink text-paper"
        : "";

    return (
      <div className="min-h-screen bg-paper text-ink">
        <header className="border-b border-ink px-4 py-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="shrink-0 text-xl font-bold md:text-2xl">
              {t('app.brand')}
            </Link>
            <div className="flex items-center gap-3">
              <nav className="hidden max-w-full flex-wrap justify-end gap-2 md:flex" aria-label="Primary navigation">
                {desktopNavItems.map((item) => (
                  <Link key={item.to} to={item.to} aria-current={currentPath === item.to ? "page" : undefined}>
                    <Button variant="ghost" size="sm" className={navLinkClass(item.to)}>
                      {t(item.desktopLabelKey)}
                    </Button>
                  </Link>
                ))}
              </nav>
              <LanguageSelect />
              {!user && (
                <Link to="/login" className="shrink-0">
                  <Button size="sm">{t('nav.signIn')}</Button>
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="container mx-auto p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-4">
          <Outlet />
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-50 flex gap-1 border-t border-ink bg-paper px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden"
          aria-label="Primary navigation"
        >
          {mobileNavItems.map((item) => {
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
                <span className="max-w-full truncate">{t(item.mobileLabelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    );
  },
});

// Index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
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

// Public gallery routes
const memeGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/meme",
  component: () => <GalleryPage gallery="meme" />,
});

const artGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery/art",
  component: () => <GalleryPage gallery="art" />,
});

// Work detail route
const workDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/works/$id",
  component: WorkDetailPage,
});

// Upload route
const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/upload",
  component: () => (
    <AuthGuard reason="upload" next="/upload">
      <UploadPage />
    </AuthGuard>
  ),
});

// Profile route
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: () => (
    <AuthGuard reason="profile" next="/profile">
      <ProfilePage />
    </AuthGuard>
  ),
});

// Moderation route (moderator/admin only)
const moderationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/moderation",
  component: () => (
    <AuthGuard reason="moderation" next="/moderation">
      <ModerationPage />
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
