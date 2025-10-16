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
 */

/**
 * Base tool types for gemini-lite
 *
 * Simplified from gemini-cli - read-only tools only
 */

import type { FunctionDeclaration, Part } from '@google/generative-ai';

/**
 * Result from tool execution
 */
export interface ToolResult {
  /** Parts to send back to the model */
  parts: Part[];
  /** Whether the tool executed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Optional display information */
  display?: ToolResultDisplay;
}

/**
 * Display information for tool results
 */
export interface ToolResultDisplay {
  /** Type of display */
  type: 'text' | 'json' | 'file';
  /** Content to display */
  content: string;
  /** Optional file path */
  filePath?: string;
}

/**
 * Base interface for all tools
 */
export interface Tool {
  /** Unique tool name */
  name: string;

  /** Tool description for the model */
  description: string;

  /** Function declaration for Gemini API */
  schema: FunctionDeclaration;

  /**
   * Execute the tool
   * @param params Parameters from the model
   * @param signal Abort signal for cancellation
   * @returns Tool execution result
   */
  execute(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult>;
}

/**
 * Configuration interface for tools
 */
export interface ToolConfig {
  /** Workspace directory for file operations */
  workspaceDir: string;
  /** Whether to respect .gitignore patterns */
  respectGitignore?: boolean;
  /** Additional patterns to ignore */
  ignorePatterns?: string[];
}

/**
 * Converts a Tool to Gemini API function declaration
 */
export function toolToFunctionDeclaration(tool: Tool): FunctionDeclaration {
  return tool.schema;
}

/**
 * Creates a successful tool result
 */
export function createSuccessResult(
  content: string,
  display?: ToolResultDisplay,
): ToolResult {
  return {
    parts: [{ text: content }],
    success: true,
    display,
  };
}

/**
 * Creates an error tool result
 */
export function createErrorResult(error: string | Error): ToolResult {
  const message = error instanceof Error ? error.message : error;
  return {
    parts: [{ text: `Error: ${message}` }],
    success: false,
    error: message,
  };
}
