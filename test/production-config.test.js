import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

test('production startup fails when DEMO_API_KEY is missing', () => {
  const env = { ...process.env };
  delete env.DEMO_API_KEY;
  env.NODE_ENV = 'production';

  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    timeout: 5000
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEMO_API_KEY must be set in production/);
});
