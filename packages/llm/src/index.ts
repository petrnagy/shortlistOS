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
  buildOpportunityFactsPrompt,
  buildJobDescriptionMarkdownPrompt,
  buildJobPostingClassificationPrompt,
  classifyOpportunityFactsContent,
  classifyJobPostingContent,
  extractJobDescriptionMarkdown,
  convertHtmlToJobPostingMarkdown,
  jobPostingClassificationSchema,
  jobPostingSuccessSchema,
  opportunityFactsSchema,
  sanitizeJobDescriptionMarkdown,
  type ClassifyOpportunityFactsInput,
  type ClassifyOpportunityFactsResult,
  type ClassifyJobPostingContentInput,
  type ClassifyJobPostingContentResult,
  type JobPostingClassification,
  type ExtractJobDescriptionMarkdownInput,
  type ExtractJobDescriptionMarkdownResult,
  type OpportunityFacts,
} from "./jobs/classify-job-posting";
