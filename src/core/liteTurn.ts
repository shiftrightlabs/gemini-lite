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
 * This file is derived from the Gemini CLI Turn class
 * (https://github.com/google/gemini-cli), Copyright 2024-2025 Google LLC,
 * licensed under the Apache License 2.0.
 */

/**
 * LiteTurn - Simplified agentic loop for gemini-lite
 *
 * Forked from gemini-cli Turn class with the following changes:
 * - REMOVED: MCP server support
 * - REMOVED: Interactive approval/confirmation workflow
 * - REMOVED: Chat compression features
 * - REMOVED: Loop detection
 * - REMOVED: Max session turns tracking
 * - KEPT: Core async generator pattern
 * - KEPT: ServerGeminiStreamEvent yielding
 * - KEPT: Tool call request handling
 * - KEPT: Read-only tool execution
 *
 * CRITICAL: This file is INDEPENDENT - no dependencies on gemini-cli core
 */

import type {
  Part,
  GenerateContentResponse,
  FunctionCall,
  FinishReason,
  EnhancedGenerateContentResponse,
  CitationSource,
} from '@google/generative-ai';
import type {
  ServerGeminiStreamEvent,
  ToolCallRequestInfo,
  ThoughtSummary,
  StructuredError,
} from './events.js';
import { GeminiEventType } from './events.js';

/**
 * Minimal chat interface required by LiteTurn
 * This will be implemented by LiteChat
 */
export interface ILiteChat {
  sendMessageStream(
    model: string,
    request: { message: string | Array<string | Part>; config?: { abortSignal?: AbortSignal } },
    prompt_id: string,
  ): Promise<AsyncIterable<StreamEvent>>;
}

/**
 * Stream event from the Gemini API
 */
export type StreamEvent =
  | { type: 'retry' }
  | { type: 'chunk'; value: GenerateContentResponse };

/**
 * Custom error for invalid/truncated streams
 */
export class InvalidStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStreamError';
  }
}

/**
 * LiteTurn manages a single agentic loop turn
 *
 * The LLM autonomously requests file reads via tool calls.
 * This class processes the stream and yields events.
 */
export class LiteTurn {
  readonly pendingToolCalls: ToolCallRequestInfo[] = [];
  private debugResponses: GenerateContentResponse[] = [];
  private pendingCitations = new Set<string>();
  finishReason: FinishReason | undefined = undefined;

  constructor(
    private readonly chat: ILiteChat,
    private readonly prompt_id: string,
  ) {}

  /**
   * Runs the agentic loop turn
   *
   * Yields ServerGeminiStreamEvent objects as the model responds:
   * - Content: Text response chunks
   * - ToolCallRequest: Model autonomously requests tool execution
   * - Thought: Model's internal reasoning
   * - Citation: Source citations
   * - Finished: Response complete with usage metadata
   * - Error: An error occurred
   * - UserCancelled: Request was aborted
   */
  async *run(
    model: string,
    req: string | Array<string | Part>,
    signal: AbortSignal,
  ): AsyncGenerator<ServerGeminiStreamEvent> {
    try {
      const responseStream = await this.chat.sendMessageStream(
        model,
        {
          message: req,
          config: {
            abortSignal: signal,
          },
        },
        this.prompt_id,
      );

      for await (const streamEvent of responseStream) {
        // Check for cancellation
        if (signal?.aborted) {
          yield { type: GeminiEventType.UserCancelled };
          return;
        }

        // Handle retry events
        if (streamEvent.type === 'retry') {
          yield { type: GeminiEventType.Retry };
          continue;
        }

        // Process response chunk
        const resp = streamEvent.value as GenerateContentResponse;
        if (!resp) continue;

        this.debugResponses.push(resp);

        // Handle thought parts (model's internal reasoning)
        const thoughtPart = resp.candidates?.[0]?.content?.parts?.[0];
        if (thoughtPart && 'thought' in thoughtPart) {
          const thought = this.parseThought(thoughtPart.text ?? '');
          yield {
            type: GeminiEventType.Thought,
            value: thought,
          };
          continue;
        }

        // Extract text content
        const text = this.getResponseText(resp);
        if (text) {
          yield { type: GeminiEventType.Content, value: text };
        }

        // Handle function calls (tool requests from the model)
        const functionCalls = (resp as EnhancedGenerateContentResponse).functionCalls?.() ?? [];
        for (const fnCall of functionCalls) {
          const event = this.handlePendingFunctionCall(fnCall);
          if (event) {
            yield event;
          }
        }

        // Collect citations
        for (const citation of this.getCitations(resp)) {
          this.pendingCitations.add(citation);
        }

        // Check for finish reason
        const finishReason = resp.candidates?.[0]?.finishReason;
        if (finishReason) {
          // Yield any pending citations
          if (this.pendingCitations.size > 0) {
            yield {
              type: GeminiEventType.Citation,
              value: `Citations:\n${[...this.pendingCitations].sort().join('\n')}`,
            };
            this.pendingCitations.clear();
          }

          this.finishReason = finishReason;
          yield {
            type: GeminiEventType.Finished,
            value: {
              reason: finishReason,
              usageMetadata: resp.usageMetadata,
            },
          };
        }
      }
    } catch (e) {
      // Handle cancellation
      if (signal.aborted) {
        yield { type: GeminiEventType.UserCancelled };
        return;
      }

      // Handle invalid stream errors
      if (e instanceof InvalidStreamError) {
        yield { type: GeminiEventType.InvalidStream };
        return;
      }

      // Handle other errors
      const errorMessage = e instanceof Error ? e.message : String(e);
      const status =
        typeof e === 'object' &&
        e !== null &&
        'status' in e &&
        typeof (e as { status: unknown }).status === 'number'
          ? (e as { status: number }).status
          : undefined;

      const structuredError: StructuredError = {
        message: errorMessage,
        status,
      };

      yield { type: GeminiEventType.Error, value: { error: structuredError } };
      return;
    }
  }

  /**
   * Handles a function call from the model
   * Creates a ToolCallRequest event
   */
  private handlePendingFunctionCall(
    fnCall: FunctionCall,
  ): ServerGeminiStreamEvent | null {
    const callId = `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const name = fnCall.name || 'undefined_tool_name';
    const args = (fnCall.args || {}) as Record<string, unknown>;

    const toolCallRequest: ToolCallRequestInfo = {
      callId,
      name,
      args,
      isClientInitiated: false,
      prompt_id: this.prompt_id,
    };

    this.pendingToolCalls.push(toolCallRequest);

    return { type: GeminiEventType.ToolCallRequest, value: toolCallRequest };
  }

  /**
   * Extracts text content from response
   */
  private getResponseText(resp: GenerateContentResponse): string | null {
    const parts = resp.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    let text = '';
    for (const part of parts) {
      if ('text' in part && part.text) {
        text += part.text;
      }
    }

    return text || null;
  }

  /**
   * Extracts citations from response
   */
  private getCitations(resp: GenerateContentResponse): string[] {
    const citationSources = resp.candidates?.[0]?.citationMetadata?.citationSources ?? [];
    return citationSources
      .filter((citation: CitationSource) => citation.uri !== undefined)
      .map((citation: CitationSource) => {
        if ('title' in citation && citation.uri) {
          return `(${(citation as { title?: string }).title}) ${citation.uri}`;
        }
        return citation.uri!;
      });
  }

  /**
   * Parses thought text into a summary
   */
  private parseThought(text: string): ThoughtSummary {
    // Simple parsing - extract first line as summary
    const lines = text.split('\n').filter((line) => line.trim());
    return {
      text,
      summary: lines[0] || text.substring(0, 100),
    };
  }

  /**
   * Gets debug responses for troubleshooting
   */
  getDebugResponses(): GenerateContentResponse[] {
    return this.debugResponses;
  }
}
