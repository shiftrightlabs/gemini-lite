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
 * ListDirectoryTool - Directory listing
 *
 * Allows the LLM to explore directory structure
 * Example: "What's in the src/ directory?" -> list_directory "src"
 */

import { readdir, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import type { Tool, ToolResult, ToolConfig } from './toolBase.js';
import { createSuccessResult } from './toolBase.js';
import {
  ToolExecutionError,
  InvalidArgumentError,
  FileOutsideWorkspaceError,
  DirectoryListError,
} from '../errors.js';
import { validatePathWithinWorkspace } from '../validation.js';

interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

/**
 * ListDirectoryTool enables directory exploration
 *
 * Security:
 * - All paths must be within workspace directory
 * - Path traversal attempts are rejected
 * - Respects ignore patterns
 */
export class ListDirectoryTool implements Tool {
  readonly name = 'list_directory';
  readonly description =
    'List contents of a directory. Use this to explore the directory structure and see what files/folders exist.';

  readonly schema: FunctionDeclaration = {
    name: 'list_directory',
    description:
      'List files and directories in a given path. Returns names and types (file/directory).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: {
          type: SchemaType.STRING,
          description:
            'Directory path to list (relative to workspace root). Examples: ".", "src", "src/components"',
        },
        recursive: {
          type: SchemaType.BOOLEAN,
          description:
            'Whether to list recursively (default: false). Use with caution in large directories.',
        },
        showHidden: {
          type: SchemaType.BOOLEAN,
          description: 'Whether to show hidden files/directories (default: false)',
        },
        maxDepth: {
          type: SchemaType.NUMBER,
          description:
            'Maximum depth for recursive listing (default: 2, max: 5)',
        },
      },
      required: ['path'],
    },
  };

  constructor(private readonly config: ToolConfig) {}

  async execute(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    try {
      // Validate path
      const path = params['path'];
      if (typeof path !== 'string') {
        throw new InvalidArgumentError('path', 'string', path);
      }

      // Resolve path
      const absolutePath = resolve(this.config.workspaceDir, path);

      // Validate within workspace
      const validation = validatePathWithinWorkspace(
        absolutePath,
        this.config.workspaceDir,
      );
      if (!validation.valid) {
        throw new FileOutsideWorkspaceError(path, this.config.workspaceDir);
      }

      // Parse optional parameters
      const recursive = params['recursive'] === true;
      const showHidden = params['showHidden'] === true;
      const maxDepth =
        typeof params['maxDepth'] === 'number' && params['maxDepth'] > 0
          ? Math.min(params['maxDepth'], 5)
          : 2;

      // Check if directory exists
      let dirStat;
      try {
        dirStat = await stat(absolutePath);
      } catch (_error) {
        throw new DirectoryListError(
          path,
          `Directory does not exist: ${path}`,
        );
      }

      if (!dirStat.isDirectory()) {
        throw new DirectoryListError(path, `Path is not a directory: ${path}`);
      }

      // List directory
      const entries = recursive
        ? await this.listRecursive(
            absolutePath,
            showHidden,
            maxDepth,
            0,
            signal,
          )
        : await this.listSingle(absolutePath, showHidden, signal);

      // Format result
      const resultText = this.formatResult(
        entries,
        path,
        recursive,
        maxDepth,
      );

      return createSuccessResult(resultText, {
        type: 'directory',
        path,
        entryCount: entries.length,
        recursive,
        entries: entries.map((e) => ({
          name: e.name,
          type: e.type,
        })),
      });
    } catch (error) {
      if (
        error instanceof InvalidArgumentError ||
        error instanceof FileOutsideWorkspaceError ||
        error instanceof DirectoryListError
      ) {
        throw error;
      }

      throw new ToolExecutionError(
        'list_directory',
        error instanceof Error ? error.message : String(error),
        { params },
      );
    }
  }

  private async listSingle(
    dirPath: string,
    showHidden: boolean,
    signal?: AbortSignal,
  ): Promise<DirectoryEntry[]> {
    const entries: DirectoryEntry[] = [];

    const items = await readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (signal?.aborted) break;

      // Skip hidden files/directories unless requested
      if (!showHidden && item.name.startsWith('.')) {
        continue;
      }

      // Skip ignored patterns
      if (this.shouldIgnore(item.name)) {
        continue;
      }

      const entry: DirectoryEntry = {
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
      };

      // Get file size if it's a file
      if (item.isFile()) {
        try {
          const filePath = join(dirPath, item.name);
          const fileStat = await stat(filePath);
          entry.size = fileStat.size;
        } catch {
          // Ignore if we can't stat the file
        }
      }

      entries.push(entry);
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    return entries;
  }

  private async listRecursive(
    dirPath: string,
    showHidden: boolean,
    maxDepth: number,
    currentDepth: number,
    signal?: AbortSignal,
  ): Promise<DirectoryEntry[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const entries: DirectoryEntry[] = [];
    const items = await readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (signal?.aborted) break;

      // Skip hidden files/directories unless requested
      if (!showHidden && item.name.startsWith('.')) {
        continue;
      }

      // Skip ignored patterns
      if (this.shouldIgnore(item.name)) {
        continue;
      }

      const relativePath = relative(
        this.config.workspaceDir,
        join(dirPath, item.name),
      );

      const entry: DirectoryEntry = {
        name: relativePath,
        type: item.isDirectory() ? 'directory' : 'file',
      };

      if (item.isFile()) {
        try {
          const filePath = join(dirPath, item.name);
          const fileStat = await stat(filePath);
          entry.size = fileStat.size;
        } catch {
          // Ignore if we can't stat the file
        }
      }

      entries.push(entry);

      // Recurse into directories
      if (item.isDirectory()) {
        const subEntries = await this.listRecursive(
          join(dirPath, item.name),
          showHidden,
          maxDepth,
          currentDepth + 1,
          signal,
        );
        entries.push(...subEntries);
      }
    }

    return entries;
  }

  private shouldIgnore(name: string): boolean {
    const commonIgnore = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.nyc_output',
      '__pycache__',
      '.pytest_cache',
      '.DS_Store',
    ];

    return commonIgnore.includes(name);
  }

  private formatResult(
    entries: DirectoryEntry[],
    path: string,
    recursive: boolean,
    maxDepth: number,
  ): string {
    if (entries.length === 0) {
      return `Directory "${path}" is empty`;
    }

    const lines = [
      `Contents of "${path}"${recursive ? ` (recursive, depth ${maxDepth})` : ''}:`,
      '',
    ];

    if (recursive) {
      // Group by directory for recursive listing
      const byDirectory = new Map<string, DirectoryEntry[]>();

      for (const entry of entries) {
        const dir = entry.name.includes('/')
          ? entry.name.substring(0, entry.name.lastIndexOf('/'))
          : '.';

        if (!byDirectory.has(dir)) {
          byDirectory.set(dir, []);
        }
        byDirectory.get(dir)!.push(entry);
      }

      for (const [dir, dirEntries] of Array.from(byDirectory.entries()).sort(
        (a, b) => a[0].localeCompare(b[0]),
      )) {
        if (dir !== '.') {
          lines.push(`${dir}/:`);
        }
        for (const entry of dirEntries) {
          const name = entry.name.includes('/')
            ? entry.name.substring(entry.name.lastIndexOf('/') + 1)
            : entry.name;
          lines.push(
            `  ${entry.type === 'directory' ? '[DIR]' : '[FILE]'} ${name}${entry.size !== undefined ? ` (${this.formatSize(entry.size)})` : ''}`,
          );
        }
        lines.push('');
      }
    } else {
      // Simple listing for non-recursive
      for (const entry of entries) {
        lines.push(
          `  ${entry.type === 'directory' ? '[DIR]' : '[FILE]'} ${entry.name}${entry.size !== undefined ? ` (${this.formatSize(entry.size)})` : ''}`,
        );
      }
    }

    return lines.join('\n');
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}
