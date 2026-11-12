import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAccess } from '../src/access.mjs';

const SECRET = '/' + 's'.repeat(40);

test('rejects absent, short or invalid management paths', () => {
    assert.equal(validateAccess('/api/subs', null).status, 503);
    assert.equal(validateAccess('/api/subs', '/123').status, 503);
    assert.equal(validateAccess('/api/subs', '/invalid/child').status, 503);
});

test('management routes require an exact path segment boundary', () => {
    assert.equal(validateAccess(SECRET + '/api/subs', SECRET).status, 200);
    assert.equal(validateAccess(SECRET + '/api/settings', SECRET).status, 200);
    assert.equal(validateAccess(SECRET + 'evil/api/subs', SECRET).status, 401);
    assert.equal(validateAccess('/api/subs', SECRET).status, 401);
    assert.equal(validateAccess('/download/private', SECRET).status, 401);
});

test('public share route is delegated for token verification', () => {
    assert.equal(validateAccess('/share/sub/test?token=abc', SECRET).status, 200);
    assert.equal(validateAccess('/share/sub/test', SECRET).status, 200);
    assert.equal(validateAccess('/', SECRET).status, 302);
});
