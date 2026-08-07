/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-24
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
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
