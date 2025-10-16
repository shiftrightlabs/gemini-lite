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
 * LiteConfig - Configuration management for gemini-lite
 *
 * This is a standalone configuration class (not extending gemini-cli Config)
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { LiteConfigInput } from './types.js';
import { validateLiteConfig } from './validation.js';
import { ConfigurationError } from './errors.js';
import type { ToolConfig } from './tools/toolBase.js';
import { ToolRegistry } from './tools/toolRegistry.js';

/**
 * LiteConfig manages configuration for gemini-lite
 *
 * Configuration priority (highest to lowest):
 * 1. Constructor input
 * 2. Workspace config (.gemini-lite.json)
 * 3. User config (~/.gemini-lite/config.json)
 * 4. Environment variables
 * 5. Defaults
 */
export class LiteConfig {
  private readonly apiKey: string;
  private readonly workspaceDir: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly enableWebTools: boolean;
  private readonly respectGitignore: boolean;
  private readonly geminiIgnorePatterns: string[];
  private readonly contextFiles: string[];
  private readonly maxContextFiles: number;
  private readonly maxSessionTurns: number;
  private readonly timeout: number;
  private readonly debug: boolean;
  private readonly systemInstruction: string;
  private toolRegistry: ToolRegistry | null = null;

  private constructor(config: Required<Omit<LiteConfigInput, 'auth'>> & { auth: LiteConfigInput['auth'] }) {
    // Extract API key from auth config
    if (config.auth.apiKey) {
      this.apiKey = config.auth.apiKey;
    } else if (config.auth.vertexAI) {
      // For now, we'll require API key. Vertex AI support can be added later.
      throw new ConfigurationError('Vertex AI is not yet supported. Please use apiKey authentication.');
    } else {
      throw new ConfigurationError('API key is required');
    }

    this.workspaceDir = resolve(config.workspaceDir);
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
    this.enableWebTools = config.enableWebTools;
    this.respectGitignore = config.respectGitignore;
    this.geminiIgnorePatterns = config.geminiIgnorePatterns;
    this.contextFiles = config.contextFiles;
    this.maxContextFiles = config.maxContextFiles;
    this.maxSessionTurns = config.maxSessionTurns;
    this.timeout = config.timeout;
    this.debug = config.debug;
    this.systemInstruction = this.generateSystemPrompt();
  }

  /**
   * Creates a LiteConfig instance with validation
   */
  static create(input: LiteConfigInput): LiteConfig {
    // Merge with file-based and environment configs
    const merged = this.mergeConfigs(input);

    // Validate
    const error = validateLiteConfig(merged);
    if (error) {
      throw new ConfigurationError(error);
    }

    // Apply defaults
    const withDefaults = this.applyDefaults(merged);

    return new LiteConfig(withDefaults);
  }

  /**
   * Merges configuration from multiple sources
   */
  private static mergeConfigs(input: LiteConfigInput): LiteConfigInput {
    const envConfig = this.loadEnvConfig();
    const userConfig = this.loadUserConfig();
    const workspaceConfig = this.loadWorkspaceConfig(input.workspaceDir);

    // Priority: input > workspace > user > env
    return {
      ...envConfig,
      ...userConfig,
      ...workspaceConfig,
      ...input,
    };
  }

  /**
   * Loads configuration from environment variables
   */
  private static loadEnvConfig(): Partial<LiteConfigInput> {
    const config: Partial<LiteConfigInput> = {};

    if (process.env.GEMINI_API_KEY) {
      config.auth = { apiKey: process.env.GEMINI_API_KEY };
    }

    if (process.env.GEMINI_MODEL) {
      config.model = process.env.GEMINI_MODEL;
    }

    return config;
  }

  /**
   * Loads user-level configuration
   */
  private static loadUserConfig(): Partial<LiteConfigInput> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) return {};

    const configPath = join(homeDir, '.gemini-lite', 'config.json');
    if (!existsSync(configPath)) return {};

    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Failed to parse user config: ${error}`);
      return {};
    }
  }

  /**
   * Loads workspace-level configuration
   */
  private static loadWorkspaceConfig(workspaceDir: string): Partial<LiteConfigInput> {
    const configPath = join(workspaceDir, '.gemini-lite.json');
    if (!existsSync(configPath)) return {};

    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Failed to parse workspace config: ${error}`);
      return {};
    }
  }

  /**
   * Applies default values
   */
  private static applyDefaults(
    config: LiteConfigInput,
  ): Required<Omit<LiteConfigInput, 'auth'>> & { auth: LiteConfigInput['auth'] } {
    return {
      auth: config.auth,
      workspaceDir: config.workspaceDir,
      model: config.model || 'gemini-2.0-flash-exp',
      maxTokens: config.maxTokens || 8192,
      temperature: config.temperature ?? 0.7,
      includeDirectories: config.includeDirectories || [],
      respectGitignore: config.respectGitignore ?? true,
      geminiIgnorePatterns: config.geminiIgnorePatterns || [],
      contextFiles: config.contextFiles || ['GEMINI.md', 'README.md'],
      maxContextFiles: config.maxContextFiles || 200,
      enableWebTools: config.enableWebTools ?? false,
      maxSessionTurns: config.maxSessionTurns || 20,
      timeout: config.timeout || 60000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Generates system prompt for the model
   */
  private generateSystemPrompt(): string {
    return `You are a read-only code analysis assistant powered by Gemini.

# Core Capabilities
- Read and analyze code files using tools
- Search for patterns and files autonomously
- Explain code functionality with context
- Review code for issues
- Summarize codebase structure

# Critical Operating Principle (AGENTIC DESIGN)
You must AUTONOMOUSLY discover and read files using the provided tools.
Files are NOT pre-loaded in your context. You must:
1. Use glob/grep to discover relevant files
2. Use read_file to read file contents
3. Analyze the content
4. Request additional files as needed

# Restrictions
- You CANNOT modify any files (read-only mode)
- You CANNOT execute shell commands
- You CANNOT write new files
- You CANNOT delete files
- All file operations are restricted to the workspace directory

# Available Tools
- read_file: Read file contents (use this after finding files!)
- glob: Find files by pattern (e.g., "**/*.ts" for all TypeScript files)
- grep: Search for text/patterns in files (e.g., find files containing "TODO")
- list_directory: List contents of a directory (e.g., see what's in "src/")
${this.enableWebTools ? '- web_fetch: Fetch web content\n- web_search: Search the web\n' : ''}

# Guidelines
1. **Always use tools to gather information** - Do not make assumptions about code you haven't read
2. **Start with file discovery** - Use glob or list_directory to find relevant files
3. **Search when needed** - Use grep to find files containing specific patterns
4. **Read files systematically** - Use read_file for each file you need to analyze
5. **Provide specific references** - Include file paths and line numbers in your analysis
6. **Request clarification** - If the user's request is ambiguous, ask before reading files
7. **Be thorough** - Read all relevant files, not just the first one you find

# Workflow Example
User: "Review the authentication module for security issues"
You should:
1. Use glob to find authentication-related files (e.g., "**/*auth*.ts")
2. Use read_file to read each discovered file
3. Analyze the code for security issues
4. Provide specific findings with file:line references
`.trim();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Public Getters
  // ─────────────────────────────────────────────────────────────────────

  getApiKey(): string {
    return this.apiKey;
  }

  getWorkspaceDir(): string {
    return this.workspaceDir;
  }

  getModel(): string {
    return this.model;
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }

  getTemperature(): number {
    return this.temperature;
  }

  getEnableWebTools(): boolean {
    return this.enableWebTools;
  }

  getRespectGitignore(): boolean {
    return this.respectGitignore;
  }

  getGeminiIgnorePatterns(): string[] {
    return this.geminiIgnorePatterns;
  }

  getContextFiles(): string[] {
    return this.contextFiles;
  }

  getMaxContextFiles(): number {
    return this.maxContextFiles;
  }

  getMaxSessionTurns(): number {
    return this.maxSessionTurns;
  }

  getTimeout(): number {
    return this.timeout;
  }

  getDebug(): boolean {
    return this.debug;
  }

  getSystemInstruction(): string {
    return this.systemInstruction;
  }

  /**
   * Gets or creates the tool registry
   */
  getToolRegistry(): ToolRegistry {
    if (!this.toolRegistry) {
      const toolConfig: ToolConfig = {
        workspaceDir: this.workspaceDir,
        respectGitignore: this.respectGitignore,
        ignorePatterns: this.geminiIgnorePatterns,
      };
      this.toolRegistry = new ToolRegistry(toolConfig);
    }
    return this.toolRegistry;
  }

  /**
   * Creates a new config with overrides applied
   */
  withOverrides(overrides: Partial<LiteConfigInput>): LiteConfig {
    const merged: LiteConfigInput = {
      auth: overrides.auth || { apiKey: this.apiKey },
      workspaceDir: overrides.workspaceDir || this.workspaceDir,
      model: overrides.model || this.model,
      maxTokens: overrides.maxTokens || this.maxTokens,
      temperature: overrides.temperature ?? this.temperature,
      enableWebTools: overrides.enableWebTools ?? this.enableWebTools,
      respectGitignore: overrides.respectGitignore ?? this.respectGitignore,
      geminiIgnorePatterns: overrides.geminiIgnorePatterns || this.geminiIgnorePatterns,
      contextFiles: overrides.contextFiles || this.contextFiles,
      maxContextFiles: overrides.maxContextFiles || this.maxContextFiles,
      maxSessionTurns: overrides.maxSessionTurns || this.maxSessionTurns,
      timeout: overrides.timeout || this.timeout,
      debug: overrides.debug ?? this.debug,
    };

    return LiteConfig.create(merged);
  }
}
