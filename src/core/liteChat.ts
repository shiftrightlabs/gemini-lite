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
 * This file is derived from patterns in the Gemini CLI GeminiChat class
 * (https://github.com/google/gemini-cli), Copyright 2024-2025 Google LLC,
 * licensed under the Apache License 2.0.
 */

/**
 * LiteChat - Minimal chat wrapper for gemini-lite
 *
 * This is a simplified, standalone implementation that wraps @google/generative-ai
 * directly without depending on gemini-cli-core's GeminiChat.
 *
 * Key differences from gemini-cli GeminiChat:
 * - No MCP server support
 * - No interactive features
 * - No context compression
 * - Read-only tools only
 * - Minimal API surface
 */

import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type GenerateContentRequest,
  type GenerateContentResponse,
  type Part,
  type FunctionDeclaration,
} from '@google/generative-ai';
import type { ILiteChat, StreamEvent } from './liteTurn.js';
import { InvalidStreamError } from './liteTurn.js';

/**
 * Configuration for LiteChat
 */
export interface LiteChatConfig {
  apiKey: string;
  model: string;
  systemInstruction?: string;
  tools?: FunctionDeclaration[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * LiteChat manages chat sessions with the Gemini API
 *
 * This is a minimal wrapper around @google/generative-ai that:
 * 1. Maintains chat history
 * 2. Streams responses
 * 3. Handles tool calls
 * 4. Provides error handling
 */
export class LiteChat implements ILiteChat {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly config: LiteChatConfig;
  private model: GenerativeModel | null = null;
  private history: Array<{ role: string; parts: Part[] }> = [];

  constructor(config: LiteChatConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model;
  }

  /**
   * Sends a message and streams the response
   *
   * This is called by LiteTurn to get the response stream from the API
   */
  async sendMessageStream(
    model: string,
    request: { message: string | Array<string | Part>; config?: { abortSignal?: AbortSignal } },
    _prompt_id: string,
  ): Promise<AsyncIterable<StreamEvent>> {
    const generativeModel = this.getOrCreateModel(model);

    try {
      // Convert message to API format
      const contents = this.buildContents(request.message);

      // Create generate content request
      const generateRequest: GenerateContentRequest = {
        contents,
        generationConfig: {
          maxOutputTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        },
      };

      // Call API with streaming
      const result = await generativeModel.generateContentStream(generateRequest);

      // Return async iterable that yields our StreamEvent format
      return this.convertToStreamEvents(result.stream);
    } catch (error) {
      // Re-throw with better error context
      throw new Error(`Chat stream failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Converts the Gemini API stream to our StreamEvent format
   */
  private async *convertToStreamEvents(
    stream: AsyncIterable<GenerateContentResponse>,
  ): AsyncGenerator<StreamEvent> {
    try {
      for await (const chunk of stream) {
        yield { type: 'chunk', value: chunk };
      }
    } catch (error) {
      // Handle stream errors
      if (error instanceof Error && error.message.includes('truncated')) {
        throw new InvalidStreamError('Response stream was truncated');
      }
      throw error;
    }
  }

  /**
   * Gets or creates the generative model instance
   */
  private getOrCreateModel(modelName: string): GenerativeModel {
    if (!this.model || this.modelName !== modelName) {
      const modelConfig: {
        model: string;
        systemInstruction?: string;
        tools?: Array<{ functionDeclarations: FunctionDeclaration[] }>;
      } = {
        model: modelName,
      };

      // Add system instruction if provided
      if (this.config.systemInstruction) {
        modelConfig.systemInstruction = this.config.systemInstruction;
      }

      // Add tools if provided
      if (this.config.tools && this.config.tools.length > 0) {
        modelConfig.tools = [{ functionDeclarations: this.config.tools }];
      }

      this.model = this.genAI.getGenerativeModel(modelConfig);
    }

    return this.model;
  }

  /**
   * Builds contents array from message
   */
  private buildContents(message: string | Array<string | Part>): Array<{ role: string; parts: Part[] }> {
    // Add history
    const contents = [...this.history];

    // Add current message
    if (Array.isArray(message)) {
      // Filter out strings and convert to Part objects
      const parts: Part[] = message.map(item =>
        typeof item === 'string' ? { text: item } : item
      );
      contents.push({ role: 'user', parts });
    } else if (typeof message === 'string') {
      contents.push({ role: 'user', parts: [{ text: message }] });
    } else {
      contents.push({ role: 'user', parts: [message] });
    }

    return contents;
  }

  /**
   * Adds a message to history
   */
  addToHistory(role: 'user' | 'model', parts: Part[]): void {
    this.history.push({ role, parts });
  }

  /**
   * Clears chat history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Gets current history (for debugging)
   */
  getHistory(_curated?: boolean): Array<{ role: string; parts: Part[] }> {
    return this.history;
  }
}
