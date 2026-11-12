import {
    normalizeBackendPath,
    matchesBackendPath,
} from '../../cloudflare/src/utils/backend-path.js';

const SECRET_PATTERN = /^\/[A-Za-z0-9_-]{32,}$/;

export function validateAccess(pathname, rawSecret) {
    const secret = normalizeBackendPath(rawSecret);
    if (!SECRET_PATTERN.test(secret)) {
        return {
            status: 503,
            reason: 'Configure SUB_STORE_FRONTEND_BACKEND_PATH with 32+ random characters',
        };
    }
    if (pathname === '/') return { status: 302, reason: 'redirect' };
    // Share URLs are validated against their stored tokens inside Sub-Store.
    if (pathname.startsWith('/share/')) return { status: 200 };
    if (matchesBackendPath(pathname, secret)) return { status: 200 };
    return { status: 401, reason: 'Unauthorized' };
}
