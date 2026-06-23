/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-23
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
export {
  completeLlmMessage,
  type CompleteLlmMessageInput,
  type CompleteLlmMessageResult,
} from "./llm-connector";

export {
  buildJobPostingClassificationPrompt,
  classifyJobPostingContent,
  convertHtmlToJobPostingMarkdown,
  jobPostingClassificationSchema,
  type ClassifyJobPostingContentInput,
  type ClassifyJobPostingContentResult,
  type JobPostingClassification,
} from "./jobs/classify-job-posting";
