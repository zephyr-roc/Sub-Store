import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteRequestUrl } from '../../cloudflare/src/utils/rewrite-request-url.js';
import { parseRequestBody } from '../../cloudflare/src/vendor/request-body.js';

const settings = {
    appearanceSetting: {
        isLeftRight: false,
        isIconColor: false,
        isDefaultIcon: false,
        isSimpleReicon: false,
        showFloatingRefreshButton: false,
        istabBar: false,
        istabBar2: false,
    },
};

test('Makers PATCH settings JSON survives an authenticated path rewrite', async () => {
    const original = new Request('https://example.test/management-secret/api/settings', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(JSON.stringify(settings).length),
        },
        body: JSON.stringify(settings),
    });
    const rewritten = await rewriteRequestUrl(original, 'https://example.test/api/settings?share=true');
    assert.equal(rewritten.method, 'PATCH');
    assert.equal(rewritten.headers.get('content-type'), 'application/json');
    assert.equal(rewritten.headers.has('content-length'), false);
    assert.deepEqual(await parseRequestBody(rewritten), settings);
});

test('accepts a Makers wrapper that already exposes parsed JSON as request.body', async () => {
    const incoming = {
        method: 'PATCH',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: settings,
    };
    const rewritten = await rewriteRequestUrl(incoming, 'https://example.test/api/settings');
    assert.deepEqual(await parseRequestBody(rewritten), settings);
});

test('preserves a text body on non-settings endpoints', async () => {
    const source = new Request('https://example.test/private/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello',
    });
    const rewritten = await rewriteRequestUrl(source, 'https://example.test/api/storage');
    assert.equal(await rewritten.text(), 'hello');
});

test('keeps GET request methods and query parameters when rewriting', async () => {
    const source = new Request('https://example.test/secret/api/settings?lang=zh');
    const rewritten = await rewriteRequestUrl(source, 'https://example.test/api/settings?lang=zh');
    assert.equal(rewritten.method, 'GET');
    assert.equal(new URL(rewritten.url).searchParams.get('lang'), 'zh');
});

test('invalid JSON includes safe shape metadata, never request contents', async () => {
    const request = new Request('https://example.test/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{"secret":"do-not-expose"',
    });
    let error;
    try {
        await parseRequestBody(request);
    } catch (caught) {
        error = caught;
    }
    assert.match(error.message, /Invalid JSON/);
    assert.equal(error.bodyDiagnostics.startsWithJsonDelimiter, true);
    assert.equal(error.bodyDiagnostics.receivedCharacters, '{"secret":"do-not-expose"'.length);
    assert.doesNotMatch(JSON.stringify(error.bodyDiagnostics), /do-not-expose/);
});
