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
 * GeminiLite - Main class for read-only code analysis
 *
 * This is the primary API entry point for gemini-lite
 */

import { LiteConfig } from './config.js';
import { LiteChat } from './core/liteChat.js';
import { LiteTurn } from './core/liteTurn.js';
import { GeminiEventType } from './core/events.js';
import type { ServerGeminiStreamEvent } from './core/events.js';
import type {
  LiteConfigInput,
  AnalysisRequest,
  AnalysisResult,
  IGeminiLite,
  PullRequestOptions,
  ReviewResult,
  ReviewIssue,
  CodeExplanationOptions,
  ExplanationResult,
  CIFailureOptions,
  FailureAnalysisResult,
  CodebaseSummaryOptions,
  SummaryResult,
} from './types.js';
import {
  ClosedInstanceError,
  TimeoutError,
  ValidationError,
} from './errors.js';

/**
 * GeminiLite provides read-only code analysis capabilities
 *
 * Key features:
 * - Agentic architecture: LLM autonomously reads files via tool calls
 * - Read-only: Cannot modify files or execute commands
 * - Streaming: Real-time event streaming for progress
 * - Type-safe: Full TypeScript support
 *
 * @example
 * ```typescript
 * const gemini = createGeminiLite({
 *   auth: { apiKey: process.env.GEMINI_API_KEY },
 *   workspaceDir: process.cwd(),
 * });
 *
 * const result = await gemini.analyze({
 *   prompt: 'Review this code for security issues',
 * });
 *
 * console.log(result.response);
 * await gemini.close();
 * ```
 */
export class GeminiLite implements IGeminiLite {
  private readonly config: LiteConfig;
  private chat: LiteChat | null = null;
  private closed = false;

  /**
   * @internal
   * Use createGeminiLite() factory function instead
   */
  constructor(config: LiteConfig) {
    this.config = config;
  }

  /**
   * Performs a generic code analysis based on natural language prompt
   *
   * CRITICAL AGENTIC DESIGN:
   * - LLM autonomously requests file reads via tool calls
   * - File contents are NEVER pre-loaded
   * - Uses LiteTurn.run() async generator pattern
   * - Processes ServerGeminiStreamEvent stream
   *
   * @param request Analysis request with prompt and optional parameters
   * @returns Promise resolving to analysis result with metadata
   * @throws {ClosedInstanceError} If called after close()
   * @throws {TimeoutError} If analysis exceeds configured timeout
   * @throws {ValidationError} If request is invalid
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    this.assertNotClosed();

    // Validate request
    if (!request.prompt || typeof request.prompt !== 'string') {
      throw new ValidationError('prompt is required and must be a string');
    }

    const startTime = Date.now();
    const chat = this.getOrCreateChat();

    // Apply request-level overrides if provided
    const effectiveConfig = request.overrides
      ? this.config.withOverrides(request.overrides)
      : this.config;

    // Build the prompt (NO FILE CONTENTS - LLM will request via tools)
    const fullPrompt = this.buildPrompt(request);

    // Execute analysis using LiteTurn agentic loop
    const promptId = this.generatePromptId();
    const abortController = new AbortController();
    const timeout = effectiveConfig.getTimeout();

    // Set timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      // Create LiteTurn instance
      const turn = new LiteTurn(chat, promptId);

      let responseText = '';
      const toolCallCounts: Record<string, number> = {};
      let usageMetadata: any = undefined;
      const warnings: string[] = [];

      // Process event stream from LiteTurn.run() async generator
      // This is the CORE AGENTIC PATTERN
      for await (const event of turn.run(
        effectiveConfig.getModel(),
        fullPrompt,
        abortController.signal,
      )) {
        switch (event.type) {
          case GeminiEventType.Content:
            // Accumulate response text
            responseText += event.value;
            break;

          case GeminiEventType.ToolCallRequest:
            // LLM autonomously requested a tool call
            toolCallCounts[event.value.name] =
              (toolCallCounts[event.value.name] || 0) + 1;

            // Execute tool
            try {
              const toolRegistry = effectiveConfig.getToolRegistry();
              await toolRegistry.executeTool(
                event.value.name,
                event.value.args,
                abortController.signal,
              );
            } catch (error) {
              warnings.push(
                `Tool ${event.value.name} failed: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
            break;

          case GeminiEventType.Finished:
            usageMetadata = event.value.usageMetadata;
            break;

          case GeminiEventType.Error:
            throw new Error(event.value.error.message);

          case GeminiEventType.UserCancelled:
            throw new TimeoutError(timeout, Date.now() - startTime);

          case GeminiEventType.Thought:
          case GeminiEventType.Citation:
          case GeminiEventType.Retry:
          case GeminiEventType.InvalidStream:
            // Track but don't expose in simple API
            break;
        }
      }

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      return {
        response: responseText,
        metadata: {
          model: effectiveConfig.getModel(),
          tokensUsed: {
            prompt: usageMetadata?.promptTokenCount || 0,
            response: usageMetadata?.candidatesTokenCount || 0,
            cached: usageMetadata?.cachedContentTokenCount || 0,
            total: usageMetadata?.totalTokenCount || 0,
          },
          toolCalls: {
            totalCalls: Object.values(toolCallCounts).reduce((a, b) => a + b, 0),
            byName: toolCallCounts,
          },
          duration,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Reviews a pull request by comparing git branches
   *
   * This is a convenience wrapper around analyze() that constructs
   * an appropriate prompt for PR review.
   *
   * @param options Pull request review options
   * @returns Promise resolving to structured review result
   */
  async reviewPullRequest(options: PullRequestOptions): Promise<ReviewResult> {
    this.assertNotClosed();

    // Validate options
    if (!options.baseBranch || typeof options.baseBranch !== 'string') {
      throw new ValidationError('baseBranch is required and must be a string');
    }

    const headBranch = options.headBranch || 'HEAD';
    const focusAreas = options.focusAreas || ['bugs', 'security', 'performance'];
    const format = options.format || 'markdown';

    // Build PR review prompt
    const prompt = `Review the pull request changes between branches "${options.baseBranch}" and "${headBranch}".

Focus Areas:
${focusAreas.map((area) => `- ${area}`).join('\n')}

Your task:
1. Use the glob tool to find changed files (or list_directory to explore)
2. Use the read_file tool to read each file
3. Identify issues in the following categories: ${focusAreas.join(', ')}
4. For each issue, provide:
   - Severity (critical/warning/info)
   - Category
   - File path and line number
   - Clear description
   - Suggested fix (if applicable)
5. Provide overall recommendations

Output format: ${format === 'json' ? 'Structured JSON' : 'Markdown'}

Please be thorough and specific in your analysis.`;

    // Execute analysis
    const result = await this.analyze({ prompt });

    // Parse response to extract structured data
    // For now, return enhanced result with defaults
    // TODO: Add response parsing logic to extract issues
    const reviewResult: ReviewResult = {
      ...result,
      summary: result.response,
      filesChanged: 0, // Would need git diff to determine
      issues: [], // Would need to parse from response
      recommendations: [], // Would need to parse from response
    };

    return reviewResult;
  }

  /**
   * Explains code with configurable detail level
   *
   * This is a convenience wrapper around analyze() that constructs
   * an appropriate prompt for code explanation.
   *
   * @param options Code explanation options
   * @returns Promise resolving to explanation result
   */
  async explainCode(options: CodeExplanationOptions): Promise<ExplanationResult> {
    this.assertNotClosed();

    // Validate options
    if (!options.file || typeof options.file !== 'string') {
      throw new ValidationError('file is required and must be a string');
    }

    const detail = options.detail || 'detailed';
    const hasLineRange = options.lineStart !== undefined && options.lineEnd !== undefined;

    // Build explanation prompt based on detail level
    let prompt = `Explain the code in file "${options.file}"`;

    if (hasLineRange) {
      prompt += ` (lines ${options.lineStart}-${options.lineEnd})`;
    }

    prompt += '.\n\n';

    // Add detail-specific instructions
    switch (detail) {
      case 'high-level':
        prompt += `Provide a high-level overview:
- What is the main purpose of this code?
- What are the key components/functions?
- How does it fit into the larger system?

Keep the explanation concise and accessible to someone unfamiliar with the codebase.`;
        break;

      case 'detailed':
        prompt += `Provide a detailed explanation:
- Purpose and functionality
- Key components and their responsibilities
- Data flow and logic
- Important implementation details
- Dependencies and interactions
- Any notable patterns or techniques used

Make the explanation thorough but still accessible.`;
        break;

      case 'expert':
        prompt += `Provide an expert-level deep dive:
- Comprehensive technical analysis
- Design patterns and architectural decisions
- Performance considerations and optimizations
- Edge cases and error handling
- Potential improvements or concerns
- Security implications
- Testing considerations
- Detailed algorithmic complexity where relevant

Assume the reader has expert knowledge of software engineering.`;
        break;
    }

    prompt += '\n\nUse the read_file tool to read the code, then provide your explanation.';

    // Execute analysis
    const result = await this.analyze({
      prompt,
      files: [options.file],
    });

    return result;
  }

  /**
   * Analyzes CI/CD failure logs
   *
   * This is a convenience wrapper around analyze() that constructs
   * an appropriate prompt for CI failure analysis.
   *
   * @param options CI failure analysis options
   * @returns Promise resolving to failure analysis result
   */
  async analyzeCIFailure(options: CIFailureOptions): Promise<FailureAnalysisResult> {
    this.assertNotClosed();

    // Validate options - need either logFile or logContent
    if (!options.logFile && !options.logContent) {
      throw new ValidationError(
        'Either logFile or logContent must be provided',
      );
    }

    // Build CI failure analysis prompt
    let prompt = 'Analyze the following CI/CD failure logs to identify the root cause and suggest fixes.\n\n';

    if (options.buildCommand) {
      prompt += `Build command: ${options.buildCommand}\n\n`;
    }

    prompt += `Your task:
1. Identify the root cause of the failure
2. Pinpoint the specific error messages or stack traces
3. Determine which files or components are involved
4. Suggest specific fixes or debugging steps
5. Identify any related issues that might need attention

`;

    // Handle log content
    let additionalContext = '';
    if (options.logContent) {
      additionalContext = `CI/CD Logs:\n\`\`\`\n${options.logContent}\n\`\`\`\n\n`;
    } else if (options.logFile) {
      prompt += `Read the log file "${options.logFile}" using the read_file tool.\n\n`;
    }

    // Add context files if provided
    const contextFiles = options.contextFiles || [];
    if (contextFiles.length > 0) {
      prompt += `Also examine these context files for additional information:\n`;
      prompt += contextFiles.map((f) => `- ${f}`).join('\n');
      prompt += '\n\n';
    }

    prompt += `Provide a clear, actionable analysis with specific line numbers and file references where applicable.`;

    // Execute analysis
    const files = options.logFile
      ? [options.logFile, ...contextFiles]
      : contextFiles;

    const result = await this.analyze({
      prompt,
      files: files.length > 0 ? files : undefined,
      additionalContext: additionalContext || undefined,
    });

    return result;
  }

  /**
   * Generates codebase summary
   *
   * This is a convenience wrapper around analyze() that constructs
   * an appropriate prompt for codebase summarization.
   *
   * @param options Codebase summary options
   * @returns Promise resolving to summary result
   */
  async summarizeCodebase(options?: CodebaseSummaryOptions): Promise<SummaryResult> {
    this.assertNotClosed();

    const depth = options?.depth || 'moderate';
    const focus = options?.focus || ['architecture', 'patterns'];
    const includeMetrics = options?.includeMetrics ?? true;

    // Build codebase summary prompt based on depth
    let prompt = 'Analyze and summarize this codebase.\n\n';

    // Add depth-specific instructions
    switch (depth) {
      case 'overview':
        prompt += `Provide a high-level overview:
- Main purpose and functionality
- Key technologies and frameworks used
- Overall architecture (monolith, microservices, etc.)
- Primary directories and their purposes
- Notable dependencies

Keep it concise - 1-2 paragraphs.`;
        break;

      case 'moderate':
        prompt += `Provide a moderate-depth summary:
- Purpose and main features
- Architecture and design patterns
- Key modules/components and their responsibilities
- Technology stack and major dependencies
- Code organization and structure
- Notable patterns or conventions`;
        break;

      case 'comprehensive':
        prompt += `Provide a comprehensive analysis:
- Detailed architecture and component breakdown
- Design patterns and architectural decisions
- Complete technology stack analysis
- Module-by-module breakdown
- Data flow and interactions
- External dependencies and integrations
- Code quality and patterns
- Testing strategy
- Build and deployment approach`;
        break;
    }

    // Add focus area instructions
    if (focus.length > 0) {
      prompt += `\n\nFocus especially on:\n`;
      focus.forEach((area) => {
        switch (area) {
          case 'architecture':
            prompt += `- Architecture: High-level structure, patterns, component relationships\n`;
            break;
          case 'dependencies':
            prompt += `- Dependencies: External packages, internal modules, dependency graph\n`;
            break;
          case 'patterns':
            prompt += `- Patterns: Design patterns, code conventions, idioms used\n`;
            break;
          case 'quality':
            prompt += `- Quality: Code organization, testing, error handling, documentation\n`;
            break;
        }
      });
    }

    // Add metrics request
    if (includeMetrics) {
      prompt += `\n\nInclude code metrics:
- Approximate lines of code
- Number of files
- Programming languages used
- Directory structure depth`;
    }

    prompt += `\n\nYour task:
1. Use list_directory to explore the project structure
2. Use glob to find key files (package.json, README, main source files)
3. Use read_file to read important files
4. Analyze the overall structure and patterns
5. Provide a comprehensive summary

Be thorough and use specific file references.`;

    // Execute analysis
    const result = await this.analyze({ prompt });

    return result;
  }

  /**
   * Releases resources and closes the instance
   * This method is idempotent and can be called multiple times safely
   */
  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Clean up chat session
    if (this.chat) {
      this.chat.clearHistory();
      this.chat = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────

  private assertNotClosed(): void {
    if (this.closed) {
      throw new ClosedInstanceError();
    }
  }

  private getOrCreateChat(): LiteChat {
    if (!this.chat) {
      this.chat = new LiteChat({
        apiKey: this.config.getApiKey(),
        model: this.config.getModel(),
        systemInstruction: this.config.getSystemInstruction(),
        tools: this.config.getToolRegistry().toFunctionDeclarations(),
        maxTokens: this.config.getMaxTokens(),
        temperature: this.config.getTemperature(),
      });
    }
    return this.chat;
  }

  /**
   * Builds the prompt for the LLM
   *
   * CRITICAL: This method does NOT read or include file contents!
   * The LLM will autonomously request file reads via tool calls.
   * We only provide:
   * - User's natural language prompt
   * - List of file paths (NOT contents) if user specified them
   * - Additional context strings (e.g., diff output, log content)
   */
  private buildPrompt(request: AnalysisRequest): string {
    let prompt = request.prompt;

    // Add file PATHS (NOT contents) if specified
    // LLM will use read_file tool to get contents autonomously
    if (request.files && request.files.length > 0) {
      prompt += `\n\nAnalyze the following files:\n`;
      prompt += request.files.map(f => `- ${f}`).join('\n');
      prompt += `\n\nUse the read_file tool to read these files.`;
    }

    // Add additional context if provided (e.g., diff output, logs)
    // This is the ONLY case where we include content directly
    if (request.additionalContext) {
      prompt += `\n\nAdditional Context:\n${request.additionalContext}`;
    }

    return prompt;
  }

  private generatePromptId(): string {
    return `gemini-lite-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Factory function to create GeminiLite instances
 *
 * @param config Configuration object
 * @returns Initialized GeminiLite instance
 * @throws {ConfigurationError} If configuration is invalid
 */
export function createGeminiLite(config: LiteConfigInput): GeminiLite {
  const validatedConfig = LiteConfig.create(config);
  return new GeminiLite(validatedConfig);
}
