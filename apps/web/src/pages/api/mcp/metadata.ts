import type { NextApiRequest, NextApiResponse } from "next";

import { MCP_SCOPE, mcpUrls } from "~/server/mcp/config";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { origin, resource } = mcpUrls();
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.query.kind === "resource")
    return res.json({
      resource,
      authorization_servers: [origin],
      scopes_supported: MCP_SCOPE.split(" "),
      bearer_methods_supported: ["header"],
    });
  return res.json({
    issuer: origin,
    authorization_endpoint: `${origin}/mcp/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: MCP_SCOPE.split(" "),
    authorization_response_iss_parameter_supported: true,
  });
}
