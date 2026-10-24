import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';

test('metrics endpoint exposes HTTP request count and duration', async () => {
  const store = {
    client: { ping: async () => 'PONG' }
  };

  const app = createApp({ store });
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/metrics`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /aegis_http_requests_total \d+/);
    assert.match(body, /aegis_http_request_duration_ms_total \d+\.\d{3}/);
    assert.doesNotMatch(body, /outcome="requests_total"/);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
});
