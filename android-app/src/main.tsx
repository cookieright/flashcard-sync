// Entry point for the Android app. Reuses the website's pages (src/routes) but runs them
// as a plain client-side app, because a phone has no server for TanStack Start's SSR.
import "../../src/styles.css";
import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Route as IndexFileRoute } from "@/routes/index";
import { Route as StudyFileRoute } from "@/routes/study.$deckId";
import { Route as AccountFileRoute } from "@/routes/account";
import { useReminderSync } from "@/lib/study-plan";
import { SyncHost } from "@/components/sync-host";
import { installNativeSpeech } from "./native-speech";
import { installNativeReminders } from "./native-reminders";

installNativeSpeech();
installNativeReminders();

function ReminderSync() {
  useReminderSync();
  return null;
}

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <ReminderSync />
      <SyncHost />
      <Outlet />
    </QueryClientProvider>
  ),
});

const pageOf = (route: { options: unknown }) =>
  (route.options as { component: ComponentType }).component;

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: pageOf(IndexFileRoute) }),
  createRoute({ getParentRoute: () => rootRoute, path: "/account", component: pageOf(AccountFileRoute) }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/study/$deckId",
    component: pageOf(StudyFileRoute),
  }),
]);

const router = createRouter({ routeTree, history: createHashHistory() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
