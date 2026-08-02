/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-24
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import {
  processShortlistJobQueueBatch,
} from "./source-queue-worker";

export const processClipBatch = processShortlistJobQueueBatch;

export type ProcessClipBatchOptions = Parameters<
  typeof processShortlistJobQueueBatch
>[1];

export type ProcessClipBatchResult = Awaited<
  ReturnType<typeof processShortlistJobQueueBatch>
>;
