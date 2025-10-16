import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dangerous patterns that MUST NOT exist in the codebase
const FORBIDDEN_PATTERNS = [
  // File system mutations
  { pattern: /fs\.writeFile(?!Sync\s*\()/g, name: 'fs.writeFile' },
  { pattern: /writeFileSync/g, name: 'fs.writeFileSync' },
  { pattern: /fs\.appendFile/g, name: 'fs.appendFile' },
  { pattern: /appendFileSync/g, name: 'fs.appendFileSync' },
  { pattern: /fs\.unlink/g, name: 'fs.unlink' },
  { pattern: /unlinkSync/g, name: 'fs.unlinkSync' },
  { pattern: /fs\.rmdir/g, name: 'fs.rmdir' },
  { pattern: /rmdirSync/g, name: 'fs.rmdirSync' },
  { pattern: /fs\.rm\(/g, name: 'fs.rm' },
  { pattern: /rmSync/g, name: 'fs.rmSync' },
  { pattern: /fs\.mkdir/g, name: 'fs.mkdir' },
  { pattern: /mkdirSync/g, name: 'fs.mkdirSync' },
  { pattern: /fs\.rename/g, name: 'fs.rename' },
  { pattern: /renameSync/g, name: 'fs.renameSync' },
  { pattern: /fs\.copyFile/g, name: 'fs.copyFile' },
  { pattern: /copyFileSync/g, name: 'fs.copyFileSync' },
  { pattern: /fs\.chmod/g, name: 'fs.chmod' },
  { pattern: /chmodSync/g, name: 'fs.chmodSync' },
  { pattern: /fs\.chown/g, name: 'fs.chown' },
  { pattern: /chownSync/g, name: 'fs.chownSync' },

  // Shell execution
  { pattern: /child_process\.exec/g, name: 'child_process.exec' },
  { pattern: /child_process\.execSync/g, name: 'child_process.execSync' },
  { pattern: /child_process\.spawn/g, name: 'child_process.spawn' },
  { pattern: /child_process\.spawnSync/g, name: 'child_process.spawnSync' },
  { pattern: /child_process\.fork/g, name: 'child_process.fork' },
  { pattern: /child_process\.execFile/g, name: 'child_process.execFile' },

  // Imports from child_process (should never be imported)
  { pattern: /from\s+['"]child_process['"]/g, name: 'import from child_process' },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/g, name: 'require(child_process)' },

  // Dangerous tool names
  { pattern: /ShellTool/g, name: 'ShellTool' },
  { pattern: /WriteTool/g, name: 'WriteTool' },
  { pattern: /WriteFileTool/g, name: 'WriteFileTool' },
  { pattern: /EditTool/g, name: 'EditTool' },
  { pattern: /ReplaceTool/g, name: 'ReplaceTool' },

  // MCP server references
  { pattern: /MCPServer/g, name: 'MCPServer' },
  { pattern: /createMCPClient/g, name: 'createMCPClient' },
  { pattern: /MCPClientManager/g, name: 'MCPClientManager' },

  // Imports from gemini-cli-core (CRITICAL - ensures physical isolation)
  { pattern: /@google\/gemini-cli-core/g, name: '@google/gemini-cli-core import' },
];

/**
 * Recursively scans a directory for TypeScript/JavaScript files
 */
function scanDirectory(dir, results = []) {
  if (!existsSync(dir)) {
    return results;
  }

  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch (error) {
      console.warn(`Warning: Could not stat file ${fullPath}: ${error.message}`);
      continue;
    }

    if (stat.isDirectory()) {
      // Skip node_modules, dist, and test directories
      if (file !== 'node_modules' && file !== 'dist' && file !== '__tests__' && file !== 'coverage') {
        scanDirectory(fullPath, results);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      try {
        const content = readFileSync(fullPath, 'utf-8');

        for (const { pattern, name } of FORBIDDEN_PATTERNS) {
          pattern.lastIndex = 0; // Reset regex state
          const matches = content.match(pattern);
          if (matches) {
            results.push({
              file: fullPath,
              pattern: name,
              count: matches.length,
              lines: findMatchLines(content, pattern),
            });
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not read file ${fullPath}: ${error.message}`);
      }
    }
  }

  return results;
}

/**
 * Finds line numbers where pattern matches occur
 */
function findMatchLines(content, pattern) {
  const lines = content.split('\n');
  const matchingLines = [];

  pattern.lastIndex = 0; // Reset regex state

  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      matchingLines.push(i + 1);
    }
    pattern.lastIndex = 0; // Reset after each test
  }

  return matchingLines.slice(0, 5); // Return first 5 occurrences
}

// Run verification
console.log('🔍 Verifying gemini-lite is read-only...\n');

const srcDir = join(__dirname, '..', 'src');
const violations = scanDirectory(srcDir);

if (violations.length > 0) {
  console.error('❌ BUILD FAILED: Dangerous patterns detected\n');
  console.error('gemini-lite MUST be read-only. The following violations were found:\n');

  for (const { file, pattern, count, lines } of violations) {
    const relPath = file.replace(srcDir, 'src');
    console.error(`  ${relPath}:`);
    console.error(`    Pattern: ${pattern}`);
    console.error(`    Count: ${count} occurrence(s)`);
    console.error(`    Lines: ${lines.join(', ')}${lines.length === 5 ? ' (showing first 5)' : ''}`);
    console.error('');
  }

  console.error('CRITICAL SECURITY REQUIREMENT:');
  console.error('  gemini-lite achieves physical isolation by having ZERO mutation code.');
  console.error('  If dangerous code doesn\'t exist in the bundle, it cannot be executed.');
  console.error('');
  console.error('Please remove all mutation operations from the codebase.');
  process.exit(1);
}

console.log('✅ Read-only verification passed!');
console.log('   No dangerous patterns detected.');
console.log('   gemini-lite is physically isolated from mutation capabilities.');
process.exit(0);
