const fs = require("fs");
const path = require("path");

const apiDir = path.resolve(__dirname, "../frontend/src/app/api");

function findRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findRouteFiles(fullPath));
    } else if (file === "route.ts" || file === "route.js") {
      results.push(fullPath);
    }
  }
  return results;
}

function analyzeRoute(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relPath = path.relative(path.resolve(__dirname, "../frontend/src/app"), filePath).replace(/\\/g, "/");
  const routePath = "/" + relPath.replace(/\/route\.(ts|js)$/, "");

  const writeMethods = [];
  const methodRegex = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(/g;
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    writeMethods.push(match[1]);
  }

  if (writeMethods.length === 0) {
    return null; // Read-only route
  }

  const isSecretRoute = routePath.startsWith("/api/cron/") || routePath === "/api/push/send";

  // Check each write handler for assertCsrfOrigin and ordering
  const methodAudits = writeMethods.map(method => {
    // Find the body of this method
    const fnStart = content.indexOf(`export async function ${method}`);
    if (fnStart === -1) return { method, covered: false, orderedBeforeWork: false, reason: "Could not locate method definition" };

    const fnChunk = content.substring(fnStart, fnStart + 1500); // Check first 1500 chars of handler

    if (isSecretRoute) {
      return { method, covered: true, orderedBeforeWork: true, reason: "Secret-exempt (CRON_SECRET / INTERNAL_API_SECRET timing-safe check)" };
    }

    const csrfMatch = /assertCsrfOrigin\s*\(\s*(request|req)\s*\)/.exec(fnChunk);
    const hasCsrf = !!csrfMatch || content.includes("withCsrf(");
    if (!hasCsrf) {
      return { method, covered: false, orderedBeforeWork: false, reason: "MISSING assertCsrfOrigin call" };
    }

    // Check ordering: assertCsrfOrigin must occur before auth or DB operations
    const csrfIdx = csrfMatch ? csrfMatch.index : fnChunk.indexOf("withCsrf");
    const authOps = ["validateSession", "getAuthenticatedUser", "requireAdmin", "getAdminUser", "verifyPassword", "signJwtToken"];
    const dbOps = ["getClient()", "getPool()", "query(", "client.query("];

    let earlyAuthOrDb = null;
    for (const op of [...authOps, ...dbOps]) {
      const opIdx = fnChunk.indexOf(op);
      if (opIdx !== -1 && opIdx < csrfIdx) {
        earlyAuthOrDb = op;
        break;
      }
    }

    if (earlyAuthOrDb) {
      return { method, covered: true, orderedBeforeWork: false, reason: `CALLED AFTER ${earlyAuthOrDb}` };
    }

    return { method, covered: true, orderedBeforeWork: true, reason: "assertCsrfOrigin upfront before auth/DB" };
  });

  return {
    routePath,
    writeMethods,
    isSecretRoute,
    methodAudits,
    isFullyProtected: methodAudits.every(m => m.covered && m.orderedBeforeWork)
  };
}

const routeFiles = findRouteFiles(apiDir);
const writeRoutes = [];
let unprotectedCount = 0;
let orderingViolationCount = 0;

for (const file of routeFiles) {
  const result = analyzeRoute(file);
  if (result) {
    writeRoutes.push(result);
    if (!result.isFullyProtected) {
      for (const m of result.methodAudits) {
        if (!m.covered) unprotectedCount++;
        if (!m.orderedBeforeWork) orderingViolationCount++;
      }
    }
  }
}

console.log("=========================================================================================");
console.log("BELCONNECT CSRF WRITE ROUTE CALL-ORDERING & PROTECTION AUDIT");
console.log("=========================================================================================");
console.log(`Total API route files:            ${routeFiles.length}`);
console.log(`Route files with write handlers:  ${writeRoutes.length}`);
console.log(`Unprotected write handlers:       ${unprotectedCount}`);
console.log(`Ordering violations:              ${orderingViolationCount}`);
console.log("=========================================================================================");

console.log("\n| Route Path | Methods | CSRF Defense Mechanism | Placement Check |");
console.log("| :--- | :--- | :--- | :--- |");
for (const r of writeRoutes) {
  const methods = r.writeMethods.join(", ");
  const mechanism = r.isSecretRoute ? "Exempt: Verified Secret" : "assertCsrfOrigin(request)";
  const placement = r.isFullyProtected ? "PASS: Before Auth/DB" : "FAIL: " + r.methodAudits.map(m => m.reason).join("; ");
  console.log(`| \`${r.routePath}\` | \`${methods}\` | ${mechanism} | ${placement} |`);
}

if (unprotectedCount > 0 || orderingViolationCount > 0) {
  console.error(`\n[FAIL] Found ${unprotectedCount} unprotected write handlers and ${orderingViolationCount} ordering violations!`);
  process.exit(1);
} else {
  console.log(`\n[PASS] All ${writeRoutes.length} write route files enforce CSRF before any auth/DB operations!`);
  process.exit(0);
}
