import { cacheEntryId, cosine, embed } from './semantic.js';

const RATE_LIMIT_SCRIPT = `
local key, now, window, limit, member = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')[2]
  return {0, math.ceil((tonumber(oldest) + window - now) / 1000)}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, 0}
`;

export class RedisGatewayStore {
  constructor(client, { cacheTtlSeconds = 3600, similarityThreshold = 0.88 } = {}) {
    this.client = client;
    this.cacheTtlSeconds = cacheTtlSeconds;
    this.similarityThreshold = similarityThreshold;
  }

  async takeRateLimit(tenantId, limit, windowMs = 60_000) {
    const now = Date.now();
    const result = await this.client.eval(RATE_LIMIT_SCRIPT, {
      keys: [`rate:${tenantId}`],
      arguments: [String(now), String(windowMs), String(limit), `${now}:${Math.random()}`]
    });
    return { allowed: Number(result[0]) === 1, retryAfterSeconds: Number(result[1]) };
  }

  async getSemantic(namespace, prompt) {
    const query = embed(prompt);
    const ids = await this.client.sMembers(`cache:index:${namespace}`);
    if (!ids.length) return null;
    const records = await this.client.mGet(ids.map((id) => `cache:entry:${id}`));
    let best = null;
    for (let index = 0; index < records.length; index += 1) {
      if (!records[index]) {
        await this.client.sRem(`cache:index:${namespace}`, ids[index]);
        continue;
      }
      const entry = JSON.parse(records[index]);
      const score = cosine(query, entry.vector);
      if (!best || score > best.score) best = { ...entry, score };
    }
    return best?.score >= this.similarityThreshold ? best.content : null;
  }

  async putSemantic(namespace, prompt, content) {
    const id = cacheEntryId();
    const entryKey = `cache:entry:${id}`;
    await this.client.multi()
      .set(entryKey, JSON.stringify({ vector: embed(prompt), content }), { EX: this.cacheTtlSeconds })
      .sAdd(`cache:index:${namespace}`, id)
      .expire(`cache:index:${namespace}`, this.cacheTtlSeconds)
      .exec();
  }
}
