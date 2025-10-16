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
 * Type definitions for Gemini Lite
 *
 * This file defines all public API types for the gemini-lite package.
 * These types provide full TypeScript support for users of the library.
 */

// ─────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Gemini API key (from AI Studio) */
  apiKey?: string;

  /** Vertex AI configuration (alternative to API key) */
  vertexAI?: {
    /** GCP project ID */
    projectId: string;
    /** GCP region (default: us-central1) */
    location?: string;
    /** Path to service account credentials JSON */
    credentialsPath?: string;
  };
}

/**
 * Input configuration for creating GeminiLite instance
 */
export interface LiteConfigInput {
  // ─── Authentication (required) ───────────────────────────────────
  /** Authentication configuration */
  auth: AuthConfig;

  // ─── Workspace (required) ────────────────────────────────────────
  /** Root directory for file access */
  workspaceDir: string;

  // ─── Model configuration (optional) ──────────────────────────────
  /** Gemini model identifier (default: gemini-2.5-pro) */
  model?: string;
  /** Maximum response tokens (default: 4096) */
  maxTokens?: number;
  /** Temperature for response generation 0-1 (default: 0.7) */
  temperature?: number;

  // ─── Workspace configuration (optional) ──────────────────────────
  /** Additional directories to include */
  includeDirectories?: string[];
  /** Respect .gitignore patterns (default: true) */
  respectGitignore?: boolean;
  /** Additional patterns to ignore (glob format) */
  geminiIgnorePatterns?: string[];

  // ─── Context configuration (optional) ────────────────────────────
  /** Context files to load (e.g., GEMINI.md) (default: ['GEMINI.md']) */
  contextFiles?: string[];
  /** Maximum number of context files to load (default: 200) */
  maxContextFiles?: number;

  // ─── Tool configuration (optional) ───────────────────────────────
  /** Enable web_fetch and web_search tools (default: false) */
  enableWebTools?: boolean;

  // ─── Operational limits (optional) ───────────────────────────────
  /** Maximum number of turns in a session (default: 20) */
  maxSessionTurns?: number;
  /** Operation timeout in milliseconds (default: 60000) */
  timeout?: number;

  // ─── Debug (optional) ────────────────────────────────────────────
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Analysis Request/Result Types
// ─────────────────────────────────────────────────────────────────────

/**
 * Analysis request parameters
 */
export interface AnalysisRequest {
  /** Natural language prompt describing the analysis to perform */
  prompt: string;

  /**
   * Optional: Specific file paths to include in analysis.
   * Note: These are PATHS, not contents. The LLM will read them via tools.
   */
  files?: string[];

  /** Optional: Additional context as plain text (e.g., logs, diffs) */
  additionalContext?: string;

  /** Optional: Override configuration for this request */
  overrides?: Partial<LiteConfigInput>;
}

/**
 * Token usage metadata from Gemini API
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  prompt: number;
  /** Tokens in the response */
  response: number;
  /** Cached tokens (context caching) */
  cached: number;
  /** Total tokens used */
  total: number;
}

/**
 * Tool call tracking metadata
 */
export interface ToolCallMetadata {
  /** Total number of tool calls made */
  totalCalls: number;
  /** Count of calls per tool name */
  byName: Record<string, number>;
}

/**
 * Analysis result metadata
 */
export interface AnalysisMetadata {
  /** Model used for analysis */
  model: string;
  /** Token usage statistics */
  tokensUsed: TokenUsage;
  /** Tool call statistics */
  toolCalls: ToolCallMetadata;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Tool execution record for debugging
 */
export interface ToolExecution {
  /** Name of the tool */
  name: string;
  /** Parameters passed to the tool */
  params: Record<string, unknown>;
  /** Execution duration in milliseconds */
  duration: number;
  /** Whether the tool executed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Analysis result with metadata
 */
export interface AnalysisResult {
  /** The main analysis response text */
  response: string;
  /** Metadata about the operation */
  metadata: AnalysisMetadata;
  /** Tool execution details (only present if debug mode enabled) */
  toolExecutions?: ToolExecution[];
  /** Any warnings or non-fatal issues */
  warnings?: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Pull Request Review Types
// ─────────────────────────────────────────────────────────────────────

/**
 * Focus areas for pull request review
 */
export type ReviewFocusArea = 'bugs' | 'security' | 'performance' | 'style' | 'tests';

/**
 * Output format for pull request review
 */
export type ReviewFormat = 'markdown' | 'json';

/**
 * Pull request review options
 */
export interface PullRequestOptions {
  /** Base branch for comparison */
  baseBranch: string;
  /** Head branch (default: current branch) */
  headBranch?: string;
  /** Areas to focus on during review */
  focusAreas?: ReviewFocusArea[];
  /** Output format preference */
  format?: ReviewFormat;
}

/**
 * Issue severity level
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Code review issue
 */
export interface ReviewIssue {
  /** Severity of the issue */
  severity: IssueSeverity;
  /** Category of the issue (e.g., 'security', 'performance') */
  category: string;
  /** File path where the issue was found */
  file: string;
  /** Line number (1-indexed) */
  line?: number;
  /** Issue description */
  message: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Pull request review result
 */
export interface ReviewResult extends AnalysisResult {
  /** Summary of the review */
  summary: string;
  /** Number of files changed */
  filesChanged: number;
  /** List of issues found */
  issues: ReviewIssue[];
  /** Recommendations for improvement */
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Code Explanation Types
// ─────────────────────────────────────────────────────────────────────

/**
 * Detail level for code explanation
 */
export type ExplanationDetail = 'high-level' | 'detailed' | 'expert';

/**
 * Code explanation options
 */
export interface CodeExplanationOptions {
  /** File path to explain */
  file: string;
  /** Starting line number (1-indexed) */
  lineStart?: number;
  /** Ending line number (1-indexed) */
  lineEnd?: number;
  /** Detail level of explanation */
  detail?: ExplanationDetail;
}

/**
 * Code explanation result
 */
export interface ExplanationResult extends AnalysisResult {
  // Inherits response and metadata from AnalysisResult
}

// ─────────────────────────────────────────────────────────────────────
// CI Failure Analysis Types
// ─────────────────────────────────────────────────────────────────────

/**
 * CI failure analysis options
 */
export interface CIFailureOptions {
  /** Path to log file */
  logFile?: string;
  /** Log content as string (alternative to logFile) */
  logContent?: string;
  /** Build command that was executed */
  buildCommand?: string;
  /** Additional context files (e.g., package.json, tsconfig.json) */
  contextFiles?: string[];
}

/**
 * CI failure analysis result
 */
export interface FailureAnalysisResult extends AnalysisResult {
  // Inherits response and metadata from AnalysisResult
}

// ─────────────────────────────────────────────────────────────────────
// Codebase Summary Types
// ─────────────────────────────────────────────────────────────────────

/**
 * Depth level for codebase summary
 */
export type SummaryDepth = 'overview' | 'moderate' | 'comprehensive';

/**
 * Focus areas for codebase summary
 */
export type SummaryFocusArea = 'architecture' | 'dependencies' | 'patterns' | 'quality';

/**
 * Codebase summary options
 */
export interface CodebaseSummaryOptions {
  /** Depth level of the summary */
  depth?: SummaryDepth;
  /** Areas to focus on */
  focus?: SummaryFocusArea[];
  /** Include code metrics (LOC, file count, etc.) */
  includeMetrics?: boolean;
}

/**
 * Codebase summary result
 */
export interface SummaryResult extends AnalysisResult {
  // Inherits response and metadata from AnalysisResult
}

// ─────────────────────────────────────────────────────────────────────
// GeminiLite Class Interface
// ─────────────────────────────────────────────────────────────────────

/**
 * Main interface for GeminiLite instances
 */
export interface IGeminiLite {
  /**
   * Performs a generic code analysis based on a natural language prompt.
   *
   * CRITICAL AGENTIC DESIGN:
   * - LLM autonomously requests file reads via tool calls
   * - File contents are NEVER pre-loaded
   * - Uses async generator pattern for event streaming
   *
   * @param request - Analysis request with prompt and optional parameters
   * @returns Promise resolving to analysis result with metadata
   * @throws {ClosedInstanceError} If called after close()
   * @throws {TimeoutError} If analysis exceeds configured timeout
   * @throws {AuthenticationError} If API authentication fails
   */
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;

  /**
   * Reviews a pull request by comparing two git branches.
   *
   * @param options - Pull request review options
   * @returns Promise resolving to structured review result
   * @throws {GitError} If git operations fail
   * @throws {BranchNotFoundError} If specified branch doesn't exist
   */
  reviewPullRequest(options: PullRequestOptions): Promise<ReviewResult>;

  /**
   * Explains a code file or snippet with configurable detail level.
   *
   * @param options - Code explanation options
   * @returns Promise resolving to explanation result
   * @throws {FileNotFoundError} If file doesn't exist
   * @throws {InvalidLineRangeError} If line range is invalid
   */
  explainCode(options: CodeExplanationOptions): Promise<ExplanationResult>;

  /**
   * Analyzes CI/CD failure logs to identify root causes.
   *
   * @param options - CI failure analysis options
   * @returns Promise resolving to failure analysis result
   * @throws {ValidationError} If neither logFile nor logContent provided
   */
  analyzeCIFailure(options: CIFailureOptions): Promise<FailureAnalysisResult>;

  /**
   * Generates a high-level summary of the codebase.
   *
   * @param options - Codebase summary options
   * @returns Promise resolving to summary result
   */
  summarizeCodebase(options?: CodebaseSummaryOptions): Promise<SummaryResult>;

  /**
   * Releases resources and closes the instance.
   * This method is idempotent and can be called multiple times safely.
   */
  close(): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// Factory Function Type
// ─────────────────────────────────────────────────────────────────────

/**
 * Factory function type for creating GeminiLite instances
 */
export type CreateGeminiLiteFunction = (config: LiteConfigInput) => IGeminiLite;
