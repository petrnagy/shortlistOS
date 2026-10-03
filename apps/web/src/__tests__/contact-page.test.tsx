import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ContactPage from "~/pages/contact";

const { useSession } = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
}));
vi.mock("@kan/auth/client", () => ({
  authClient: { useSession },
}));
vi.mock("~/components/FeedbackForm", () => ({
  default: ({ standalone }: { standalone?: boolean }) =>
    standalone ? <form aria-label="feedback form" /> : null,
}));
vi.mock("~/components/PageHead", () => ({ PageHead: () => null }));
vi.mock("~/views/home/components/Layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe("contact page", () => {
  beforeEach(() => {
    useSession.mockReset();
    vi.stubGlobal("React", React);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the existing feedback form to signed-in users", () => {
    useSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    });

    const html = renderToStaticMarkup(<ContactPage />);

    expect(html).toContain('aria-label="feedback form"');
    expect(html).not.toContain("support@shortlistos.co");
  });

  it("offers sign-in and a support email to signed-out visitors", () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    const html = renderToStaticMarkup(<ContactPage />);

    expect(html).toContain('href="/login?next=%2Fcontact"');
    expect(html).toContain('href="mailto:support@shortlistos.co"');
    expect(html).not.toContain('aria-label="feedback form"');
  });

  it("does not flash the signed-out fallback while session state is loading", () => {
    useSession.mockReturnValue({ data: null, isPending: true });

    const html = renderToStaticMarkup(<ContactPage />);

    expect(html).not.toContain("support@shortlistos.co");
    expect(html).not.toContain('aria-label="feedback form"');
  });
});
