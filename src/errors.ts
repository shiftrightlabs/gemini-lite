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
 * Base error class for all Gemini Lite errors.
 * Provides a consistent error structure with error codes, timestamps, and optional details.
 */
export class GeminiLiteError extends Error {
  readonly code: string;
  readonly timestamp: string;
  readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a JSON representation of the error for structured logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Configuration Errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Thrown when configuration validation fails
 */
export class ConfigurationError extends GeminiLiteError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', details);
  }
}

/**
 * Thrown when API key is missing or invalid
 */
export class InvalidAPIKeyError extends ConfigurationError {
  constructor(message = 'API key is required but was not provided') {
    super(message, { code: 'INVALID_API_KEY' });
  }
}

/**
 * Thrown when workspace directory is invalid
 */
export class InvalidWorkspaceError extends ConfigurationError {
  constructor(workspacePath: string, reason?: string) {
    super(
      `Workspace directory does not exist or is not accessible: ${workspacePath}${reason ? ` (${reason})` : ''}`,
      {
        code: 'INVALID_WORKSPACE',
        workspacePath,
        reason,
      }
    );
  }
}

/**
 * Thrown when model identifier is invalid
 */
export class InvalidModelError extends ConfigurationError {
  constructor(model: string, availableModels?: string[]) {
    super(`Invalid model identifier: ${model}`, {
      code: 'INVALID_MODEL',
      model,
      availableModels,
    });
  }
}

/**
 * Thrown when a numeric configuration value is out of valid range
 */
export class InvalidRangeError extends ConfigurationError {
  constructor(field: string, value: number, min?: number, max?: number) {
    let message = `Invalid value for ${field}: ${value}`;
    if (min !== undefined && max !== undefined) {
      message += ` (must be between ${min} and ${max})`;
    } else if (min !== undefined) {
      message += ` (must be >= ${min})`;
    } else if (max !== undefined) {
      message += ` (must be <= ${max})`;
    }

    super(message, {
      code: 'INVALID_RANGE',
      field,
      value,
      min,
      max,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Operation Errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Base class for runtime operation errors
 */
export class OperationError extends GeminiLiteError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
  }
}

/**
 * Thrown when API authentication fails
 */
export class AuthenticationError extends OperationError {
  constructor(message = 'Authentication failed. Please check your API credentials.', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', details);
  }
}

/**
 * Thrown when API quota is exceeded
 */
export class QuotaExceededError extends OperationError {
  constructor(message = 'API quota exceeded. Please try again later.', details?: unknown) {
    super(message, 'QUOTA_EXCEEDED', details);
  }
}

/**
 * Thrown when an operation exceeds its configured timeout
 */
export class TimeoutError extends OperationError {
  constructor(timeoutMs: number, elapsedMs: number) {
    super(`Analysis exceeded timeout of ${timeoutMs}ms`, 'TIMEOUT', {
      timeoutMs,
      elapsedMs,
    });
  }
}

/**
 * Thrown when attempting to use a closed instance
 */
export class ClosedInstanceError extends OperationError {
  constructor(message = 'Cannot perform operations on closed instance. Create a new instance instead.') {
    super(message, 'CLOSED_INSTANCE');
  }
}

/**
 * Thrown when the Gemini API returns an error
 */
export class APIError extends OperationError {
  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message, 'API_ERROR', {
      statusCode,
      ...(typeof details === 'object' && details !== null ? details : { details }),
    });
  }
}

/**
 * Thrown when a network request fails
 */
export class NetworkError extends OperationError {
  constructor(message: string, cause?: unknown) {
    super(message, 'NETWORK_ERROR', { cause });
  }
}

// ─────────────────────────────────────────────────────────────────────
// File System Errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Base class for file system errors
 */
export class FileSystemError extends GeminiLiteError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
  }
}

/**
 * Thrown when a file is not found
 */
export class FileNotFoundError extends FileSystemError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', { filePath });
  }
}

/**
 * Thrown when attempting to access a file outside the workspace
 */
export class FileOutsideWorkspaceError extends FileSystemError {
  constructor(requestedPath: string, workspacePath: string) {
    super(
      'File path must be within workspace directory. Access denied for security reasons.',
      'FILE_OUTSIDE_WORKSPACE',
      {
        requestedPath,
        workspacePath,
      }
    );
  }
}

/**
 * Thrown when a file path is invalid
 */
export class InvalidPathError extends FileSystemError {
  constructor(path: string, reason: string) {
    super(`Invalid file path: ${reason}`, 'INVALID_PATH', { path, reason });
  }
}

/**
 * Thrown when a file cannot be read
 */
export class FileReadError extends FileSystemError {
  constructor(filePath: string, cause?: unknown) {
    super(`Failed to read file: ${filePath}`, 'FILE_READ_ERROR', {
      filePath,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

/**
 * Thrown when a directory cannot be listed
 */
export class DirectoryListError extends FileSystemError {
  constructor(dirPath: string, cause?: unknown) {
    super(`Failed to list directory: ${dirPath}`, 'DIRECTORY_LIST_ERROR', {
      dirPath,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Git Errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Base class for git-related errors
 */
export class GitError extends GeminiLiteError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
  }
}

/**
 * Thrown when a git branch is not found
 */
export class BranchNotFoundError extends GitError {
  constructor(branchName: string) {
    super(`Git branch not found: ${branchName}`, 'BRANCH_NOT_FOUND', { branchName });
  }
}

/**
 * Thrown when a git command fails
 */
export class GitCommandFailedError extends GitError {
  constructor(command: string, exitCode: number, stderr: string) {
    super(`Git command failed: ${command}`, 'GIT_COMMAND_FAILED', {
      command,
      exitCode,
      stderr,
    });
  }
}

/**
 * Thrown when the current directory is not a git repository
 */
export class NotAGitRepositoryError extends GitError {
  constructor(directory: string) {
    super(`Not a git repository: ${directory}`, 'NOT_A_GIT_REPOSITORY', { directory });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Validation Errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Base class for validation errors
 */
export class ValidationError extends GeminiLiteError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

/**
 * Thrown when a required field is missing
 */
export class MissingRequiredFieldError extends ValidationError {
  constructor(fieldName: string, context?: string) {
    super(
      `Required field missing: ${fieldName}${context ? ` (${context})` : ''}`,
      {
        code: 'MISSING_REQUIRED_FIELD',
        fieldName,
        context,
      }
    );
  }
}

/**
 * Thrown when an invalid argument is provided
 */
export class InvalidArgumentError extends ValidationError {
  constructor(argumentName: string, reason: string, providedValue?: unknown) {
    super(`Invalid argument: ${argumentName} - ${reason}`, {
      code: 'INVALID_ARGUMENT',
      argumentName,
      reason,
      providedValue,
    });
  }
}

/**
 * Thrown when a line range is invalid
 */
export class InvalidLineRangeError extends ValidationError {
  constructor(lineStart: number, lineEnd: number, reason?: string) {
    super(
      `Invalid line range: ${lineStart}-${lineEnd}${reason ? ` (${reason})` : ''}`,
      {
        code: 'INVALID_LINE_RANGE',
        lineStart,
        lineEnd,
        reason,
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Tool Errors
// ─────────────────────────────────────────────────────────────────────

/**
 * Base class for tool execution errors
 */
export class ToolError extends GeminiLiteError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, code, details);
  }
}

/**
 * Thrown when a tool execution fails
 */
export class ToolExecutionError extends ToolError {
  constructor(toolName: string, reason: string, originalError?: unknown) {
    super(`Tool execution failed: ${toolName} - ${reason}`, 'TOOL_EXECUTION_ERROR', {
      toolName,
      reason,
      originalError: originalError instanceof Error ? originalError.message : String(originalError),
    });
  }
}

/**
 * Thrown when an unknown tool is requested
 */
export class UnknownToolError extends ToolError {
  constructor(toolName: string, availableTools?: string[]) {
    super(`Unknown tool: ${toolName}`, 'UNKNOWN_TOOL', {
      toolName,
      availableTools,
    });
  }
}

/**
 * Thrown when a tool is not allowed in lite mode
 */
export class ToolNotAllowedError extends ToolError {
  constructor(toolName: string, reason: string) {
    super(
      `Tool not allowed in gemini-lite: ${toolName} - ${reason}`,
      'TOOL_NOT_ALLOWED',
      {
        toolName,
        reason,
      }
    );
  }
}
