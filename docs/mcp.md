# MCP

shortlistOS exposes a remote MCP server at `/api/mcp` using Streamable HTTP.
Open **Settings → MCP** (`/settings/mcp`) for the server URL, connection instructions,
and a list of authorized clients. Connections can be revoked there even after
Powerpack expires.

Add the URL in an MCP client that supports remote Streamable HTTP, OAuth browser
authorization, and dynamic client registration. Sign in to shortlistOS, review the
client's requested access, approve it, then return to the client. No API key is
needed. Authorization covers the account; existing workspace membership and
permissions still apply to each operation. All MCP access requires an active
Powerpack, including reads and refresh-token exchanges.

## Supported operations

- Discover workspaces and shortlists; read shortlists and opportunity details.
- Create shortlists with the standard eight columns and labels; rename shortlists.
- Create, update, move, duplicate, and soft-delete opportunities.
- Manage opportunity comments, existing label/member assignments, and checklists.
- Supply job details directly, including company, source URL, salary, location,
  contacts, description, and due date. Dates use ISO 8601 strings with a timezone.

There are no tools for deleting shortlists, changing columns, changing shortlist
settings, invoking Magic Inbox, or processing job attachments. The usual GUI
procedures run underneath the tools, so Powerpack enrichment and automation remain
active. Automation settings and manually maintained card preferences keep their
normal behavior.

Card activities and shortlist creation/renaming record the authorizing user and
client name, displayed as “Username via Client”. The name is supplied during
client registration and displayed on the consent screen; it identifies the
authorized client, not a verified underlying AI model. Tool parameters and MCP
initialization cannot override this attribution.

## Deployment

Apply database migrations with `pnpm db:migrate` before serving the new version.
The implementation uses the existing PostgreSQL and `NEXT_PUBLIC_BASE_URL`
configuration; no separate MCP service or new environment variable is required.
The base URL must match the public HTTPS origin used by clients (localhost HTTP
is suitable for local development). Forward `/api/mcp`, `/mcp/authorize`, and
`/.well-known/*` to the web app. Stateless transport supports multiple replicas.

OAuth discovery is served at `/.well-known/oauth-authorization-server` and
`/.well-known/oauth-protected-resource/api/mcp`. The latter is also advertised in
the MCP endpoint's `WWW-Authenticate` challenge. Public clients register via
`/api/mcp/oauth/register`; authorization uses S256 PKCE with exact registered
redirect matching and resource binding. HTTPS callbacks and loopback HTTP
callbacks are supported. Tokens are opaque and stored as SHA-256 hashes. Access
tokens expire after one hour; refresh tokens rotate on use and expire after 30
days of inactivity. Reusing a consumed refresh token revokes the connection.
Revocation disables the connection's access and refresh tokens.
