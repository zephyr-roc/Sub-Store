import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlobBinding } from '../src/blob-binding.mjs';

function mockBlob() {
    const values = new Map();
    const calls = [];
    return {
        calls,
        values,
        async get(key, options) {
            calls.push({ operation: 'get', key, options });
            return values.get(key) ?? null;
        },
        async set(key, value) {
            calls.push({ operation: 'set', key, value });
            values.set(key, value);
        },
        async delete(key) {
            calls.push({ operation: 'delete', key });
            values.delete(key);
        },
    };
}

test('reads raw JSON documents with strong consistency', async () => {
    const store = mockBlob();
    const adapter = createBlobBinding(store);
    const payload = '{"settings":{"test":true}}';
    await adapter.put('sub-store', payload);
    assert.equal(await adapter.get('sub-store', 'text', { cacheTtl: 60 }), payload);
    assert.deepEqual(store.calls[1].options, { type: 'text', consistency: 'strong' });
});

test('separates root data and percent-encodes storage keys', async () => {
    const store = mockBlob();
    const adapter = createBlobBinding(store);
    await adapter.put('root', '{}');
    await adapter.put('my key/secret', 'value');
    assert.equal(await adapter.get('root'), '{}');
    assert.equal(await adapter.get('my key/secret'), 'value');
    assert.equal(store.values.size, 2);
    await adapter.delete('my key/secret');
    assert.equal(await adapter.get('my key/secret'), null);
});

test('storage errors reject rather than silently resetting persistent data', async () => {
    const adapter = createBlobBinding({
        async get() { throw new Error('storage temporarily unavailable'); },
    });
    await assert.rejects(() => adapter.get('sub-store'), /temporarily unavailable/);
});
