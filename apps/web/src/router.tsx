import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { buttonStyles } from "@hasu-gallery/ui";
import {
  House,
  Images,
  BookOpenText,
  Palette,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import { CreateMenu } from "./components/CreateMenu";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { GalleryPage } from "./pages/GalleryPage";
import { WorkDetailPage } from "./pages/WorkDetailPage";
import { UploadPage } from "./pages/UploadPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ModerationPage } from "./pages/ModerationPage";
import { FictionBrowsePage } from "./pages/FictionBrowsePage";
import { FictionReaderPage } from "./pages/FictionReaderPage";
import { FictionWorkspacePage } from "./pages/FictionWorkspacePage";
import { AuthGuard } from "./components/AuthGuard";
import { LanguageSelect } from "./components/LanguageSelect";
import { useAuthStore } from "./store/auth";
import { useI18n } from "./i18n";

type NavPath = "/" | "/gallery/meme" | "/gallery/art" | "/fiction" | "/profile" | "/moderation";

interface NavItem {
  to: NavPath;
  desktopLabelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  mobileLabelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  Icon: LucideIcon;
}

interface FictionRouteSearch {
  q?: string;
  fandom?: string;
  page?: number;
}

const publicNavItems: NavItem[] = [
  { to: "/", desktopLabelKey: "nav.home", mobileLabelKey: "nav.home", Icon: House },
  { to: "/gallery/meme", desktopLabelKey: "nav.meme", mobileLabelKey: "nav.meme", Icon: Images },
  { to: "/gallery/art", desktopLabelKey: "nav.art", mobileLabelKey: "nav.art", Icon: Palette },
  { to: "/fiction", desktopLabelKey: "nav.fiction", mobileLabelKey: "nav.fiction", Icon: BookOpenText },
];

const signedInTaskNavItems: NavItem[] = [
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
    const mobileNavItems = user
      ? [...publicNavItems, ...signedInTaskNavItems]
      : publicNavItems;

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
            <div className="flex items-center gap-2 sm:gap-3">
              <nav className="hidden max-w-full flex-wrap justify-end gap-2 md:flex" aria-label={t('nav.primary')}>
                {desktopNavItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={currentPath === item.to ? "page" : undefined}
                    className={buttonStyles({ variant: "ghost", size: "sm", className: navLinkClass(item.to) })}
                  >
                    {t(item.desktopLabelKey)}
                  </Link>
                ))}
              </nav>
              <LanguageSelect />
              <div className="hidden md:block">
                <CreateMenu placement="header" />
              </div>
              {!user && (
                <Link to="/login" className={buttonStyles({ size: "sm", className: "shrink-0" })}>
                  {t('nav.signIn')}
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
          aria-label={t('nav.bottom')}
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
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-[60] md:hidden">
          <CreateMenu placement="fab" />
        </div>
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
const authSearchSchema = (search: Record<string, unknown>) => {
  const next = typeof search.next === 'string' ? search.next : undefined;
  const reason = typeof search.reason === 'string' ? search.reason : undefined;
  return {
    ...(next ? { next } : {}),
    ...(reason ? { reason } : {}),
  };
};

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: authSearchSchema,
  component: LoginPage,
});

// Register route
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: authSearchSchema,
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

const fictionBrowseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/fiction",
  validateSearch: (search: Record<string, unknown>): FictionRouteSearch => {
    const validated: FictionRouteSearch = {};
    if (typeof search.q === 'string' && search.q.trim()) validated.q = search.q.trim();
    if (typeof search.fandom === 'string' && search.fandom.trim()) {
      validated.fandom = search.fandom.trim();
    }
    const page = typeof search.page === 'number' ? search.page : Number(search.page);
    if (Number.isFinite(page) && page > 1) validated.page = Math.floor(page);
    return validated;
  },
  component: FictionBrowsePage,
});

const fictionReaderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/fiction/$id",
  component: FictionReaderPage,
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

const fictionWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile/fictions",
  component: () => (
    <AuthGuard reason="fiction" next="/profile/fictions">
      <FictionWorkspacePage />
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
  fictionBrowseRoute,
  fictionReaderRoute,
  workDetailRoute,
  uploadRoute,
  profileRoute,
  fictionWorkspaceRoute,
  moderationRoute,
]);

// Create router
function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{t('notFound.title')}</h1>
      <p className="max-w-md text-sm leading-6 text-ink-2">{t('notFound.description')}</p>
      <Link to="/" className={buttonStyles()}>
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}

export const router = createRouter({ routeTree, defaultNotFoundComponent: NotFoundPage });

// Register router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
