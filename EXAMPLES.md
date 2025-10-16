# Gemini Lite - Usage Examples

Complete collection of real-world examples for using Gemini Lite in various scenarios.

---

## Table of Contents

- [Basic Usage](#basic-usage)
- [Pull Request Reviews](#pull-request-reviews)
- [Code Explanation](#code-explanation)
- [CI/CD Integration](#cicd-integration)
- [Codebase Analysis](#codebase-analysis)
- [Custom Analysis](#custom-analysis)
- [Error Handling](#error-handling)
- [Advanced Patterns](#advanced-patterns)

---

## Basic Usage

### Minimal Example

```typescript
import { createGeminiLite } from '@google/gemini-lite';

const gemini = createGeminiLite({
  auth: { apiKey: process.env.GEMINI_API_KEY },
  workspaceDir: process.cwd(),
});

const result = await gemini.analyze({
  prompt: 'What does this codebase do?',
});

console.log(result.response);
await gemini.close();
```

### With Configuration

```typescript
import { createGeminiLite } from '@google/gemini-lite';

const gemini = createGeminiLite({
  auth: { apiKey: process.env.GEMINI_API_KEY },
  workspaceDir: '/path/to/project',

  // Model configuration
  model: 'gemini-2.0-flash-exp',
  maxTokens: 8192,
  temperature: 0.7,

  // Operational limits
  timeout: 90000, // 90 seconds
  maxSessionTurns: 20,

  // File patterns
  respectGitignore: true,
  geminiIgnorePatterns: ['*.test.ts', 'dist/**'],

  // Debug mode
  debug: true,
});

try {
  const result = await gemini.analyze({
    prompt: 'Review this code for security issues',
  });

  console.log('Response:', result.response);
  console.log('Tokens used:', result.metadata.tokensUsed.total);
  console.log('Tool calls:', result.metadata.toolCalls.totalCalls);
  console.log('Duration:', result.metadata.duration, 'ms');

} finally {
  await gemini.close();
}
```

---

## Pull Request Reviews

### Basic PR Review

```typescript
import { createGeminiLite } from '@google/gemini-lite';

async function reviewPR() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const review = await gemini.reviewPullRequest({
      baseBranch: 'main',
      headBranch: 'feature/user-authentication',
      focusAreas: ['security', 'bugs', 'performance'],
      format: 'markdown',
    });

    console.log('=== PR Review Summary ===');
    console.log(review.summary);
    console.log(`\n=== Issues Found (${review.issues.length}) ===`);

    review.issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. [${issue.severity.toUpperCase()}] ${issue.category}`);
      console.log(`   File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      console.log(`   Issue: ${issue.message}`);
      if (issue.suggestion) {
        console.log(`   Fix: ${issue.suggestion}`);
      }
    });

    console.log('\n=== Recommendations ===');
    review.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });

  } finally {
    await gemini.close();
  }
}

reviewPR().catch(console.error);
```

### Security-Focused PR Review

```typescript
async function securityReview() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const review = await gemini.reviewPullRequest({
      baseBranch: 'main',
      focusAreas: ['security'],
      format: 'json',
    });

    // Filter critical security issues
    const criticalIssues = review.issues.filter(
      issue => issue.severity === 'critical' && issue.category === 'security'
    );

    if (criticalIssues.length > 0) {
      console.error('🚨 CRITICAL SECURITY ISSUES FOUND!');
      console.error(JSON.stringify(criticalIssues, null, 2));
      process.exit(1);
    }

    console.log('✅ No critical security issues found');

  } finally {
    await gemini.close();
  }
}
```

### GitHub Action PR Review

```typescript
// .github/actions/ai-review/index.ts
import { createGeminiLite } from '@google/gemini-lite';
import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const gemini = createGeminiLite({
      auth: { apiKey: process.env.GEMINI_API_KEY! },
      workspaceDir: process.cwd(),
    });

    const review = await gemini.reviewPullRequest({
      baseBranch: github.context.payload.pull_request?.base?.ref || 'main',
      headBranch: github.context.payload.pull_request?.head?.ref,
      focusAreas: ['security', 'bugs', 'performance'],
    });

    // Post as PR comment
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN!);
    await octokit.rest.issues.createComment({
      ...github.context.repo,
      issue_number: github.context.payload.pull_request!.number,
      body: `## 🤖 AI Code Review\n\n${review.response}`,
    });

    // Fail if critical issues found
    const criticalCount = review.issues.filter(i => i.severity === 'critical').length;
    if (criticalCount > 0) {
      core.setFailed(`Found ${criticalCount} critical issues`);
    }

    await gemini.close();

  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

run();
```

---

## Code Explanation

### High-Level Overview

```typescript
import { createGeminiLite } from '@google/gemini-lite';

async function explainModule() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const explanation = await gemini.explainCode({
      file: 'src/auth/jwt.ts',
      detail: 'high-level',
    });

    console.log('=== High-Level Overview ===');
    console.log(explanation.response);

  } finally {
    await gemini.close();
  }
}
```

### Expert-Level Deep Dive

```typescript
async function expertAnalysis() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const explanation = await gemini.explainCode({
      file: 'src/crypto/encryption.ts',
      lineStart: 45,
      lineEnd: 120,
      detail: 'expert',
    });

    console.log('=== Expert Analysis ===');
    console.log(explanation.response);
    console.log(`\n(Used ${explanation.metadata.tokensUsed.total} tokens)`);

  } finally {
    await gemini.close();
  }
}
```

### Generate Documentation

```typescript
import { createGeminiLite } from '@google/gemini-lite';
import { writeFileSync } from 'fs';

async function generateDocs() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  const files = [
    'src/api/users.ts',
    'src/api/auth.ts',
    'src/api/posts.ts',
  ];

  const docs = [];

  try {
    for (const file of files) {
      console.log(`Documenting ${file}...`);

      const explanation = await gemini.explainCode({
        file,
        detail: 'detailed',
      });

      docs.push({
        file,
        documentation: explanation.response,
      });
    }

    // Write to markdown
    const markdown = docs.map(({ file, documentation }) =>
      `# ${file}\n\n${documentation}\n\n---\n`
    ).join('\n');

    writeFileSync('GENERATED_DOCS.md', markdown);
    console.log('✅ Documentation generated!');

  } finally {
    await gemini.close();
  }
}
```

---

## CI/CD Integration

### Analyze Build Failure

```typescript
import { createGeminiLite } from '@google/gemini-lite';
import { readFileSync } from 'fs';

async function analyzeBuildFailure() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const logContent = readFileSync('build.log', 'utf-8');

    const analysis = await gemini.analyzeCIFailure({
      logContent: logContent.slice(-20000), // Last 20k chars
      buildCommand: 'npm run build',
      contextFiles: [
        'package.json',
        'tsconfig.json',
        'webpack.config.js',
      ],
    });

    console.log('=== Build Failure Analysis ===');
    console.log(analysis.response);
    console.log(`\nAnalysis completed in ${analysis.metadata.duration}ms`);

  } finally {
    await gemini.close();
  }
}

analyzeBuildFailure().catch(console.error);
```

### Test Failure Debugger

```typescript
async function debugTestFailure() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const testLog = readFileSync('test-results.log', 'utf-8');

    const analysis = await gemini.analyzeCIFailure({
      logContent: testLog,
      buildCommand: 'npm test',
      contextFiles: [
        'vitest.config.ts',
        'src/__tests__/auth.test.ts',
      ],
    });

    console.log('🔍 Test Failure Analysis:');
    console.log(analysis.response);

  } finally {
    await gemini.close();
  }
}
```

### CI Pipeline Integration

```bash
#!/bin/bash
# scripts/analyze-ci-failure.sh

set -e

# Capture last 50 lines of build log
BUILD_LOG=$(tail -50 build.log)

# Run analysis
node -e "
import('@google/gemini-lite').then(async ({ createGeminiLite }) => {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd()
  });

  const result = await gemini.analyzeCIFailure({
    logContent: \`${BUILD_LOG}\`,
    buildCommand: 'npm run build',
  });

  console.log('=== AI Analysis ===');
  console.log(result.response);

  await gemini.close();
});
"
```

---

## Codebase Analysis

### Quick Overview

```typescript
import { createGeminiLite } from '@google/gemini-lite';

async function getOverview() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const summary = await gemini.summarizeCodebase({
      depth: 'overview',
      includeMetrics: true,
    });

    console.log(summary.response);

  } finally {
    await gemini.close();
  }
}
```

### Comprehensive Architecture Analysis

```typescript
async function analyzeArchitecture() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
    timeout: 120000, // 2 minutes for large codebase
  });

  try {
    const summary = await gemini.summarizeCodebase({
      depth: 'comprehensive',
      focus: ['architecture', 'patterns', 'quality'],
      includeMetrics: true,
    });

    console.log('=== Comprehensive Architecture Analysis ===');
    console.log(summary.response);
    console.log(`\nAnalyzed in ${summary.metadata.duration}ms`);
    console.log(`Tool calls: ${summary.metadata.toolCalls.totalCalls}`);

  } finally {
    await gemini.close();
  }
}
```

### Onboarding Documentation Generator

```typescript
import { createGeminiLite } from '@google/gemini-lite';
import { writeFileSync } from 'fs';

async function generateOnboardingDoc() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    // Get comprehensive summary
    const summary = await gemini.summarizeCodebase({
      depth: 'comprehensive',
      focus: ['architecture', 'patterns', 'dependencies'],
      includeMetrics: true,
    });

    // Get key file explanations
    const keyFiles = await gemini.analyze({
      prompt: `
        Identify the 5 most important files in this codebase
        that a new developer should understand first.
        For each file, provide a brief explanation of its purpose.
      `,
    });

    // Generate onboarding document
    const doc = `# Developer Onboarding Guide

Generated: ${new Date().toISOString()}

## Codebase Overview

${summary.response}

## Key Files to Understand

${keyFiles.response}

## Next Steps

1. Read through the key files identified above
2. Review the architecture section
3. Explore the codebase using the patterns described
4. Ask questions in team channels

---

*This document was automatically generated using Gemini Lite*
`;

    writeFileSync('ONBOARDING.md', doc);
    console.log('✅ Onboarding documentation generated!');

  } finally {
    await gemini.close();
  }
}
```

---

## Custom Analysis

### Find Code Patterns

```typescript
async function findPatterns() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const result = await gemini.analyze({
      prompt: `
        Find all files that use React hooks.
        For each file, identify:
        1. Which hooks are used (useState, useEffect, custom hooks, etc.)
        2. Any potential issues with hook usage
        3. Suggestions for improvement
      `,
    });

    console.log(result.response);

  } finally {
    await gemini.close();
  }
}
```

### Security Audit

```typescript
async function securityAudit() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    const result = await gemini.analyze({
      prompt: `
        Perform a comprehensive security audit:

        1. Authentication and Authorization:
           - How are users authenticated?
           - Are there any auth bypass vulnerabilities?
           - Is authorization properly enforced?

        2. Input Validation:
           - Where is user input accepted?
           - Is input properly sanitized?
           - Any SQL injection or XSS vulnerabilities?

        3. Data Protection:
           - How is sensitive data stored?
           - Is encryption used properly?
           - Any hardcoded secrets?

        4. API Security:
           - Are API endpoints properly secured?
           - Rate limiting implemented?
           - CORS configured correctly?

        Provide specific file and line references for all findings.
      `,
    });

    console.log('=== Security Audit Report ===');
    console.log(result.response);

  } finally {
    await gemini.close();
  }
}
```

### Technical Debt Analysis

```typescript
async function analyzeTechnicalDebt() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  try {
    // Find TODOs
    const todos = await gemini.analyze({
      prompt: 'Find all TODO and FIXME comments. Categorize by priority and affected component.',
    });

    // Find code smells
    const smells = await gemini.analyze({
      prompt: `
        Identify code smells and anti-patterns:
        - Large functions (>50 lines)
        - Deep nesting (>3 levels)
        - Duplicated code
        - Complex conditionals
        - God objects
        Provide specific examples with file and line numbers.
      `,
    });

    // Find outdated patterns
    const outdated = await gemini.analyze({
      prompt: `
        Identify outdated patterns that should be refactored:
        - Deprecated API usage
        - Old React patterns (class components, etc.)
        - Outdated dependencies
        - Legacy authentication methods
      `,
    });

    console.log('=== Technical Debt Report ===\n');
    console.log('## TODOs and FIXMEs\n');
    console.log(todos.response);
    console.log('\n## Code Smells\n');
    console.log(smells.response);
    console.log('\n## Outdated Patterns\n');
    console.log(outdated.response);

  } finally {
    await gemini.close();
  }
}
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
import {
  createGeminiLite,
  ClosedInstanceError,
  TimeoutError,
  ValidationError,
  AuthenticationError,
  FileNotFoundError,
} from '@google/gemini-lite';

async function robustAnalysis() {
  let gemini = null;

  try {
    gemini = createGeminiLite({
      auth: { apiKey: process.env.GEMINI_API_KEY },
      workspaceDir: process.cwd(),
    });

    const result = await gemini.analyze({
      prompt: 'Review this code',
    });

    console.log(result.response);

  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('❌ Authentication failed. Check your API key.');
    } else if (error instanceof TimeoutError) {
      console.error(`❌ Request timed out after ${error.timeout}ms`);
    } else if (error instanceof ValidationError) {
      console.error(`❌ Invalid input: ${error.message}`);
    } else if (error instanceof FileNotFoundError) {
      console.error(`❌ File not found: ${error.file}`);
    } else if (error instanceof ClosedInstanceError) {
      console.error('❌ Instance was already closed');
    } else {
      console.error('❌ Unexpected error:', error);
    }

    process.exit(1);

  } finally {
    if (gemini) {
      await gemini.close();
    }
  }
}
```

### Retry Logic

```typescript
async function analyzeWithRetry(prompt: string, maxRetries = 3) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const gemini = createGeminiLite({
      auth: { apiKey: process.env.GEMINI_API_KEY },
      workspaceDir: process.cwd(),
    });

    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);

      const result = await gemini.analyze({ prompt });
      await gemini.close();

      return result;

    } catch (error) {
      lastError = error as Error;
      await gemini.close();

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
```

---

## Advanced Patterns

### Batch Analysis

```typescript
import { createGeminiLite } from '@google/gemini-lite';

async function batchAnalysis() {
  const gemini = createGeminiLite({
    auth: { apiKey: process.env.GEMINI_API_KEY },
    workspaceDir: process.cwd(),
  });

  const files = [
    'src/api/users.ts',
    'src/api/auth.ts',
    'src/api/posts.ts',
    'src/api/comments.ts',
  ];

  const results = [];

  try {
    for (const file of files) {
      console.log(`Analyzing ${file}...`);

      const result = await gemini.explainCode({
        file,
        detail: 'detailed',
      });

      results.push({
        file,
        explanation: result.response,
        tokens: result.metadata.tokensUsed.total,
        duration: result.metadata.duration,
      });
    }

    // Summary
    const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n=== Batch Analysis Complete ===');
    console.log(`Files analyzed: ${results.length}`);
    console.log(`Total tokens: ${totalTokens}`);
    console.log(`Total duration: ${totalDuration}ms`);

    return results;

  } finally {
    await gemini.close();
  }
}
```

### Parallel Analysis

```typescript
async function parallelAnalysis() {
  const tasks = [
    'Find security vulnerabilities',
    'Identify performance bottlenecks',
    'Find code duplication',
    'Check for outdated dependencies',
  ];

  // Create separate instances for parallel execution
  const results = await Promise.all(
    tasks.map(async (prompt) => {
      const gemini = createGeminiLite({
        auth: { apiKey: process.env.GEMINI_API_KEY },
        workspaceDir: process.cwd(),
      });

      try {
        const result = await gemini.analyze({ prompt });
        return {
          task: prompt,
          response: result.response,
          metadata: result.metadata,
        };
      } finally {
        await gemini.close();
      }
    })
  );

  results.forEach(({ task, response, metadata }) => {
    console.log(`\n=== ${task} ===`);
    console.log(response);
    console.log(`(${metadata.tokensUsed.total} tokens, ${metadata.duration}ms)`);
  });
}
```

### Caching Results

```typescript
import { createGeminiLite } from '@google/gemini-lite';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

class CachedAnalyzer {
  private gemini;
  private cacheDir = '.gemini-cache';

  constructor() {
    this.gemini = createGeminiLite({
      auth: { apiKey: process.env.GEMINI_API_KEY! },
      workspaceDir: process.cwd(),
    });
  }

  private getCacheKey(prompt: string): string {
    return createHash('md5').update(prompt).digest('hex');
  }

  private getCachePath(key: string): string {
    return `${this.cacheDir}/${key}.json`;
  }

  async analyze(prompt: string, useCache = true) {
    const cacheKey = this.getCacheKey(prompt);
    const cachePath = this.getCachePath(cacheKey);

    // Check cache
    if (useCache && existsSync(cachePath)) {
      console.log('📦 Using cached result');
      return JSON.parse(readFileSync(cachePath, 'utf-8'));
    }

    // Perform analysis
    console.log('🔄 Analyzing...');
    const result = await this.gemini.analyze({ prompt });

    // Cache result
    if (!existsSync(this.cacheDir)) {
      require('fs').mkdirSync(this.cacheDir, { recursive: true });
    }
    writeFileSync(cachePath, JSON.stringify(result, null, 2));

    return result;
  }

  async close() {
    await this.gemini.close();
  }
}

// Usage
const analyzer = new CachedAnalyzer();
const result = await analyzer.analyze('What does this code do?');
console.log(result.response);
await analyzer.close();
```

---

**More examples and patterns coming in future updates!**

For complete API documentation, see [README.md](./README.md) and [PRESET_METHODS.md](./PRESET_METHODS.md).
