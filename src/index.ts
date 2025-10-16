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
 * Portions of this file are derived from the Gemini CLI project
 * (https://github.com/google/gemini-cli), Copyright 2024-2025 Google LLC,
 * licensed under the Apache License 2.0.
 */

/**
 * @shiftrightlabs/gemini-lite - Read-only code analysis module
 *
 * Public API exports for gemini-lite
 */

// Re-export all public types
export type {
  // Configuration types
  LiteConfigInput,
  AuthConfig,
  // Analysis types
  AnalysisRequest,
  AnalysisResult,
  AnalysisMetadata,
  TokenUsage,
  ToolCallMetadata,
  ToolExecution,
  // Pull request review types
  PullRequestOptions,
  ReviewResult,
  ReviewIssue,
  ReviewFocusArea,
  ReviewFormat,
  IssueSeverity,
  // Code explanation types
  CodeExplanationOptions,
  ExplanationResult,
  ExplanationDetail,
  // CI failure analysis types
  CIFailureOptions,
  FailureAnalysisResult,
  // Codebase summary types
  CodebaseSummaryOptions,
  SummaryResult,
  SummaryDepth,
  SummaryFocusArea,
  // Main interface
  IGeminiLite,
} from './types.js';

// Re-export error classes for error handling
export {
  // Base error
  GeminiLiteError,
  // Configuration errors
  ConfigurationError,
  InvalidAPIKeyError,
  InvalidWorkspaceError,
  InvalidModelError,
  InvalidRangeError,
  // Operation errors
  OperationError,
  AuthenticationError,
  QuotaExceededError,
  TimeoutError,
  ClosedInstanceError,
  APIError,
  NetworkError,
  // File system errors
  FileSystemError,
  FileNotFoundError,
  FileOutsideWorkspaceError,
  InvalidPathError,
  FileReadError,
  DirectoryListError,
  // Git errors
  GitError,
  BranchNotFoundError,
  GitCommandFailedError,
  NotAGitRepositoryError,
  // Validation errors
  ValidationError,
  MissingRequiredFieldError,
  InvalidArgumentError,
  InvalidLineRangeError,
  // Tool errors
  ToolError,
  ToolExecutionError,
  UnknownToolError,
  ToolNotAllowedError,
} from './errors.js';

// Re-export main factory function and class
export { createGeminiLite, GeminiLite } from './geminiLite.js';

// Export version
export const VERSION = '1.0.0-alpha';
