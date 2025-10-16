/**
 * Copyright 2025 ShiftRight Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * ---
 * This file is derived from the Gemini CLI event system
 * (https://github.com/google/gemini-cli), Copyright 2024-2025 Google LLC,
 * licensed under the Apache License 2.0.
 */

/**
 * Event types for gemini-lite agentic loop
 *
 * Forked and simplified from gemini-cli Turn class
 * Removed: MCP, interactive, confirmation events
 */

import type {
  FinishReason,
  GenerateContentResponseUsageMetadata,
  Part,
} from '@google/generative-ai';

/**
 * Event types yielded by LiteTurn.run()
 */
export enum GeminiEventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  ToolCallResponse = 'tool_call_response',
  UserCancelled = 'user_cancelled',
  Error = 'error',
  Thought = 'thought',
  Finished = 'finished',
  Citation = 'citation',
  Retry = 'retry',
  InvalidStream = 'invalid_stream',
}

/**
 * Structured error information
 */
export interface StructuredError {
  message: string;
  status?: number;
}

/**
 * Error event payload
 */
export interface GeminiErrorEventValue {
  error: StructuredError;
}

/**
 * Finished event payload with usage metadata
 */
export interface GeminiFinishedEventValue {
  reason: FinishReason | undefined;
  usageMetadata: GenerateContentResponseUsageMetadata | undefined;
}

/**
 * Tool call request information
 */
export interface ToolCallRequestInfo {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  isClientInitiated: boolean;
  prompt_id: string;
}

/**
 * Tool call response information
 */
export interface ToolCallResponseInfo {
  callId: string;
  responseParts: Part[];
  error: Error | undefined;
  outputFile?: string | undefined;
  contentLength?: number;
}

/**
 * Thought summary from model reasoning
 */
export interface ThoughtSummary {
  text: string;
  summary?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Event Type Definitions
// ─────────────────────────────────────────────────────────────────────

export type ServerGeminiContentEvent = {
  type: GeminiEventType.Content;
  value: string;
};

export type ServerGeminiThoughtEvent = {
  type: GeminiEventType.Thought;
  value: ThoughtSummary;
};

export type ServerGeminiToolCallRequestEvent = {
  type: GeminiEventType.ToolCallRequest;
  value: ToolCallRequestInfo;
};

export type ServerGeminiToolCallResponseEvent = {
  type: GeminiEventType.ToolCallResponse;
  value: ToolCallResponseInfo;
};

export type ServerGeminiUserCancelledEvent = {
  type: GeminiEventType.UserCancelled;
};

export type ServerGeminiErrorEvent = {
  type: GeminiEventType.Error;
  value: GeminiErrorEventValue;
};

export type ServerGeminiFinishedEvent = {
  type: GeminiEventType.Finished;
  value: GeminiFinishedEventValue;
};

export type ServerGeminiCitationEvent = {
  type: GeminiEventType.Citation;
  value: string;
};

export type ServerGeminiRetryEvent = {
  type: GeminiEventType.Retry;
};

export type ServerGeminiInvalidStreamEvent = {
  type: GeminiEventType.InvalidStream;
};

/**
 * Union of all possible stream events from LiteTurn
 */
export type ServerGeminiStreamEvent =
  | ServerGeminiCitationEvent
  | ServerGeminiContentEvent
  | ServerGeminiErrorEvent
  | ServerGeminiFinishedEvent
  | ServerGeminiThoughtEvent
  | ServerGeminiToolCallRequestEvent
  | ServerGeminiToolCallResponseEvent
  | ServerGeminiUserCancelledEvent
  | ServerGeminiRetryEvent
  | ServerGeminiInvalidStreamEvent;
