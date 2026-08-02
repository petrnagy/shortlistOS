/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-08-01
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "next-runtime-env";

import { createLogger } from "@kan/logger";

const logger = createLogger("web-clipper-connect-proxy");

export const config = { api: { bodyParser: false, responseLimit: false } };

const readBody = async (request: NextApiRequest) => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  if (!["GET", "POST"].includes(request.method ?? "")) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  const queryIndex = (request.url ?? "").indexOf("?");
  const query = queryIndex >= 0 ? request.url?.slice(queryIndex) : "";
  const serviceUrl = new URL(
    `/web-clipper/connect${query ?? ""}`,
    env("WEB_CLIPPER_API_URL") ?? "http://127.0.0.1:3010",
  );
  try {
    const upstream = await fetch(serviceUrl, {
      method: request.method,
      headers: {
        ...(request.headers.cookie ? { cookie: request.headers.cookie } : {}),
        ...(request.headers["content-type"]
          ? { "content-type": request.headers["content-type"] }
          : {}),
        "x-forwarded-proto":
          (request.headers["x-forwarded-proto"] as string | undefined) ??
          "http",
      },
      body: request.method === "POST" ? await readBody(request) : undefined,
      redirect: "manual",
    });
    for (const name of [
      "cache-control",
      "content-security-policy",
      "content-type",
      "location",
      "set-cookie",
    ]) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }
    response.statusCode = upstream.status;
    if (upstream.status >= 300 && upstream.status < 400) return response.end();
    return response.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown proxy error" },
      "Web Clipper pairing service unavailable",
    );
    return response
      .status(503)
      .json({ error: "web_clipper_service_unavailable" });
  }
}
