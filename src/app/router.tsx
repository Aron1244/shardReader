import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { LibraryPage } from "@/features/library/pages/library-page";
import { ReaderPage } from "@/features/reader/pages/reader-page";
import { SettingsPage } from "@/features/settings/pages/settings-page";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppShell>
        <LibraryPage />
      </AppShell>
    ),
  },
  {
    path: "/reader",
    element: (
      <AppShell>
        <ReaderPage />
      </AppShell>
    ),
  },
  {
    path: "/reader/:bookId",
    element: (
      <AppShell>
        <ReaderPage />
      </AppShell>
    ),
  },
  {
    path: "/settings",
    element: (
      <AppShell>
        <SettingsPage />
      </AppShell>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
