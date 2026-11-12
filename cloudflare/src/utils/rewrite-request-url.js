/**
 * Copy a request for an internal route rewrite without passing a platform
 * Request wrapper as RequestInit. Some Node-function wrappers do not preserve
 * streamed PATCH bodies when supplied as another Request's init argument.
 */
export async function rewriteRequestUrl(request, url) {
    const method = (request.method || 'GET').toUpperCase();
    const headers = new Headers(request.headers || {});
    // The runtime recalculates the framing for the new Request body.
    headers.delete('content-length');
    headers.delete('transfer-encoding');

    if (method === 'GET' || method === 'HEAD') {
        return new Request(url, { method, headers });
    }

    let body;
    const existing = request.body;
    const contentType = headers.get('content-type') || '';
    // Some Node-function adapters expose an already decoded JSON object.
    // A Web ReadableStream is not such an object.
    const parsedJson = contentType.includes('json') &&
        existing !== null &&
        typeof existing === 'object' &&
        Object.getPrototypeOf(existing) === Object.prototype;
    if (parsedJson) {
        body = JSON.stringify(existing);
    } else if (typeof request.arrayBuffer === 'function') {
        body = await request.arrayBuffer();
    } else if (typeof request.text === 'function') {
        body = await request.text();
    } else if (typeof existing === 'string') {
        body = existing;
    } else if (existing instanceof Uint8Array || existing instanceof ArrayBuffer) {
        body = existing;
    } else if (existing === null || existing === undefined) {
        body = undefined;
    } else {
        throw new TypeError('Unsupported incoming request body');
    }

    return new Request(url, { method, headers, body });
}
