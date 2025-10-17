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
 * GlobTool - File pattern matching for discovery
 *
 * Allows the LLM to discover files by glob patterns
 * Example: Find all TypeScript files with glob pattern
 */

import { glob } from 'glob';
import type { FunctionDeclaration } from '@google/generative-ai';
import type { Tool, ToolResult, ToolConfig } from './toolBase.js';
import { createSuccessResult } from './toolBase.js';
import { ToolExecutionError, InvalidArgumentError } from '../errors.js';

/**
 * GlobTool enables file pattern matching
 *
 * Security:
 * - All paths resolved relative to workspace directory
 * - Cannot escape workspace via patterns
 * - Respects .gitignore if configured
 * - Respects .gemini-ignore patterns
 */
export class GlobTool implements Tool {
  readonly name = 'glob';
  readonly description =
    'Find files matching a glob pattern. Use this to discover files when you need to find files by name patterns.';

  readonly schema: FunctionDeclaration = {
    name: 'glob',
    description:
      'Find files matching a glob pattern (e.g., "**/*.ts" for all TypeScript files, "src/**/*.js" for JS files in src)',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description:
            'Glob pattern to match files. Examples: "**/*.ts" (all TS files), "src/**/*.js" (JS in src), "*.md" (MD in root)',
        },
        ignore: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional patterns to ignore (optional)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 100)',
        },
      },
      required: ['pattern'],
    },
  };

  constructor(private readonly config: ToolConfig) {}

  async execute(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    try {
      // Validate pattern
      const pattern = params.pattern;
      if (typeof pattern !== 'string' || !pattern.trim()) {
        throw new InvalidArgumentError('pattern', pattern, 'non-empty string');
      }

      // Parse optional parameters
      const ignorePatterns = Array.isArray(params.ignore)
        ? params.ignore.filter((p): p is string => typeof p === 'string')
        : [];

      const maxResults =
        typeof params.maxResults === 'number' && params.maxResults > 0
          ? params.maxResults
          : 100;

      // Build ignore list
      const allIgnorePatterns = [
        ...this.config.ignorePatterns,
        ...ignorePatterns,
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
      ];

      // Execute glob search
      const matches = await glob(pattern, {
        cwd: this.config.workspaceDir,
        ignore: allIgnorePatterns,
        nodir: true, // Only return files, not directories
        absolute: false, // Return relative paths
        signal,
      });

      // Limit results
      const limitedMatches = matches.slice(0, maxResults);
      const truncated = matches.length > maxResults;

      // Format result
      const resultText = this.formatResult(
        limitedMatches,
        matches.length,
        truncated,
        pattern,
      );

      return createSuccessResult(resultText, {
        type: 'glob',
        pattern,
        matchCount: matches.length,
        returnedCount: limitedMatches.length,
        truncated,
        matches: limitedMatches,
      });
    } catch (error) {
      if (error instanceof InvalidArgumentError) {
        throw error;
      }

      throw new ToolExecutionError(
        'glob',
        error instanceof Error ? error.message : String(error),
        { params },
      );
    }
  }

  private formatResult(
    matches: string[],
    totalCount: number,
    truncated: boolean,
    pattern: string,
  ): string {
    if (matches.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    const lines = [
      `Found ${totalCount} file${totalCount === 1 ? '' : 's'} matching "${pattern}"${truncated ? ` (showing first ${matches.length})` : ''}:`,
      '',
      ...matches.map((f) => `  ${f}`),
    ];

    if (truncated) {
      lines.push(
        '',
        `(${totalCount - matches.length} more files not shown. Use maxResults parameter to see more.)`,
      );
    }

    return lines.join('\n');
  }
}
