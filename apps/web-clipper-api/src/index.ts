/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { createLogger } from "@kan/logger";

import { config } from "./config";
import { createWebClipperServer } from "./server";

const logger = createLogger("web-clipper-api");
const server = createWebClipperServer();

server.listen(config.WEB_CLIPPER_API_PORT, "0.0.0.0", () => {
  logger.info(
    { port: config.WEB_CLIPPER_API_PORT },
    "Web Clipper API is listening",
  );
});

const shutdown = () => {
  server.close((error) => {
    if (error) {
      logger.error({ error }, "Web Clipper API shutdown failed");
      process.exitCode = 1;
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
