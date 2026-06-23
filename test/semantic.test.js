import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheNamespace, cosine, embed } from '../src/semantic.js';

test('semantic vectors rank a near duplicate above an unrelated prompt', () => {
  const query = embed('explain semantic cache for llm applications');
  assert.ok(cosine(query, embed('please explain semantic cache for llm applications')) > 0.88);
  assert.ok(cosine(query, embed('how to bake a chocolate cake')) < 0.1);
});

test('cache namespace changes with a generation setting', () => {
  const base = { tenantId: 'acme', model: 'gpt', temperature: 0, systemPrompt: 'Be concise' };
  assert.notEqual(cacheNamespace(base), cacheNamespace({ ...base, temperature: 1 }));
});
