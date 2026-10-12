import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "@/components/layout/providers";

describe("AppShell smoke", () => {
  it("renders navigation links when wrapped in providers", () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <AppShell>
            <p>contenido</p>
          </AppShell>
        </AppProviders>
      </MemoryRouter>,
    );
    expect(screen.getByText(/biblioteca|library/i)).toBeInTheDocument();
    expect(screen.getByText(/ajustes|settings/i)).toBeInTheDocument();
  });
});
