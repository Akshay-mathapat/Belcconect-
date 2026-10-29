const { spawn } = require('child_process');
const path = require('path');

const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpass@localhost:5433/belconnect_test';

const u = new URL(testDbUrl);
const host = u.hostname.toLowerCase();

const ALLOWED_TEST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
if (!ALLOWED_TEST_HOSTS.has(host) && process.env.ALLOW_PROD_DB !== '1') {
  console.error(`FATAL: Guard blocked startup. Refusing connection to non-local host (${host}). Only localhost, 127.0.0.1, and ::1 are permitted without ALLOW_PROD_DB=1.`);
  process.exit(1);
}

console.log(`================================================================`);
console.log(` BelConnect Guarded Test Runner`);
console.log(` Target DB Host: ${u.hostname}:${u.port || 5432}`);
console.log(` Target Database: ${u.pathname.slice(1)}`);
console.log(` Production Guard: ACTIVE (allowlist: localhost, 127.0.0.1, ::1 only)`);
console.log(`================================================================`);

const env = {
  ...process.env,
  TEST_DATABASE_URL: testDbUrl,
  DATABASE_URL: testDbUrl,
  NODE_ENV: 'test',
  PORT: '3000'
};

const nextProcess = spawn('npx', ['next', 'dev', '--port', '3000', '--webpack'], {
  cwd: path.resolve(__dirname, '../frontend'),
  env,
  stdio: 'inherit',
  shell: true
});

nextProcess.on('error', (err) => {
  console.error('Failed to start Next.js test dev server:', err);
  process.exit(1);
});

