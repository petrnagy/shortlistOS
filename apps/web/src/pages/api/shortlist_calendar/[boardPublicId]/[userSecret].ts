import type { NextApiRequest, NextApiResponse } from "next";

import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

import {
  getShortlistCalendar,
  renderShortlistCalendar,
} from "~/utils/shortlistCalendar";

const logger = createLogger("api:shortlist-calendar");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  const boardPublicId = first(req.query.boardPublicId);
  const userPublicSecret = first(req.query.userSecret);
  const feedSecret = first(req.query.key);
  if (!boardPublicId || !userPublicSecret || !feedSecret) {
    return res.status(404).end();
  }

  const db = createDrizzleClient();
  try {
    const calendar = await getShortlistCalendar(db, {
      boardPublicId,
      userPublicSecret,
      feedSecret,
    });
    if (!calendar) return res.status(404).end();

    const protocol = first(req.headers["x-forwarded-proto"]) ?? "https";
    const host =
      first(req.headers["x-forwarded-host"]) ??
      req.headers.host ??
      "app.shortlistos.co";
    const origin = `${protocol}://${host}`;
    const body = renderShortlistCalendar({
      ...calendar,
      boardUrl: `${origin}/boards/${boardPublicId}`,
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${boardPublicId}.ics"`,
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(body);
  } catch (error) {
    logger.error(
      { error, boardPublicId },
      "Failed to build shortlist calendar",
    );
    return res.status(500).end();
  } finally {
    await db.$client.end();
  }
}

const first = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
