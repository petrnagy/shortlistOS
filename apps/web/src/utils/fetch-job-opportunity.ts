/** Runs only in the browser. A blocked page must never trigger a server fetch. */
export async function fetchJobOpportunity(url: string): Promise<File> {
  const page = await fetch(url, {
    credentials: "include",
    signal: AbortSignal.timeout(30_000),
  });
  if (!page.ok || !page.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Page unavailable");
  }
  const html = await page.text();
  if (!html.trim()) throw new Error("Empty page");
  return new File([html], "job-opportunity.html", {
    type: "text/html;charset=utf-8",
  });
}
