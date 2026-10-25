import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJobOpportunity } from "./fetch-job-opportunity";

afterEach(() => vi.unstubAllGlobals());

describe("browser job page capture", () => {
  it("captures HTML as a file using browser credentials", async () => {
    const html = "<html><body>Software Engineer at Acme</body></html>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = await fetchJobOpportunity("https://example.com/jobs/123");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "https://example.com/jobs/123",
      { credentials: "include", signal: expect.any(AbortSignal) as unknown },
    );
    expect(file.name).toBe("job-opportunity.html");
    expect(file.type).toBe("text/html;charset=utf-8");
    expect(await file.text()).toBe(html);
  });

  it("fails immediately on blocked access without a retry or backend fallback", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchJobOpportunity("https://blocked.example/job"),
    ).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    new Response("Forbidden", { status: 403 }),
    new Response("PDF", { headers: { "content-type": "application/pdf" } }),
    new Response("  ", { headers: { "content-type": "text/html" } }),
  ])("rejects an unreadable or empty job page", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      fetchJobOpportunity("https://example.com/job"),
    ).rejects.toThrow();
  });
});
