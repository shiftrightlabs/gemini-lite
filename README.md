# Gemini Lite

> **Read-only code analysis module** - Physically isolated from mutation capabilities

[![npm version](https://img.shields.io/npm/v/@shiftrightlabs/gemini-lite.svg)](https://www.npmjs.com/package/@shiftrightlabs/gemini-lite)
[![License](https://img.shields.io/npm/l/@shiftrightlabs/gemini-lite.svg)](LICENSE)

**By [ShiftRight Labs](https://github.com/shiftrightlabs)** | Derived from [Gemini CLI](https://github.com/google/gemini-cli) (Apache 2.0)

> ⚠️ **Pre-release Notice**: This is version 0.1.0 - early development release. API may change before 1.0.0. Not recommended for production use yet.

Gemini Lite is a lightweight, **read-only** code analysis module that brings the power of Gemini AI directly into your development workflow. Unlike the full Gemini CLI, Gemini Lite is:

- ✅ **Read-only** - Cannot modify files, execute commands, or mutate system state
- ✅ **Lightweight** - Minimal dependencies, <3MB bundle size
- ✅ **Programmable API** - Clean TypeScript API for programmatic integration
- ✅ **Physically Isolated** - Zero runtime dependencies on mutation code
- ✅ **Agentic Architecture** - LLM autonomously discovers and reads files via tools

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install @shiftrightlabs/gemini-lite
```

**Requirements:**
- Node.js >= 20.0.0
- TypeScript >= 5.0.0 (for TypeScript projects)

## Quick Start

```typescript
import { createGeminiLite } from '@shiftrightlabs/gemini-lite';

// Create instance
const gemini = createGeminiLite({
  auth: { apiKey: process.env.GEMINI_API_KEY },
  workspaceDir: process.cwd(),
});

// Perform analysis
const result = await gemini.analyze({
  prompt: 'Review this code for security vulnerabilities',
});

console.log(result.response);
console.log(`Used ${result.metadata.tokensUsed.total} tokens`);

// Cleanup
await gemini.close();
```

## Features

### Core Capabilities

- **Code Analysis** - Natural language code review and analysis
- **Pull Request Review** - Automated PR review with structured feedback
- **Code Explanation** - Explain code with configurable detail levels
- **CI Failure Analysis** - Analyze build logs to identify root causes
- **Codebase Summarization** - Generate high-level codebase overviews

### Agentic Architecture

Gemini Lite uses an **agentic design** where the LLM autonomously discovers and reads files:

1. **No Pre-loading** - File contents are NEVER pre-loaded into prompts
2. **Tool-Based Discovery** - LLM uses `glob`, `grep`, `read_file` tools autonomously
3. **Efficient Context** - Only reads files it actually needs
4. **Transparent** - Tool calls are tracked in metadata

### Security Features

- **Physical Isolation** - Zero runtime dependencies on `@google/gemini-cli-core`
- **Build-Time Verification** - Automated scanning for dangerous code patterns
- **Path Validation** - All file operations restricted to workspace boundaries
- **No Shell Execution** - Cannot execute commands or scripts
- **No File Writes** - Cannot create, modify, or delete files
- **No MCP Servers** - External tools are not supported

## Architecture

### Physical Isolation

Gemini Lite achieves security through **physical isolation** - dangerous code simply doesn't exist in the bundle:

```
┌─────────────────────────────────────────┐
│         gemini-lite package             │
│                                         │
│  ✅ Read-only tools (copied)            │
│  ✅ Agentic loop (forked & simplified) │
│  ✅ Type definitions                    │
│  ✅ Validation functions                │
│                                         │
│  ❌ NO shell execution code             │
│  ❌ NO file write/edit code             │
│  ❌ NO MCP server code                  │
│  ❌ NO gemini-cli-core dependency       │
└─────────────────────────────────────────┘
```

### Agentic Loop

Uses a forked and simplified version of Gemini CLI's Turn class:

```typescript
// LLM autonomously requests file reads
for await (const event of turn.run(model, prompt, signal)) {
  switch (event.type) {
    case 'content':
      // Accumulate LLM response
      break;
    case 'tool_call_request':
      // LLM autonomously requests: read_file("src/auth.ts")
      // Tool executes and returns contents to LLM
      break;
    case 'finished':
      // Analysis complete
      break;
  }
}
```

## API Reference

### createGeminiLite(config)

Factory function to create GeminiLite instances.

```typescript
import { createGeminiLite } from '@shiftrightlabs/gemini-lite';

const gemini = createGeminiLite({
  auth: {
    apiKey: process.env.GEMINI_API_KEY,
    // OR use Vertex AI:
    // vertexAI: {
    //   projectId: 'my-project',
    //   location: 'us-central1',
    // }
  },
  workspaceDir: process.cwd(),
  model: 'gemini-2.5-pro', // optional, default: gemini-2.5-pro
  maxTokens: 4096, // optional
  temperature: 0.7, // optional
  timeout: 60000, // optional, default: 60s
  debug: false, // optional
});
```

### gemini.analyze(request)

Performs generic code analysis based on natural language prompt.

```typescript
const result = await gemini.analyze({
  prompt: 'Find all TODO comments and categorize by priority',
  files: ['src/**/*.ts'], // optional file path hints (NOT contents!)
  additionalContext: 'Focus on critical TODOs first', // optional
});

console.log(result.response); // Analysis text
console.log(result.metadata.tokensUsed); // Token usage
console.log(result.metadata.toolCalls); // Tool call statistics
```

### gemini.reviewPullRequest(options)

Reviews a pull request by comparing git branches.

```typescript
const review = await gemini.reviewPullRequest({
  baseBranch: 'main',
  headBranch: 'feature/user-auth', // optional, default: current
  focusAreas: ['security', 'bugs'], // optional
  format: 'markdown', // optional: 'markdown' | 'json'
});

console.log(review.summary);
review.issues.forEach(issue => {
  console.log(`[${issue.severity}] ${issue.file}:${issue.line}`);
  console.log(`  ${issue.message}`);
});
```

### gemini.explainCode(options)

Explains code with configurable detail level.

```typescript
const explanation = await gemini.explainCode({
  file: 'src/auth.ts',
  lineStart: 45, // optional
  lineEnd: 78, // optional
  detail: 'expert', // optional: 'high-level' | 'detailed' | 'expert'
});

console.log(explanation.response);
```

### gemini.analyzeCIFailure(options)

Analyzes CI/CD failure logs.

```typescript
const analysis = await gemini.analyzeCIFailure({
  logFile: 'build.log', // OR use logContent: string
  buildCommand: 'npm run build', // optional
  contextFiles: ['package.json', 'tsconfig.json'], // optional
});

console.log('Root Cause:', analysis.response);
```

### gemini.summarizeCodebase(options)

Generates codebase summary.

```typescript
const summary = await gemini.summarizeCodebase({
  depth: 'comprehensive', // optional: 'overview' | 'moderate' | 'comprehensive'
  focus: ['architecture', 'patterns'], // optional
  includeMetrics: true, // optional
});

console.log(summary.response);
```

### gemini.close()

Releases resources (idempotent).

```typescript
await gemini.close();
```

## Examples

### GitHub Action for PR Review

```yaml
name: AI Code Review
on: pull_request

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install -g @shiftrightlabs/gemini-lite

      - name: Review PR
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          node -e "
          import('@shiftrightlabs/gemini-lite').then(async ({ createGeminiLite }) => {
            const gemini = createGeminiLite({
              auth: { apiKey: process.env.GEMINI_API_KEY },
              workspaceDir: process.cwd()
            });

            const result = await gemini.reviewPullRequest({
              baseBranch: 'main',
              focusAreas: ['security', 'bugs'],
            });

            console.log(result.response);
            await gemini.close();
          });
          "
```

### CI Failure Explainer Script

```typescript
// scripts/explain-ci-failure.ts
import { createGeminiLite } from '@shiftrightlabs/gemini-lite';
import { readFileSync } from 'fs';

async function explainFailure() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY! },
    workspaceDir: process.cwd(),
  });

  const buildLog = readFileSync('build.log', 'utf-8');

  const result = await gemini.analyzeCIFailure({
    logContent: buildLog.slice(-10000), // Last 10k chars
    buildCommand: process.argv[2] || 'npm run build',
  });

  console.log('\n🔍 AI Analysis of Build Failure:\n');
  console.log(result.response);
  console.log(`\n(Analysis took ${result.metadata.duration}ms)`);

  await gemini.close();
}

explainFailure().catch(console.error);
```

### Code Quality Dashboard

```typescript
import { createGeminiLite } from '@shiftrightlabs/gemini-lite';

export class CodeQualityAnalyzer {
  private gemini: GeminiLite;

  constructor() {
    this.gemini = createGeminiLite({
      auth: { apiKey: process.env.GEMINI_API_KEY! },
      workspaceDir: process.cwd(),
    });
  }

  async analyzeProject() {
    const summary = await this.gemini.summarizeCodebase({
      depth: 'comprehensive',
      focus: ['quality', 'patterns'],
      includeMetrics: true,
    });

    const issues = await this.gemini.analyze({
      prompt: `
        Analyze this codebase for:
        1. Code smells and anti-patterns
        2. Potential performance bottlenecks
        3. Security vulnerabilities
        4. Technical debt areas
      `,
    });

    return {
      summary: summary.response,
      issues: issues.response,
      timestamp: new Date().toISOString(),
    };
  }

  async close() {
    await this.gemini.close();
  }
}
```

## Security

### Read-Only Guarantee

Gemini Lite is **guaranteed read-only** through multiple layers:

1. **Build-Time Verification** - Automated scanning rejects dangerous code patterns
2. **Physical Isolation** - Mutation code doesn't exist in the bundle
3. **Path Validation** - All file operations restricted to workspace
4. **Tool Registry** - Only read-only tools are registered

### Auditing

Every build runs security verification:

```bash
npm run verify-readonly
```

This scans for forbidden patterns:
- File system mutations (`fs.writeFile`, `fs.unlink`, etc.)
- Shell execution (`child_process.exec`, etc.)
- Dangerous tool references (`ShellTool`, `WriteTool`, etc.)
- Imports from `@google/gemini-cli-core`

If any violations are found, the build fails.

### Reporting Security Issues

Please report security vulnerabilities to: [GitHub Security Advisories](https://github.com/shiftrightlabs/gemini-lite/security/advisories)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Key Principles:**

1. **Maintain Read-Only Status** - Never add mutation capabilities
2. **Physical Isolation** - No dependencies on `@google/gemini-cli-core`
3. **Build Verification** - Always run `npm run verify-readonly`
4. **Test Coverage** - Maintain >85% test coverage
5. **Documentation** - Update docs for all API changes

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [README.md](https://github.com/shiftrightlabs/gemini-lite#readme)
- **Issues**: [GitHub Issues](https://github.com/shiftrightlabs/gemini-lite/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shiftrightlabs/gemini-lite/discussions)

---

**Note:** Gemini Lite is a derivative of the [Gemini CLI](https://github.com/google/gemini-cli) project (Apache 2.0), maintained by ShiftRight Labs as a standalone package for **non-interactive, library-based use cases** such as CI pipelines, automated code analysis, and programmatic integrations requiring guaranteed read-only access. See [NOTICE](NOTICE) for attribution details.
