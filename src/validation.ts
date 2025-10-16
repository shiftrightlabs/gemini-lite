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
 * Validation functions for gemini-lite configuration and inputs
 */

import { existsSync, statSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import type { LiteConfigInput } from './types.js';

/**
 * Validates LiteConfig input and returns an error message if invalid.
 * Returns null if validation passes.
 */
export function validateLiteConfig(config: LiteConfigInput): string | null {
  // Validate authentication
  const authError = validateAuth(config.auth);
  if (authError) return authError;

  // Validate workspace directory
  const workspaceError = validateWorkspaceDir(config.workspaceDir);
  if (workspaceError) return workspaceError;

  // Validate optional fields
  if (config.model !== undefined) {
    const modelError = validateModel(config.model);
    if (modelError) return modelError;
  }

  if (config.maxTokens !== undefined) {
    const tokensError = validateMaxTokens(config.maxTokens);
    if (tokensError) return tokensError;
  }

  if (config.temperature !== undefined) {
    const tempError = validateTemperature(config.temperature);
    if (tempError) return tempError;
  }

  if (config.timeout !== undefined) {
    const timeoutError = validateTimeout(config.timeout);
    if (timeoutError) return timeoutError;
  }

  if (config.maxSessionTurns !== undefined) {
    const turnsError = validateMaxSessionTurns(config.maxSessionTurns);
    if (turnsError) return turnsError;
  }

  return null;
}

/**
 * Validates authentication configuration
 */
export function validateAuth(auth: LiteConfigInput['auth']): string | null {
  if (!auth) {
    return 'Authentication configuration is required';
  }

  // Must have either apiKey or vertexAI
  if (!auth.apiKey && !auth.vertexAI) {
    return 'Either apiKey or vertexAI configuration must be provided';
  }

  // Validate API key if provided
  if (auth.apiKey !== undefined) {
    if (typeof auth.apiKey !== 'string') {
      return 'API key must be a string';
    }
    if (auth.apiKey.trim().length === 0) {
      return 'API key cannot be empty';
    }
  }

  // Validate Vertex AI config if provided
  if (auth.vertexAI) {
    if (!auth.vertexAI.projectId) {
      return 'Vertex AI projectId is required';
    }
    if (typeof auth.vertexAI.projectId !== 'string') {
      return 'Vertex AI projectId must be a string';
    }
    if (auth.vertexAI.projectId.trim().length === 0) {
      return 'Vertex AI projectId cannot be empty';
    }

    // Validate project ID format (basic check)
    const projectIdPattern = /^[a-z][-a-z0-9]{5,29}$/;
    if (!projectIdPattern.test(auth.vertexAI.projectId)) {
      return 'Vertex AI projectId has invalid format. Must start with lowercase letter and contain only lowercase letters, numbers, and hyphens';
    }

    if (auth.vertexAI.location !== undefined) {
      if (typeof auth.vertexAI.location !== 'string') {
        return 'Vertex AI location must be a string';
      }
    }

    if (auth.vertexAI.credentialsPath !== undefined) {
      if (typeof auth.vertexAI.credentialsPath !== 'string') {
        return 'Vertex AI credentialsPath must be a string';
      }
      if (!existsSync(auth.vertexAI.credentialsPath)) {
        return `Vertex AI credentials file not found: ${auth.vertexAI.credentialsPath}`;
      }
    }
  }

  return null;
}

/**
 * Validates workspace directory
 */
export function validateWorkspaceDir(workspaceDir: string): string | null {
  if (!workspaceDir) {
    return 'Workspace directory is required';
  }

  if (typeof workspaceDir !== 'string') {
    return 'Workspace directory must be a string';
  }

  if (workspaceDir.trim().length === 0) {
    return 'Workspace directory cannot be empty';
  }

  // Resolve to absolute path
  const absolutePath = isAbsolute(workspaceDir) ? workspaceDir : resolve(workspaceDir);

  // Check if directory exists
  if (!existsSync(absolutePath)) {
    return `Workspace directory does not exist: ${absolutePath}`;
  }

  // Check if it's actually a directory
  try {
    const stat = statSync(absolutePath);
    if (!stat.isDirectory()) {
      return `Workspace path is not a directory: ${absolutePath}`;
    }
  } catch (error) {
    return `Cannot access workspace directory: ${error instanceof Error ? error.message : String(error)}`;
  }

  return null;
}

/**
 * Validates model identifier
 */
export function validateModel(model: string): string | null {
  if (typeof model !== 'string') {
    return 'Model must be a string';
  }

  if (model.trim().length === 0) {
    return 'Model cannot be empty';
  }

  // Basic validation - must start with "gemini"
  if (!model.startsWith('gemini')) {
    return 'Model identifier must start with "gemini"';
  }

  return null;
}

/**
 * Validates maxTokens
 */
export function validateMaxTokens(maxTokens: number): string | null {
  if (typeof maxTokens !== 'number') {
    return 'maxTokens must be a number';
  }

  if (!Number.isInteger(maxTokens)) {
    return 'maxTokens must be an integer';
  }

  if (maxTokens <= 0) {
    return 'maxTokens must be greater than 0';
  }

  // Gemini API maximum (as of 2025)
  if (maxTokens > 1048576) {
    return 'maxTokens cannot exceed 1,048,576 (Gemini API limit)';
  }

  return null;
}

/**
 * Validates temperature
 */
export function validateTemperature(temperature: number): string | null {
  if (typeof temperature !== 'number') {
    return 'Temperature must be a number';
  }

  if (temperature < 0 || temperature > 1) {
    return 'Temperature must be between 0 and 1';
  }

  return null;
}

/**
 * Validates timeout
 */
export function validateTimeout(timeout: number): string | null {
  if (typeof timeout !== 'number') {
    return 'Timeout must be a number';
  }

  if (!Number.isInteger(timeout)) {
    return 'Timeout must be an integer';
  }

  if (timeout <= 0) {
    return 'Timeout must be greater than 0';
  }

  // Max 10 minutes
  if (timeout > 600000) {
    return 'Timeout cannot exceed 600,000ms (10 minutes)';
  }

  return null;
}

/**
 * Validates maxSessionTurns
 */
export function validateMaxSessionTurns(maxSessionTurns: number): string | null {
  if (typeof maxSessionTurns !== 'number') {
    return 'maxSessionTurns must be a number';
  }

  if (!Number.isInteger(maxSessionTurns)) {
    return 'maxSessionTurns must be an integer';
  }

  if (maxSessionTurns <= 0) {
    return 'maxSessionTurns must be greater than 0';
  }

  if (maxSessionTurns > 100) {
    return 'maxSessionTurns cannot exceed 100';
  }

  return null;
}

/**
 * Validates file path is within workspace boundaries
 */
export function validatePathWithinWorkspace(
  filePath: string,
  workspaceDir: string
): { valid: boolean; error?: string } {
  try {
    // Resolve both paths to absolute paths
    const absoluteFilePath = resolve(filePath);
    const absoluteWorkspace = resolve(workspaceDir);

    // Check if file path starts with workspace path
    const normalizedFilePath = absoluteFilePath.replace(/\\/g, '/');
    const normalizedWorkspace = absoluteWorkspace.replace(/\\/g, '/');

    if (
      !normalizedFilePath.startsWith(normalizedWorkspace + '/') &&
      normalizedFilePath !== normalizedWorkspace
    ) {
      return {
        valid: false,
        error: `File path must be within workspace directory. Path: ${filePath}, Workspace: ${workspaceDir}`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid path: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validates line range for code explanation
 */
export function validateLineRange(
  lineStart: number | undefined,
  lineEnd: number | undefined,
  totalLines?: number
): string | null {
  if (lineStart !== undefined && lineEnd !== undefined) {
    // Both provided - validate range
    if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd)) {
      return 'Line numbers must be integers';
    }

    if (lineStart <= 0 || lineEnd <= 0) {
      return 'Line numbers must be greater than 0';
    }

    if (lineStart > lineEnd) {
      return 'lineStart must be less than or equal to lineEnd';
    }

    if (totalLines !== undefined) {
      if (lineEnd > totalLines) {
        return `lineEnd (${lineEnd}) exceeds total lines in file (${totalLines})`;
      }
    }
  } else if (lineStart !== undefined || lineEnd !== undefined) {
    // Only one provided
    return 'Both lineStart and lineEnd must be provided, or neither';
  }

  return null;
}

/**
 * Validates an array of file paths
 */
export function validateFilePaths(files: string[]): string | null {
  if (!Array.isArray(files)) {
    return 'Files must be an array';
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (typeof file !== 'string') {
      return `File at index ${i} must be a string`;
    }
    if (file.trim().length === 0) {
      return `File at index ${i} cannot be empty`;
    }
  }

  return null;
}

/**
 * Validates glob patterns
 */
export function validateGlobPatterns(patterns: string[]): string | null {
  if (!Array.isArray(patterns)) {
    return 'Patterns must be an array';
  }

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    if (typeof pattern !== 'string') {
      return `Pattern at index ${i} must be a string`;
    }
    if (pattern.trim().length === 0) {
      return `Pattern at index ${i} cannot be empty`;
    }
  }

  return null;
}

/**
 * Sanitizes a string for safe logging (redacts sensitive info)
 */
export function sanitizeForLogging(value: unknown): unknown {
  if (typeof value === 'string') {
    // Redact API keys (pattern: starts with sk-, AIza, or other known prefixes)
    if (value.match(/^(sk-|AIza|ya29\.|[A-Za-z0-9_-]{32,})/)) {
      return '[REDACTED]';
    }
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Redact sensitive field names
      if (
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('credential')
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForLogging(val);
      }
    }
    return sanitized;
  }

  return value;
}
