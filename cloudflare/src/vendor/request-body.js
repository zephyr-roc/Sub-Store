/**
 * Parse browser request bodies without discarding malformed JSON.
 * Sub-Store's settings editor may send a JSON payload with text/plain;
 * recognize that format only for PATCH /api/settings.
 */
export async function parseRequestBody(request) {
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD') return null;

    const raw = await request.text();
    if (!raw.trim()) return null;

    const contentType = (request.headers.get('content-type') || '').toLowerCase();
    const pathname = new URL(request.url).pathname;
    const settingsPatch = method === 'PATCH' && pathname === '/api/settings';
    const looksLikeJsonObject = /^[{\[]/.test(raw.trim());
    if (contentType.includes('json') || (settingsPatch && looksLikeJsonObject)) {
        try {
            return JSON.parse(raw);
        } catch {
            throw new SyntaxError('Invalid JSON request body');
        }
    }
    return raw;
}
