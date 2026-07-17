import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient } from "./lib/queryClient";
import { router } from "./router";
import { useAuthStore } from "./store/auth";
import { useAppStore } from "./store";
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
