import { t } from "@lingui/core/macro";
import { env } from "next-runtime-env";
import { useState } from "react";

import Button from "~/components/Button";
import { PageHead } from "~/components/PageHead";
import { api } from "~/utils/api";

export default function McpSettings() {
  const connections = api.mcp.connections.useQuery();
  const utils = api.useUtils();
  const revoke = api.mcp.revoke.useMutation({
    onSuccess: () => utils.mcp.connections.invalidate(),
  });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const base =
    env("NEXT_PUBLIC_BASE_URL") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base.replace(/\/$/, "")}/api/mcp`;
  return (
    <>
      <PageHead title={t`Settings | MCP`} />
      <div className="space-y-6 py-8 text-sm text-light-1000 dark:text-dark-1000">
        <h2 className="font-bold">{t`Connect your AI assistant`}</h2>
        <p>{t`Use MCP to work with your opportunities and shortlists from an AI assistant. One browser authorization connects your account, using your existing workspace permissions.`}</p>
        <p>{t`MCP is available to every shortlistOS account.`}</p>
        <div className="space-y-3 rounded-lg border border-light-400 p-4 dark:border-dark-400">
          <h3 className="font-semibold">{t`Server URL`}</h3>
          <code className="block select-all break-all">{url}</code>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(
                () => {
                  setCopied(true);
                  setCopyError(false);
                },
                () => setCopyError(true),
              );
            }}
          >
            {copied ? t`Copied` : t`Copy URL`}
          </Button>
          {copyError && (
            <p role="alert">{t`Could not copy. Select and copy the URL above.`}</p>
          )}
        </div>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t`In your AI client's integrations or MCP settings, add a remote MCP server using the URL above. Select Streamable HTTP and browser authorization (OAuth), if asked.`}</li>
          <li>{t`Sign in to shortlistOS in the browser, review the client name and requested access, then select Allow access. You do not need an API key.`}</li>
          <li>{t`Return to your AI client and ask it to list your shortlists or manage an opportunity. Your client must support remote MCP with OAuth and dynamic client registration.`}</li>
        </ol>
        <p>{t`Opportunities support reading and writing, including moving and deletion. Shortlists support reading, creation, and renaming. Columns are fixed. Magic email and job attachment ingestion are unavailable through MCP.`}</p>
        <p>{t`Powerpack automations follow your existing subscription and shortlist settings.`}</p>
        <p>{t`Actions are attributed to you via the authorized client name. MCP clients do not reliably disclose which underlying model performed an action.`}</p>
        <h3 className="font-semibold">{t`Connected clients`}</h3>
        {connections.isLoading && <p>{t`Loading connections…`}</p>}
        {connections.error && (
          <p role="alert">{t`Could not load connections.`}</p>
        )}
        {connections.data?.length === 0 && (
          <p>{t`No MCP clients connected.`}</p>
        )}
        <ul className="divide-y divide-light-300 dark:divide-dark-300">
          {connections.data?.map((connection) => (
            <li
              key={connection.publicId}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="font-medium">{connection.clientName}</p>
                <p className="text-light-900 dark:text-dark-900">{t`Connected ${connection.createdAt.toLocaleDateString()}`}</p>
              </div>
              <Button
                variant="secondary"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate({ publicId: connection.publicId })}
              >{t`Revoke access`}</Button>
            </li>
          ))}
        </ul>
        {revoke.error && (
          <p role="alert">{t`Could not revoke access. Try again.`}</p>
        )}
      </div>
    </>
  );
}
