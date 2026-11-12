import subStore from '../../cloudflare/src/index.js';
import { getStore } from '@edgeone/pages-blob';
import { createBlobBinding } from './blob-binding.mjs';
import { normalizeBackendPath, matchesBackendPath } from '../../cloudflare/src/utils/backend-path.js';

let inflight = Promise.resolve();
const SECRET_PATTERN = /^\/[A-Za-z0-9_-]{32,}$/;

export function validateAccess(pathname, rawSecret) {
    const secret = normalizeBackendPath(rawSecret);
    if (!SECRET_PATTERN.test(secret)) return { status: 503, reason: 'Configure a secret management path (32+ random characters)' };
    if (pathname === '/') return { status: 302, reason: 'redirect' };
    if (pathname.startsWith('/share/')) return { status: 200, secret };
    if (matchesBackendPath(pathname, secret)) return { status: 200, secret };
    // Bare /download routes reveal private node credentials without a share token.
    return { status: 401, reason: 'Unauthorized' };
}

export function handleEdgeOneRequest(context) {
    const request = context.request;
    const pathname = new URL(request.url).pathname;
    const env = { ...process.env, ...(context.env || {}) };
    const access = validateAccess(pathname, env.SUB_STORE_FRONTEND_BACKEND_PATH);
    if (access.status === 302) return Response.redirect('https://sub-store.vercel.app/', 302);
    if (access.status !== 200) {
        return new Response(access.reason, {
            status: access.status,
            headers: { 'cache-control': 'no-store' },
        });
    }
    const run = async () => {
        try {
            const store = getStore({
                name: env.EDGEONE_BLOB_STORE || 'sub-store',
                consistency: 'strong',
            });
            const pending = [];
            const execution = { waitUntil(promise) { pending.push(Promise.resolve(promise)); } };
            const response = await subStore.fetch(
                request,
                { ...env, SUB_STORE_DATA: createBlobBinding(store) },
                execution,
            );
            // Finish persistence before allowing another request in this instance.
            await Promise.all(pending);
            return response;
        } catch (error) {
            console.error('Sub-Store EdgeOne request failed', error);
            return new Response('Internal Server Error', {
                status: 500,
                headers: { 'cache-control': 'no-store' },
            });
        }
    };
    const result = inflight.then(run);
    inflight = result.then(() => undefined, () => undefined);
    return result;
}
