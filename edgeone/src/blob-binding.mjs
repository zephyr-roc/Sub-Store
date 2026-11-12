const PREFIX = 'sub-store-state/';

export function createBlobBinding(store) {
    return {
        async get(key) {
            // Never use an edge-cached stale copy of mutable subscription data.
            return store.get(PREFIX + encodeURIComponent(key), {
                type: 'text',
                consistency: 'strong',
            });
        },
        async put(key, value) {
            return store.set(PREFIX + encodeURIComponent(key), String(value));
        },
        async delete(key) {
            return store.delete(PREFIX + encodeURIComponent(key));
        },
    };
}
