# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gemini Lite** is a lightweight, read-only code analysis module that brings Gemini AI capabilities into development workflows. It's a derivative of the [Gemini CLI](https://github.com/google/gemini-cli) project (Apache 2.0), maintained by ShiftRight Labs as a standalone NPM package.

**Key Characteristics:**
- ✅ **Read-only** - Cannot modify files, execute commands, or mutate system state
- ✅ **Physically Isolated** - Zero runtime dependencies on mutation code
- ✅ **Agentic Architecture** - LLM autonomously discovers and reads files via tools
- ✅ **TypeScript-first** - Strict mode, zero `any` types in public API
- ✅ **Apache 2.0 Licensed** - Properly attributed derivative work

## Critical: Security and Licensing

### Read-Only Enforcement

This project is **guaranteed read-only** through physical isolation:

1. **Build-Time Verification**: `npm run verify-readonly` scans for forbidden patterns
2. **Physical Isolation**: Dangerous code (write, execute, MCP) doesn't exist in the bundle
3. **Path Validation**: All file operations restricted to workspace boundaries

**NEVER add code that:**
- Writes, modifies, or deletes files (`fs.writeFile`, `fs.unlink`, etc.)
- Executes shell commands (`child_process.exec`, `spawn`, etc.)
- Supports MCP servers or external tools
- Imports from `@google/gemini-cli-core`

### Apache License 2.0 Compliance

**Critical Requirements:**
- All new files MUST include Apache 2.0 copyright header
- Files derived from Gemini CLI MUST include attribution notice
- Changes to derived files MUST maintain attribution
- See `LICENSE` and `NOTICE` for legal requirements

**Copyright Header Template (Original Work):**
```typescript
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
```

**Copyright Header Template (Derived from Gemini CLI):**
```typescript
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
 * This file is derived from [specific component] in the Gemini CLI project
 * (https://github.com/google/gemini-cli), Copyright 2024-2025 Google LLC,
 * licensed under the Apache License 2.0.
 */
```

## Architecture

### Core Components

```
gemini-lite/
├── src/
│   ├── index.ts              # Public API exports (derived)
│   ├── geminiLite.ts         # Main GeminiLite class
│   ├── types.ts              # TypeScript type definitions
│   ├── errors.ts             # Error class hierarchy (27 classes)
│   ├── config.ts             # Configuration management
│   ├── validation.ts         # Input validation functions
│   ├── core/
│   │   ├── liteTurn.ts       # Agentic loop (derived from Turn)
│   │   ├── events.ts         # Event types (derived)
│   │   └── liteChat.ts       # Chat wrapper (derived from GeminiChat)
│   └── tools/
│       ├── toolBase.ts       # Tool interfaces
│       ├── toolRegistry.ts   # Tool management
│       ├── readFile.ts       # Read file tool
│       ├── glob.ts           # Pattern matching tool
│       ├── grep.ts           # Content search tool
│       └── listDirectory.ts  # Directory listing tool
```

### Agentic Architecture

**Key Principle**: File contents are NEVER pre-loaded. The LLM autonomously discovers and reads files via tool calls.

```typescript
// LLM makes autonomous tool calls:
for await (const event of turn.run(model, prompt, signal)) {
  switch (event.type) {
    case 'tool_call_request':
      // LLM requests: read_file("src/auth.ts")
      await toolRegistry.executeTool(event.value.name, event.value.args);
      break;
    case 'content':
      // Accumulate LLM response
      break;
    case 'finished':
      // Analysis complete
      break;
  }
}
```

### Physical Isolation Pattern

Components are **forked and simplified** from Gemini CLI:

| Gemini CLI | Gemini Lite | Changes |
|------------|-------------|---------|
| `Turn` class | `LiteTurn` | Removed MCP, interactive, compression, loop detection |
| `GeminiChat` | `LiteChat` | Removed MCP, interactive, compression |
| Event system | `events.ts` | Removed MCP/interactive events |
| Tool registry | `ToolRegistry` | Only read-only tools |

**Zero dependencies** on `@google/gemini-cli-core` at runtime.

## Development Workflow

### Build and Test Commands

```bash
# Verify read-only status (runs automatically in prebuild)
npm run verify-readonly

# Build the package
npm run build

# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run security-specific tests
npm run test:security

# Typecheck without emitting
npm run typecheck

# Lint and fix
npm run lint

# Complete pre-publish checks
npm run prepublishOnly
```

### Before Committing

**Always run:**
```bash
npm run verify-readonly  # Ensure no dangerous patterns
npm run typecheck        # Ensure type safety
npm run lint             # Ensure code style
npm run test             # Ensure functionality
```

## Code Style and Conventions

### TypeScript Guidelines

1. **Strict Mode Always**: All files use TypeScript strict mode
2. **Zero `any` in Public API**: Use `unknown` with type guards instead
3. **Explicit Return Types**: All public methods must have explicit return types
4. **Comprehensive JSDoc**: All public APIs must have JSDoc comments
5. **Error Handling**: Use typed error classes from `errors.ts`

### File Organization

- **Flat structure**: Avoid deep nesting (max 2 levels: `src/core/`, `src/tools/`)
- **Single responsibility**: Each file has one primary export
- **Consistent naming**:
  - Classes: PascalCase (`GeminiLite`, `ReadFileTool`)
  - Files: camelCase matching primary export (`geminiLite.ts`, `readFile.ts`)
  - Types: PascalCase with suffix (`AnalysisResult`, `ToolConfig`)

### Import Conventions

```typescript
// ✅ Good: ES module imports with .js extension
import { LiteConfig } from './config.js';
import type { LiteConfigInput } from './types.js';

// ❌ Bad: No extension
import { LiteConfig } from './config';

// ❌ Bad: Mixing default and named exports
export default class GeminiLite { }
```

### Error Handling Pattern

```typescript
// ✅ Good: Use typed error classes
throw new FileNotFoundError(filePath);
throw new ValidationError('prompt is required');

// ❌ Bad: Generic errors
throw new Error('File not found');
```

### Tool Implementation Pattern

All tools must:
1. Implement the `Tool` interface
2. Include comprehensive schema with examples
3. Validate inputs thoroughly
4. Respect workspace boundaries
5. Handle cancellation via `AbortSignal`
6. Return structured `ToolResult`

```typescript
export class MyTool implements Tool {
  readonly name = 'my_tool';
  readonly description = 'Brief description';

  readonly schema: FunctionDeclaration = {
    name: 'my_tool',
    description: 'Detailed description with examples',
    parameters: {
      type: 'object',
      properties: {
        param: {
          type: 'string',
          description: 'Parameter description with example',
        },
      },
      required: ['param'],
    },
  };

  constructor(private readonly config: ToolConfig) {}

  async execute(
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    // 1. Validate inputs
    // 2. Check cancellation
    // 3. Execute operation (read-only!)
    // 4. Return structured result
  }
}
```

## Common Tasks

### Adding a New Tool

1. Create file in `src/tools/` (e.g., `myTool.ts`)
2. Add Apache 2.0 copyright header
3. Implement `Tool` interface
4. Add comprehensive schema and JSDoc
5. Register in `ToolRegistry.registerDefaultTools()`
6. Add tests
7. Run `npm run verify-readonly`
8. Update documentation

### Adding a New Preset Method

1. Add method to `GeminiLite` class in `src/geminiLite.ts`
2. Add types to `src/types.ts` (options interface, result interface)
3. Export types from `src/index.ts`
4. Add JSDoc with examples
5. Update `README.md` API Reference section
6. Add tests
7. Update `PRESET_METHODS.md` with detailed documentation

### Adding a New Error Class

1. Add class to appropriate section in `src/errors.ts`
2. Extend appropriate base class (`GeminiLiteError`, `OperationError`, etc.)
3. Include descriptive error code
4. Add JSDoc explaining when to use
5. Export from `src/index.ts`
6. Update error handling where needed

### Updating Configuration

1. Add field to `LiteConfigInput` in `src/types.ts`
2. Add validation in `src/validation.ts`
3. Add default in `LiteConfig.applyDefaults()`
4. Add getter in `LiteConfig` class
5. Update JSDoc in `types.ts`
6. Update `README.md` API Reference

## Testing Strategy

### Unit Tests (when added)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiLite } from './geminiLite';

describe('GeminiLite', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create instance with valid config', () => {
    const gemini = createGeminiLite({
      auth: { apiKey: 'test-key' },
      workspaceDir: process.cwd(),
    });
    expect(gemini).toBeInstanceOf(GeminiLite);
  });
});
```

### Security Tests

Focus on:
1. Path traversal prevention
2. Workspace boundary enforcement
3. Read-only verification
4. Input validation
5. Error handling

## Documentation Standards

### Public API Documentation

All public APIs must have:
1. **JSDoc comment** with description
2. **Parameter descriptions** with types
3. **Return type** with description
4. **Example usage** in JSDoc
5. **Throws clauses** for expected errors

```typescript
/**
 * Analyzes code based on natural language prompt
 *
 * CRITICAL: LLM autonomously discovers files via tool calls.
 * File contents are NEVER pre-loaded.
 *
 * @param request - Analysis request with prompt and optional parameters
 * @returns Promise resolving to analysis result with metadata
 * @throws {ClosedInstanceError} If called after close()
 * @throws {TimeoutError} If analysis exceeds configured timeout
 * @throws {ValidationError} If request is invalid
 *
 * @example
 * ```typescript
 * const result = await gemini.analyze({
 *   prompt: 'Review this code for security vulnerabilities',
 * });
 * console.log(result.response);
 * ```
 */
async analyze(request: AnalysisRequest): Promise<AnalysisResult>
```

### README Updates

When changing public API:
1. Update relevant section in `README.md`
2. Update examples if needed
3. Update `PRESET_METHODS.md` for preset methods
4. Update `EXAMPLES.md` if adding new patterns
5. Update `DOCUMENTATION_INDEX.md` navigation

## Troubleshooting

### Build Failures

**"Dangerous pattern detected"**
- Run: `npm run verify-readonly`
- Check for forbidden patterns in `scripts/verify-readonly.js`
- Remove any mutation code

**Type errors**
- Run: `npm run typecheck`
- Ensure all public APIs have explicit types
- Avoid `any` types (use `unknown` instead)

**Import errors**
- Ensure `.js` extensions on all imports
- Check for circular dependencies
- Verify file paths are correct

### Runtime Issues

**"File outside workspace"**
- All file operations must be within `workspaceDir`
- Use `validatePathWithinWorkspace()` for validation
- Resolve paths with `resolve(config.workspaceDir, filePath)`

**"Tool execution failed"**
- Check tool implementation for proper error handling
- Ensure tool respects `AbortSignal`
- Verify tool parameters match schema

## References

- **Main Repository**: https://github.com/shiftrightlabs/gemini-lite
- **Original Project**: https://github.com/google/gemini-cli (Apache 2.0)
- **Package**: https://www.npmjs.com/package/@shiftrightlabs/gemini-lite
- **License**: Apache License 2.0 (see `LICENSE` and `NOTICE`)

## Contributing Guidelines

1. **Maintain Read-Only Status** - Never add mutation capabilities
2. **Physical Isolation** - No dependencies on `@google/gemini-cli-core`
3. **Build Verification** - Always run `npm run verify-readonly`
4. **Test Coverage** - Maintain >85% test coverage (when tests are added)
5. **Documentation** - Update docs for all API changes
6. **Copyright Headers** - All new files need Apache 2.0 headers
7. **Attribution** - Maintain attribution for derived code
8. **Type Safety** - Zero `any` types in public API
9. **Error Handling** - Use typed error classes
10. **Commit Messages** - Use conventional commit format

---

**Remember**: This is a **read-only** code analysis tool. The security guarantee depends on physical isolation. Never compromise this principle.
