import crypto from 'node:crypto';
import express from 'express';
import { cacheNamespace } from './semantic.js';

export function createApp({ store, provider = localProvider, rateLimit = Number(process.env.DEMO_RATE_LIMIT ?? 60) }) {
  const app = express();
  const metrics = { cache_hit: 0, cache_miss: 0, rate_limited: 0 };
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    res.set('X-Request-ID', crypto.randomUUID());
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      await store.client.ping();
      res.json({ status: 'ok', dependencies: { redis: 'ok' } });
    } catch {
      res.status(503).json({ status: 'degraded', dependencies: { redis: 'unavailable' } });
    }
  });

  app.get('/metrics', (_req, res) => {
    res.type('text/plain').send(Object.entries(metrics).map(([name, value]) => `aegis_requests_total{outcome="${name}"} ${value}`).join('\n'));
  });

  app.post('/v1/chat/completions', async (req, res, next) => {
    try {
      const tenant = authenticate(req.get('X-API-Key'));
      if (!tenant) return res.status(401).json({ error: { message: 'Invalid API key' } });
      if (!validRequest(req.body)) return res.status(400).json({ error: { message: 'model and messages are required' } });

      const quota = await store.takeRateLimit(tenant.id, rateLimit);
      if (!quota.allowed) {
        metrics.rate_limited += 1;
        return res.set('Retry-After', String(Math.max(1, quota.retryAfterSeconds))).status(429).json({ error: { message: 'Rate limit exceeded' } });
      }
      const { model, messages, temperature = 0 } = req.body;
      const systemPrompt = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n');
      const prompt = messages.map((message) => `${message.role}: ${message.content}`).join('\n');
      const scope = cacheNamespace({ tenantId: tenant.id, model, temperature, systemPrompt });
      const cached = await store.getSemantic(scope, prompt);
      if (cached) {
        metrics.cache_hit += 1;
        return res.set('X-Cache', 'HIT').json(response(model, cached, true));
      }
      const content = await provider({ model, messages, temperature });
      await store.putSemantic(scope, prompt, content);
      metrics.cache_miss += 1;
      return res.set('X-Cache', 'MISS').json(response(model, content, false));
    } catch (error) { next(error); }
  });

  app.use((error, _req, res, _next) => res.status(500).json({ error: { message: 'Gateway error' } }));
  return app;
}

function authenticate(apiKey) {
  if (apiKey === (process.env.DEMO_API_KEY ?? 'demo-key')) return { id: 'demo' };
  return null;
}

function validRequest(body) {
  return typeof body?.model === 'string' && Array.isArray(body.messages) && body.messages.length > 0 &&
    body.messages.every((message) => ['system', 'user', 'assistant'].includes(message.role) && typeof message.content === 'string');
}

function response(model, content, cached) {
  return { id: crypto.randomUUID(), object: 'chat.completion', model, cached, choices: [{ index: 0, message: { role: 'assistant', content } }] };
}

async function localProvider({ messages }) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  return `[local-demo] ${lastUserMessage}`;
}
