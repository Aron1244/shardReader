import "@testing-library/jest-dom/vitest";
import "@/i18n";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

class MockMediaQueryList {
  matches = false;
  media = "";
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;
  addListener = () => undefined;
  removeListener = () => undefined;
  addEventListener = () => undefined;
  removeEventListener = () => undefined;
  dispatchEvent = () => false;
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => new MockMediaQueryList(),
  });
}
