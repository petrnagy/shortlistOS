import { i18n } from "@lingui/core";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import cs from "~/locales/cs/messages.json";
import de from "~/locales/de/messages.json";
import en from "~/locales/en/messages.json";
import es from "~/locales/es/messages.json";
import fr from "~/locales/fr/messages.json";
import pl from "~/locales/pl/messages.json";
import PowerpackSuccessPage from "~/pages/settings/powerpack/success";

// Vitest does not run Next's Lingui macro transform. Resolve the source IDs
// through real catalogs so the page can be rendered in each supported locale.
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => i18n._(parts.join("")),
}));
vi.mock("next/router", () => ({
  useRouter: () => ({ isReady: true, query: { session_id: "cs_success" } }),
}));
vi.mock("~/components/SettingsLayout", () => ({
  SettingsLayout: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("~/components/PageHead", () => ({ PageHead: () => null }));
vi.mock("~/components/Dashboard", () => ({ getDashboardLayout: vi.fn() }));
vi.mock("~/components/Button", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Powerpack checkout success", () => {
  it.each(Object.entries({ en, cs, de, es, fr, pl }))(
    "renders the automation message beneath activation in %s",
    (locale, catalog) => {
      vi.stubGlobal("React", React);
      i18n.load(
        locale,
        Object.fromEntries(
          Object.values(catalog).map((entry) => [
            entry.message,
            entry.translation || entry.message,
          ]),
        ),
      );
      i18n.activate(locale);
      const html = renderToStaticMarkup(<PowerpackSuccessPage />);
      const message = catalog.IRZtPR.translation;
      expect(message).not.toBe("");
      expect(html).toContain(message);
      expect(html.indexOf(message)).toBeGreaterThan(html.indexOf("</p>"));
      vi.unstubAllGlobals();
    },
  );
});
