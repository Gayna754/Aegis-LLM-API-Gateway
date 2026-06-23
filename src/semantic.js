import crypto from 'node:crypto';

export function embed(text) {
  const counts = new Map();
  for (const token of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const magnitude = Math.sqrt([...counts.values()].reduce((sum, count) => sum + count ** 2, 0)) || 1;
  return Object.fromEntries([...counts].map(([token, count]) => [token, count / magnitude]));
}

export function cosine(left, right) {
  return Object.entries(left).reduce((sum, [token, value]) => sum + value * (right[token] ?? 0), 0);
}

export function cacheNamespace({ tenantId, model, temperature, systemPrompt }) {
  const material = `${tenantId}|${model}|${temperature}|${systemPrompt}`;
  return crypto.createHash('sha256').update(material).digest('hex');
}

export function cacheEntryId() {
  return crypto.randomUUID();
}
