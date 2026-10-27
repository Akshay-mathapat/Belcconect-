#!/usr/bin/env node

/**
 * CI Guard: check-auth-await.js
 * Scans all Next.js API routes under frontend/src/app/api to ensure that
 * every call to `getAuthenticatedUser` or `getSessionUser` is explicitly awaited.
 * Fails CI (exit code 1) if any unawaited call is found.
 */

const fs = require("fs");
const path = require("path");

const API_DIR = path.resolve(__dirname, "../src/app/api");

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".js") || file.endsWith(".tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const targetFunctions = ["getAuthenticatedUser", "getSessionUser"];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const errors = [];
  let callCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comment lines and import statements
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("import ")) {
      continue;
    }

    for (const fn of targetFunctions) {
      // Find occurrences of fn(
      const fnRegex = new RegExp(`(?<![a-zA-Z0-9_])${fn}\\s*\\(`, "g");
      let match;
      while ((match = fnRegex.exec(line)) !== null) {
        // Exclude function declarations / definitions (e.g., function getAuthenticatedUser...)
        const beforeMatch = line.slice(0, match.index).trim();
        if (
          beforeMatch.startsWith("function") ||
          beforeMatch.startsWith("export function") ||
          beforeMatch.startsWith("export async function") ||
          beforeMatch.startsWith("async function") ||
          beforeMatch.endsWith("function")
        ) {
          continue;
        }

        callCount++;

        // Verify that 'await' immediately precedes the function call (ignoring whitespace)
        // Check text immediately before match
        const precedingText = line.slice(0, match.index);
        const hasAwait = /\bawait\s+$/.test(precedingText);

        if (!hasAwait) {
          errors.push({
            file: path.relative(path.resolve(__dirname, ".."), filePath),
            line: i + 1,
            code: line.trim(),
            fn,
          });
        }
      }
    }
  }

  return { errors, callCount };
}

function run() {
  const allFiles = walkDir(API_DIR);
  let totalCalls = 0;
  let totalErrors = [];
  let filesChecked = 0;

  for (const file of allFiles) {
    const { errors, callCount } = checkFile(file);
    if (callCount > 0) {
      filesChecked++;
      totalCalls += callCount;
    }
    if (errors.length > 0) {
      totalErrors.push(...errors);
    }
  }

  console.log(`[check:auth-await] Scanned ${allFiles.length} API files.`);
  console.log(`[check:auth-await] Found ${totalCalls} auth function calls across ${filesChecked} route files.`);

  if (totalErrors.length > 0) {
    console.error(`\n[FAIL] Found ${totalErrors.length} UN-AWAITED auth call(s):`);
    for (const err of totalErrors) {
      console.error(`  - ${err.file}:${err.line} -> ${err.code} (missing await for ${err.fn})`);
    }
    process.exit(1);
  }

  console.log(`[PASS] All ${totalCalls} auth function calls are properly awaited with 'await'.\n`);
  process.exit(0);
}

run();

