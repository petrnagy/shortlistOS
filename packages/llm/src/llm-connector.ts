/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-23
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { Mistral } from "@mistralai/mistralai";

export interface CompleteLlmMessageInput {
  apiKey: string;
  model: string;
  message: string;
  responseFormat?: "json_object";
}

export interface CompleteLlmMessageResult {
  content: string;
  model: string;
  raw: unknown;
}

interface ChatCompletionLike {
  choices?: {
    message?: {
      content?: unknown;
    };
  }[];
  model?: string;
}

export async function completeLlmMessage({
  apiKey,
  model,
  message,
  responseFormat,
}: CompleteLlmMessageInput): Promise<CompleteLlmMessageResult> {
  const trimmedApiKey = apiKey.trim();
  const trimmedModel = model.trim();
  const trimmedMessage = message.trim();

  if (!trimmedApiKey) {
    throw new Error("LLM connector API key is required.");
  }

  if (!trimmedModel) {
    throw new Error("LLM connector model is required.");
  }

  if (!trimmedMessage) {
    throw new Error("LLM connector message is required.");
  }

  const client = new Mistral({
    apiKey: trimmedApiKey,
  });

  const completion = (await client.chat.complete({
    model: trimmedModel,
    messages: [
      {
        role: "user",
        content: trimmedMessage,
      },
    ],
    ...(responseFormat && {
      responseFormat: {
        type: responseFormat,
      },
    }),
  })) as ChatCompletionLike;

  const content = normalizeTextContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error("LLM connector response did not include text content.");
  }

  return {
    content,
    model: completion.model ?? trimmedModel,
    raw: completion,
  };
}

function normalizeTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return (content as unknown[]).map(getChunkText).join("");
}

function getChunkText(chunk: unknown): string {
  if (typeof chunk !== "object" || chunk === null || !("text" in chunk)) {
    return "";
  }

  const text = (chunk as { text: unknown }).text;

  return typeof text === "string" ? text : "";
}
