import { env } from "next-runtime-env";

export const MCP_SCOPE = "shortlist";
export function mcpUrls() {
  const origin = new URL(env("NEXT_PUBLIC_BASE_URL") ?? "http://localhost:3000")
    .origin;
  return {
    origin,
    resource: `${origin}/api/mcp`,
    metadata: `${origin}/.well-known/oauth-protected-resource/api/mcp`,
  };
}

export function validRedirectUri(value: string) {
  try {
    const url = new URL(value);
    return (
      !url.hash &&
      !url.username &&
      !url.password &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

export function validScope(scope: string | undefined) {
  return (
    !scope ||
    scope.split(" ").every((part) => MCP_SCOPE.split(" ").includes(part))
  );
}
