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
 * ReadFileTool - Read file contents (read-only)
 *
 * Simplified from gemini-cli - verified read-only
 */

import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import type { Tool, ToolConfig, ToolResult } from './toolBase.js';
import { createSuccessResult, createErrorResult } from './toolBase.js';
import { validatePathWithinWorkspace } from '../validation.js';
import { FileNotFoundError, FileOutsideWorkspaceError, FileReadError } from '../errors.js';

/**
 * ReadFileTool reads file contents from the workspace
 *
 * Security:
 * - Only reads files within workspace directory
 * - Validates paths to prevent traversal attacks
 * - Read-only operation (cannot modify files)
 */
export class ReadFileTool implements Tool {
  readonly name = 'read_file';
  readonly description = 'Read the contents of a file within the workspace';

  readonly schema: FunctionDeclaration = {
    name: 'read_file',
    description: 'Read the contents of a file. Use this tool to examine source code, configuration files, or any text file within the workspace.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        file_path: {
          type: SchemaType.STRING,
          description: 'Path to the file to read (relative or absolute within workspace)',
        },
        encoding: {
          type: SchemaType.STRING,
          description: 'File encoding (default: utf-8)',
          enum: ['utf-8', 'ascii', 'base64'],
        },
      },
      required: ['file_path'],
    },
  };

  constructor(private readonly config: ToolConfig) {}

  async execute(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    try {
      // Extract and validate parameters
      const filePath = params['file_path'];
      if (typeof filePath !== 'string') {
        return createErrorResult('file_path must be a string');
      }

      const encoding = (params['encoding'] as string) || 'utf-8';
      if (!['utf-8', 'ascii', 'base64'].includes(encoding)) {
        return createErrorResult('Invalid encoding. Must be utf-8, ascii, or base64');
      }

      // Resolve to absolute path
      const absolutePath = resolve(this.config.workspaceDir, filePath);

      // Validate path is within workspace
      const validation = validatePathWithinWorkspace(absolutePath, this.config.workspaceDir);
      if (!validation.valid) {
        throw new FileOutsideWorkspaceError(filePath, this.config.workspaceDir);
      }

      // Check for cancellation
      if (signal?.aborted) {
        return createErrorResult('Operation cancelled');
      }

      // Read file
      const content = await readFile(absolutePath, encoding as BufferEncoding);

      // Get relative path for display
      const displayPath = relative(this.config.workspaceDir, absolutePath);

      return createSuccessResult(
        content,
        {
          type: 'file',
          content: `Read ${content.length} characters from ${displayPath}`,
          filePath: displayPath,
        },
      );
    } catch (error) {
      if (error instanceof FileOutsideWorkspaceError) {
        return createErrorResult(error.message);
      }

      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          return createErrorResult(new FileNotFoundError(params['file_path'] as string));
        }
        return createErrorResult(new FileReadError(params['file_path'] as string, error));
      }

      return createErrorResult('Unknown error reading file');
    }
  }
}
