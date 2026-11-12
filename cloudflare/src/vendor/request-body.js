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
            // Report metadata only; settings payloads may contain private tokens.
            const trimmed = raw.trim();
            const error = new SyntaxError('Invalid JSON request body');
            error.bodyDiagnostics = {
                receivedCharacters: raw.length,
                contentType: contentType.split(';', 1)[0],
                startsWithJsonDelimiter: /^[{\\[]/.test(trimmed),
                bodyUsed: request.bodyUsed === true,
            };
            throw error;
        }
    }
    return raw;
}
