const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'frontend/src/app/api');

function getRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getRouteFiles(fullPath));
    } else if (file === 'route.ts' || file === 'route.js') {
      results.push(fullPath);
    }
  }
  return results;
}

const allRoutes = getRouteFiles(apiDir);
console.log('Total API route files discovered:', allRoutes.length);

const authBreakdown = {
  usesGetAuthenticatedUser: [],
  sessionAuthenticatedInfra: [],
  usesCustomSecretAuth: [],
  authLifecycleHandlers: [],
  trulyPublicEndpoints: []
};

for (const routePath of allRoutes) {
  const relative = path.relative(apiDir, routePath).replace(/\\/g, '/');
  const code = fs.readFileSync(routePath, 'utf8');

  const hasGetAuthUser = code.includes('getAuthenticatedUser(');
  const hasCustomSecret = code.includes('CRON_SECRET') ||
                          code.includes('INTERNAL_API_SECRET') ||
                          code.includes('SIGNALING_INTERNAL_SECRET') ||
                          code.includes('verifyOAuthState(') ||
                          code.includes('createOAuthState(');

  if (hasGetAuthUser) {
    authBreakdown.usesGetAuthenticatedUser.push(relative);
  } else if (hasCustomSecret) {
    authBreakdown.usesCustomSecretAuth.push(relative);
  } else if (relative.includes('socket-ticket') || relative.includes('native-session')) {
    authBreakdown.sessionAuthenticatedInfra.push(relative);
  } else if (relative.startsWith('auth/') || relative.startsWith('admin/auth/')) {
    authBreakdown.authLifecycleHandlers.push(relative);
  } else {
    authBreakdown.trulyPublicEndpoints.push(relative);
  }
}

const totalCategorized = 
  authBreakdown.usesGetAuthenticatedUser.length +
  authBreakdown.usesCustomSecretAuth.length +
  authBreakdown.sessionAuthenticatedInfra.length +
  authBreakdown.authLifecycleHandlers.length +
  authBreakdown.trulyPublicEndpoints.length;

console.log(`================================================================`);
console.log(`API ROUTE AUDIT SUMMARY (${totalCategorized} routes)`);
console.log(`================================================================`);
console.log('1. Protected Routes (getAuthenticatedUser):       ', authBreakdown.usesGetAuthenticatedUser.length);
console.log('2. Session-Authenticated Infra (Cookie Required): ', authBreakdown.sessionAuthenticatedInfra.length);
console.log('3. Custom Secret / Token Auth:                    ', authBreakdown.usesCustomSecretAuth.length);
console.log('4. Auth Lifecycle (Login, Logout, Register, OTP): ', authBreakdown.authLifecycleHandlers.length);
console.log('5. Truly Public Endpoints (Health, Catalog, Map): ', authBreakdown.trulyPublicEndpoints.length);
console.log('================================================================');

console.log('\n--- 2. Session-Authenticated Infra (Cookie Required) ---');
authBreakdown.sessionAuthenticatedInfra.sort().forEach((r, i) => console.log(`  ${i+1}. /api/${r}`));

console.log('\n--- 3. Custom Secret / Token Auth ---');
authBreakdown.usesCustomSecretAuth.sort().forEach((r, i) => console.log(`  ${i+1}. /api/${r}`));

console.log('\n--- 4. Auth Lifecycle (Login, Logout, Register, OTP) ---');
authBreakdown.authLifecycleHandlers.sort().forEach((r, i) => console.log(`  ${i+1}. /api/${r}`));

console.log('\n--- 5. Truly Public Endpoints ---');
authBreakdown.trulyPublicEndpoints.sort().forEach((r, i) => console.log(`  ${i+1}. /api/${r}`));
