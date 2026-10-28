import { runInNewContext } from "node:vm";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PUBLIC_THEME_KEY, publicThemeBootstrap } from "../src/components/theme/public-theme";
import { SiteHeader } from "../src/components/SiteHeader";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));

describe("Public theme before-paint bootstrap", () => {
  it.each([[null, "dark"], ["dark", "dark"], ["light", "light"], ["invalid", "dark"]])(
    "applies stored %s as %s before a client component mounts", (stored, expected) => {
      const dataset: Record<string, string> = {};
      const getItem = vi.fn(() => stored);
      runInNewContext(publicThemeBootstrap, { document: { documentElement: { dataset } }, localStorage: { getItem } });
      expect(dataset.publicTheme).toBe(expected);
      expect(getItem).toHaveBeenCalledExactlyOnceWith(PUBLIC_THEME_KEY);
    },
  );
  it("still renders dark when browser storage is blocked", () => {
    const dataset: Record<string, string> = {};
    expect(() => runInNewContext(publicThemeBootstrap, {
      document: { documentElement: { dataset } },
      localStorage: { getItem: () => { throw new Error("Storage disabled"); } },
    })).not.toThrow();
    expect(dataset.publicTheme).toBe("dark");
  });
});

describe("Public theme control server rendering", () => {
  it.each(["/", "/sumber-data", "/privasi"])("renders an accessible adjacent control on %s without browser globals", path => {
    route.path = path;
    const html = renderToString(<SiteHeader />);
    expect(html).toContain('class="nav-actions"');
    expect(html).toContain('aria-label="Mode gelap"');
    expect(html).toContain('aria-pressed="true"');
    expect(html.indexOf('class="nav-primary"')).toBeLessThan(html.indexOf('class="theme-toggle"'));
  });
  it("keeps the monitoring page without a public theme control", () => {
    route.path = "/peta";
    const html = renderToString(<SiteHeader />);
    expect(html).not.toContain('class="theme-toggle"');
    expect(html).toContain('class="nav-primary"');
  });
});
