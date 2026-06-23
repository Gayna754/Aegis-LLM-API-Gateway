import { createClient } from 'redis';
import { createApp } from './app.js';
import { RedisGatewayStore } from './redis-store.js';

const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
client.on('error', (error) => console.error('Redis Client Error:', error.message));
await client.connect();

const app = createApp({ store: new RedisGatewayStore(client) });
const port = Number(process.env.PORT ?? 8000);
app.listen(port, () => console.log(`Aegis gateway listening on :${port}`));
