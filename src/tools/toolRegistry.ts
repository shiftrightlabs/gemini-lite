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
 * ToolRegistry - Manages available tools for gemini-lite
 *
 * This is a minimal registry that only contains read-only tools.
 * Unlike gemini-cli, there is no need for kind filtering because
 * mutation tools are physically absent from the codebase.
 */

import type { FunctionDeclaration } from '@google/generative-ai';
import type { Tool, ToolConfig } from './toolBase.js';
import { toolToFunctionDeclaration } from './toolBase.js';
import { ReadFileTool } from './readFile.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import { ListDirectoryTool } from './listDirectory.js';

/**
 * ToolRegistry manages the set of available tools
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor(private readonly config: ToolConfig) {
    this.registerDefaultTools();
  }

  /**
   * Registers default read-only tools
   */
  private registerDefaultTools(): void {
    this.addTool(new ReadFileTool(this.config));
    this.addTool(new GlobTool(this.config));
    this.addTool(new GrepTool(this.config));
    this.addTool(new ListDirectoryTool(this.config));
  }

  /**
   * Adds a tool to the registry
   */
  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Gets a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Gets all tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Gets tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Converts tools to Gemini API function declarations
   */
  toFunctionDeclarations(): FunctionDeclaration[] {
    return this.getAllTools().map(toolToFunctionDeclaration);
  }

  /**
   * Executes a tool by name
   */
  async executeTool(
    name: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return tool.execute(params, signal);
  }
}
