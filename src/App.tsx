import { AppRouter } from "@/app/router";
import { AppProviders } from "@/components/layout/providers";

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
