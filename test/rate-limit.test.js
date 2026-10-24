import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';

test('rate limit returns 429 and Retry-After when quota is exceeded', async () => {
  let requests = 0;

  const store = {
    client: { ping: async () => 'PONG' },
    takeRateLimit: async () => {
      requests += 1;
      return requests <= 1
        ? { allowed: true, retryAfterSeconds: 0 }
        : { allowed: false, retryAfterSeconds: 10 };
    },
    getSemantic: async () => null,
    putSemantic: async () => {}
  };

  const app = createApp({ store, rateLimit: 1 });
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/v1/chat/completions`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'demo-key'
      },
      body: JSON.stringify({
        model: 'demo-model',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    };

    const first = await fetch(url, options);
    assert.equal(first.status, 200);

    const second = await fetch(url, options);
    assert.equal(second.status, 429);
    assert.equal(second.headers.get('retry-after'), '10');
    assert.deepEqual(await second.json(), {
      error: { message: 'Rate limit exceeded' }
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
});
