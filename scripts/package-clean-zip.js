const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "zip-files-manifest.txt");
const outputZip = path.join(rootDir, "belconnect-latest.zip");

const IGNORE_PATTERNS = [
  /^[\\/]?\.git([\\/]|$)/i,
  /^[\\/]?node_modules([\\/]|$)/i,
  /[\\/]node_modules([\\/]|$)/i,
  /^[\\/]?frontend[\\/]\.next([\\/]|$)/i,
  /[\\/]\.next([\\/]|$)/i,
  /^[\\/]?android[\\/]app[\\/]build([\\/]|$)/i,
  /[\\/]android[\\/]app[\\/]build([\\/]|$)/i,
  /^[\\/]?\.test-postgres-data([\\/]|$)/i,
  /[\\/]\.test-postgres-data([\\/]|$)/i,
  /\.env(\.|$)/i,
  /\.tsbuildinfo$/i,
  /\.log$/i,
  /\.zip$/i,
  /zip-files-manifest\.txt$/i
];

function isIgnored(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  return IGNORE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function walk(currentDir, fileList = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(rootDir, fullPath);

    if (isIgnored(relPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      walk(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(relPath.replace(/\\/g, "/"));
    }
  }
  return fileList;
}

console.log("[Packaging] Scanning repository for clean packaging...");
const files = walk(rootDir);
console.log(`[Packaging] Found ${files.length} clean source files.`);

// Verify NO forbidden files in the list
const violations = files.filter(isIgnored);
if (violations.length > 0) {
  console.error("[FATAL] Excluded files detected in manifest:", violations);
  process.exit(1);
}

fs.writeFileSync(manifestPath, files.join("\n"), "utf8");

// Remove old zip if present
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

console.log("[Packaging] Creating clean zip with tar.exe...");
execSync(`tar.exe -a -c -f "${outputZip}" -T "${manifestPath}"`, {
  cwd: rootDir,
  stdio: "inherit"
});

// Clean up manifest
if (fs.existsSync(manifestPath)) {
  fs.unlinkSync(manifestPath);
}

const stats = fs.statSync(outputZip);
console.log(`[SUCCESS] Generated clean archive: ${outputZip} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);

// Verify archive entries
console.log("[Packaging] Verifying archive contents...");
const archiveListing = execSync(`tar.exe -tf "${outputZip}"`, { encoding: "utf8" });
const archiveLines = archiveListing.split(/\r?\n/).filter(Boolean);

let forbiddenCount = 0;
for (const line of archiveLines) {
  if (isIgnored(line)) {
    console.error(`[VIOLATION FOUND IN ARCHIVE]: ${line}`);
    forbiddenCount++;
  }
}

if (forbiddenCount > 0) {
  console.error(`[FATAL] Archive contains ${forbiddenCount} forbidden entries!`);
  process.exit(1);
}

console.log(`[PASS] Verification passed: 0 forbidden files found across ${archiveLines.length} archive entries.`);

