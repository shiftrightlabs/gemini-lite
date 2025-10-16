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
 * GrepTool - Content search across files
 *
 * Allows the LLM to search for patterns within file contents
 * Example: "Find files containing 'TODO'" -> grep "TODO"
 */

import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { glob } from 'glob';
import type { FunctionDeclaration } from '@google/generative-ai';
import type { Tool, ToolResult, ToolConfig } from './toolBase.js';
import { createSuccessResult, createErrorResult } from './toolBase.js';
import { ToolExecutionError, InvalidArgumentError } from '../errors.js';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * GrepTool enables content search across files
 *
 * Security:
 * - Searches only within workspace directory
 * - Respects ignore patterns
 * - Limits results to prevent overwhelming output
 */
export class GrepTool implements Tool {
  readonly name = 'grep';
  readonly description =
    'Search for a pattern in file contents. Use this to find files containing specific text or code patterns.';

  readonly schema: FunctionDeclaration = {
    name: 'grep',
    description:
      'Search for text pattern in files. Returns matching lines with file paths and line numbers.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description:
            'Text or regex pattern to search for. Examples: "TODO", "function.*async", "import React"',
        },
        filePattern: {
          type: 'string',
          description:
            'Glob pattern to limit which files to search (default: "**/*"). Examples: "**/*.ts", "src/**/*.js"',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Whether search is case-sensitive (default: false)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matches to return (default: 50)',
        },
        contextLines: {
          type: 'number',
          description:
            'Number of lines before/after match to include (default: 0)',
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
      const filePattern =
        typeof params.filePattern === 'string' && params.filePattern.trim()
          ? params.filePattern
          : '**/*';

      const caseSensitive = params.caseSensitive === true;

      const maxResults =
        typeof params.maxResults === 'number' && params.maxResults > 0
          ? params.maxResults
          : 50;

      const contextLines =
        typeof params.contextLines === 'number' && params.contextLines >= 0
          ? Math.min(params.contextLines, 5) // Max 5 lines context
          : 0;

      // Build regex
      const flags = caseSensitive ? 'g' : 'gi';
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags);
      } catch (error) {
        throw new InvalidArgumentError(
          'pattern',
          pattern,
          'valid regex pattern',
        );
      }

      // Find files to search
      const allIgnorePatterns = [
        ...this.config.ignorePatterns,
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/*.min.js',
        '**/*.map',
        '**/*.lock',
        '**/package-lock.json',
        '**/yarn.lock',
      ];

      const files = await glob(filePattern, {
        cwd: this.config.workspaceDir,
        ignore: allIgnorePatterns,
        nodir: true,
        absolute: false,
        signal,
      });

      // Search files
      const matches: GrepMatch[] = [];
      let filesSearched = 0;
      let filesWithMatches = 0;

      for (const file of files) {
        if (signal?.aborted) break;
        if (matches.length >= maxResults) break;

        try {
          const absolutePath = resolve(this.config.workspaceDir, file);
          const content = await readFile(absolutePath, 'utf-8');
          const lines = content.split('\n');

          filesSearched++;

          let fileHasMatches = false;
          for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
            const line = lines[i];
            const match = regex.exec(line);

            if (match) {
              fileHasMatches = true;
              matches.push({
                file,
                line: i + 1, // 1-indexed
                content: line.trim(),
                matchStart: match.index,
                matchEnd: match.index + match[0].length,
              });

              // Reset regex for next search
              regex.lastIndex = 0;
            }
          }

          if (fileHasMatches) {
            filesWithMatches++;
          }
        } catch (error) {
          // Skip files that can't be read (binary, permission issues, etc.)
          continue;
        }
      }

      // Format result
      const resultText = this.formatResult(
        matches,
        filesSearched,
        filesWithMatches,
        pattern,
        maxResults,
      );

      return createSuccessResult(resultText, {
        type: 'grep',
        pattern,
        filesSearched,
        filesWithMatches,
        matchCount: matches.length,
        truncated: matches.length >= maxResults,
        matches: matches.map((m) => ({
          file: m.file,
          line: m.line,
          content: m.content,
        })),
      });
    } catch (error) {
      if (error instanceof InvalidArgumentError) {
        throw error;
      }

      throw new ToolExecutionError(
        'grep',
        error instanceof Error ? error.message : String(error),
        { params },
      );
    }
  }

  private formatResult(
    matches: GrepMatch[],
    filesSearched: number,
    filesWithMatches: number,
    pattern: string,
    maxResults: number,
  ): string {
    if (matches.length === 0) {
      return `No matches found for pattern "${pattern}" (searched ${filesSearched} files)`;
    }

    const lines = [
      `Found ${matches.length} match${matches.length === 1 ? '' : 'es'} in ${filesWithMatches} file${filesWithMatches === 1 ? '' : 's'} (searched ${filesSearched} files):`,
      '',
    ];

    // Group matches by file
    const byFile = new Map<string, GrepMatch[]>();
    for (const match of matches) {
      if (!byFile.has(match.file)) {
        byFile.set(match.file, []);
      }
      byFile.get(match.file)!.push(match);
    }

    // Format each file's matches
    for (const [file, fileMatches] of byFile) {
      lines.push(`${file}:`);
      for (const match of fileMatches) {
        lines.push(`  ${match.line}: ${match.content}`);
      }
      lines.push('');
    }

    if (matches.length >= maxResults) {
      lines.push(
        `(More matches may exist. Showing first ${maxResults} results.)`,
      );
    }

    return lines.join('\n');
  }
}
