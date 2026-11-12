import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequestBody } from '../../cloudflare/src/vendor/request-body.js';

function settingsRequest(body, contentType = 'application/json') {
    return new Request('https://example.test/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': contentType },
        body,
    });
}

test('valid JSON settings patch keeps the submitted fields', async () => {
    assert.deepEqual(await parseRequestBody(settingsRequest(
        JSON.stringify({ gistUpload: 'base64', githubUser: 'example' }),
    )), { gistUpload: 'base64', githubUser: 'example' });
});

test('settings patch accepts JSON object sent as text/plain', async () => {
    assert.deepEqual(
        await parseRequestBody(settingsRequest('{"gistUpload":"base64"}', 'text/plain;charset=UTF-8')),
        { gistUpload: 'base64' },
    );
});

test('empty and null JSON bodies remain invalid inputs for settings route', async () => {
    assert.equal(await parseRequestBody(settingsRequest('', 'application/json')), null);
    assert.equal(await parseRequestBody(settingsRequest('null')), null);
});

test('malformed JSON is rejected rather than silently converted to null', async () => {
    await assert.rejects(
        () => parseRequestBody(settingsRequest('{"gistUpload":', 'application/json')),
        /Invalid JSON request body/,
    );
});

test('other text endpoints preserve plain text payloads', async () => {
    const request = new Request('https://example.test/api/something', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'some plain text',
    });
    assert.equal(await parseRequestBody(request), 'some plain text');
});
