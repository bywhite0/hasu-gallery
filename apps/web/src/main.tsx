import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";
import { useAuthStore } from "./store/auth";
import { useAppStore } from "./store";
// Self-hosted Inter: bundled and served same-origin so the strict CSP
// (style-src/font-src 'self') applies without external font hosts. Only the
// latin subsets are shipped — CJK text falls back to system fonts either way.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-ext-700.css";
import "./styles/app.css";

// Auth initialization wrapper
function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const locale = useAppStore((state) => state.locale);

  useEffect(() => {
    // Check for existing session on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <RouterProvider router={router} />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
