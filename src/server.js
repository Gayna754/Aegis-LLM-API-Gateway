import { createClient } from 'redis';
import { createApp } from './app.js';
import { RedisGatewayStore } from './redis-store.js';

if (process.env.NODE_ENV === 'production' && !process.env.DEMO_API_KEY) {
  throw new Error('DEMO_API_KEY must be set in production');
}

const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
client.on('error', (error) => {
  console.error('Redis Client Error:', error);
});
await client.connect();

const app = createApp({ store: new RedisGatewayStore(client) });
const port = Number(process.env.PORT ?? 8000);
app.listen(port, () => console.log(`Aegis gateway listening on :${port}`));
