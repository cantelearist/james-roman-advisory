import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// GSAP's browser plugins probe matchMedia while modules are imported. JSDOM
// does not provide it, so expose the small subset those plugins need.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof window !== "undefined") {
  window.scrollTo = () => {};
}

// Framer Motion and Lenis rely on these observers, which are not implemented
// by JSDOM. A no-op implementation is sufficient for component tests; visual
// intersection/resize behavior is covered by browser E2E tests.
if (typeof globalThis.IntersectionObserver === "undefined") {
  class TestIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      void target;
      void this.callback;
    }
    unobserve(target: Element) { void target; }
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  }
  globalThis.IntersectionObserver = TestIntersectionObserver;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class TestResizeObserver implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      void target;
      void this.callback;
    }
    unobserve(target: Element) { void target; }
    disconnect() {}
  }
  globalThis.ResizeObserver = TestResizeObserver;
}

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
  }) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.priority;
    delete imageProps.sizes;

    return React.createElement("img", imageProps);
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href, ...props }, children),
}));
