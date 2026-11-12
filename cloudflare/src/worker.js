import subStore from './index.js';
import { normalizeBackendPath } from './utils/backend-path.js';

const CRON_PATH = '/__internal_sub_store_cron';
const INSTANCE_NAME = 'sub-store-personal';

function failClosed() {
    return new Response(JSON.stringify({
        status: 'failed',
        message: 'Set the SUB_STORE_FRONTEND_BACKEND_PATH secret before deploying',
    }), {
        status: 503,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
}

export class SubStoreInstance {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.queue = Promise.resolve();
        this.store = {
            get: async (key) => (await state.storage.get(key)) ?? null,
            put: async (key, value) => state.storage.put(key, value),
            delete: async (key) => state.storage.delete(key),
        };
    }

    fetch(request) {
        const run = async () => {
            const pending = [];
            const ctx = {
                waitUntil(promise) {
                    pending.push(Promise.resolve(promise));
                },
            };
            const runtimeEnv = { ...this.env, SUB_STORE_DATA: this.store };
            let response;
            if (new URL(request.url).pathname === CRON_PATH) {
                await subStore.scheduled({}, runtimeEnv, ctx);
                response = new Response('OK');
            } else {
                response = await subStore.fetch(request, runtimeEnv, ctx);
            }
            // Writes must finish before the next request enters the legacy
            // mutable-cache lifecycle. Ordinary waitUntil is not sufficient.
            await Promise.all(pending);
            return response;
        };

        const response = this.queue.then(run);
        this.queue = response.then(() => undefined, () => undefined);
        return response;
    }
}

export default {
    fetch(request, env) {
        const path = new URL(request.url).pathname;
        if (path === CRON_PATH) {
            return new Response('Not Found', { status: 404 });
        }
        if (!normalizeBackendPath(env.SUB_STORE_FRONTEND_BACKEND_PATH)) {
            return failClosed();
        }
        if (path === '/') {
            return Response.redirect('https://sub-store.vercel.app/', 302);
        }
        if (!env.SUB_STORE_INSTANCE) {
            return new Response('Missing SUB_STORE_INSTANCE Durable Object binding', { status: 503 });
        }
        const id = env.SUB_STORE_INSTANCE.idFromName(INSTANCE_NAME);
        return env.SUB_STORE_INSTANCE.get(id).fetch(request);
    },
    scheduled(event, env, ctx) {
        if (!normalizeBackendPath(env.SUB_STORE_FRONTEND_BACKEND_PATH)) {
            console.error('Sub-Store cron skipped: missing authentication secret');
            return;
        }
        const id = env.SUB_STORE_INSTANCE.idFromName(INSTANCE_NAME);
        ctx.waitUntil(env.SUB_STORE_INSTANCE.get(id).fetch(
            new Request('https://internal.invalid' + CRON_PATH, { method: 'POST' })
        ));
    },
};
