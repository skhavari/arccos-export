import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArccosSession, HttpError, type ArccosFetch, type CachedSession, type SessionCache } from '../arccos.ts';

const AUTH = 'https://authentication.arccosgolf.com';
const API = 'https://api.arccosgolf.com';
const CREDENTIALS = { email: 'golfer@example.com', password: 'password' };
const SAVED: CachedSession = {
    email: CREDENTIALS.email,
    accessKey: { userId: 'user-1', accessKey: 'saved-key', secret: 'saved-secret' },
    token: { userId: 'user-1', token: 'saved-jwt' },
};

type Call = { method: string; url: string; body?: unknown; authorization?: string };

// Fake Arccos: /accessKeys issues new-key, /tokens issues jwt-1, jwt-2, ... for known keys,
// and the API accepts only the tokens listed in `validTokens`
function fakeArccos(options: { validTokens: string[]; validKeys?: string[]; loginStatus?: number }) {
    const calls: Call[] = [];
    const validKeys = options.validKeys ?? ['new-key'];
    let issued = 0;
    const fetcher: ArccosFetch = async (url, init = {}) => {
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        const authorization = (init.headers as Record<string, string> | undefined)?.Authorization;
        calls.push({ method: init.method ?? 'GET', url, body, authorization });
        if (url === `${AUTH}/accessKeys`) {
            if (options.loginStatus) return new Response('invalid credentials', { status: options.loginStatus });
            return Response.json({ userId: 'user-1', accessKey: 'new-key', secret: 'new-secret' });
        }
        if (url === `${AUTH}/tokens`) {
            if (!validKeys.includes(body.accessKey)) return new Response('unknown key', { status: 404 });
            return Response.json({ userId: body.userId, token: `jwt-${++issued}` });
        }
        if (!options.validTokens.includes(authorization?.replace('Bearer ', '') ?? '')) {
            return new Response('expired', { status: 401 });
        }
        return Response.json({ ok: true });
    };
    const count = (path: string) => calls.filter((call) => call.url === `${AUTH}${path}`).length;
    return { calls, fetcher, count };
}

function memoryCache(initial?: CachedSession): SessionCache & { saved: CachedSession | undefined } {
    return {
        saved: initial,
        async read() {
            return this.saved;
        },
        async write(session) {
            this.saved = session;
        },
    };
}

test('signs in, exchanges the access key for a JWT, and calls the API with it', async () => {
    const arccos = fakeArccos({ validTokens: ['jwt-1'] });
    const cache = memoryCache();
    const session = new ArccosSession(CREDENTIALS, { fetcher: arccos.fetcher, cache });

    assert.deepEqual(await session.get((userId) => `/users/${userId}/rounds/7`), { ok: true });

    assert.deepEqual(arccos.calls[0].body, {
        email: 'golfer@example.com',
        password: 'password',
        isMetricUser: 'T',
        language: 'en_CA',
        signedInByFacebook: 'F',
    });
    assert.deepEqual(arccos.calls[1].body, { userId: 'user-1', accessKey: 'new-key', secret: 'new-secret' });
    assert.equal(arccos.calls[2].url, `${API}/users/user-1/rounds/7`);
    assert.equal(arccos.calls[2].authorization, 'Bearer jwt-1');
    assert.deepEqual(cache.saved, {
        email: 'golfer@example.com',
        accessKey: { userId: 'user-1', accessKey: 'new-key', secret: 'new-secret' },
        token: { userId: 'user-1', token: 'jwt-1' },
    });
});

test('reuses the access key when a 401 forces a token renewal mid-run', async () => {
    const arccos = fakeArccos({ validTokens: ['jwt-2'] });
    const session = new ArccosSession(CREDENTIALS, { fetcher: arccos.fetcher });

    await session.get(() => '/a');
    await session.get(() => '/b');

    assert.equal(arccos.count('/accessKeys'), 1);
    assert.equal(arccos.count('/tokens'), 2);
});

test('uses a saved token without signing in', async () => {
    const arccos = fakeArccos({ validTokens: ['saved-jwt'] });
    const session = new ArccosSession(CREDENTIALS, { fetcher: arccos.fetcher, cache: memoryCache(SAVED) });

    await session.get(() => '/a');

    assert.deepEqual(arccos.calls.map((call) => call.url), [`${API}/a`]);
});

test('renews an expired saved token with the saved access key', async () => {
    const arccos = fakeArccos({ validTokens: ['jwt-1'], validKeys: ['saved-key'] });
    const cache = memoryCache(SAVED);
    const session = new ArccosSession(CREDENTIALS, { fetcher: arccos.fetcher, cache });

    await session.get(() => '/a');

    assert.equal(arccos.count('/accessKeys'), 0);
    assert.equal(arccos.count('/tokens'), 1);
    assert.deepEqual(cache.saved?.token, { userId: 'user-1', token: 'jwt-1' });
});

test('signs in again when the saved access key is rejected', async () => {
    const arccos = fakeArccos({ validTokens: ['jwt-1'] });
    const cache = memoryCache(SAVED);
    const session = new ArccosSession(CREDENTIALS, { fetcher: arccos.fetcher, cache });

    await session.get(() => '/a');

    assert.equal(arccos.count('/accessKeys'), 1);
    assert.equal(cache.saved?.accessKey.accessKey, 'new-key');
});

test('ignores a saved session for a different account', async () => {
    const arccos = fakeArccos({ validTokens: ['saved-jwt', 'jwt-1'] });
    const session = new ArccosSession(
        { email: 'someone-else@example.com', password: 'password' },
        { fetcher: arccos.fetcher, cache: memoryCache(SAVED) },
    );

    await session.get(() => '/a');

    assert.equal(arccos.count('/accessKeys'), 1);
    assert.equal(arccos.calls.at(-1)?.authorization, 'Bearer jwt-1');
});

test('gives up after one renewal if the API keeps returning 401', async () => {
    const arccos = fakeArccos({ validTokens: [] });
    const session = new ArccosSession(CREDENTIALS, { fetcher: arccos.fetcher });

    await assert.rejects(session.get(() => '/a'), (error: unknown) => error instanceof HttpError && error.status === 401);
    assert.equal(arccos.count('/tokens'), 2);
});

test('reports the sign-in failure from Arccos', async () => {
    const arccos = fakeArccos({ validTokens: [], loginStatus: 401 });
    const session = new ArccosSession(CREDENTIALS, { fetcher: arccos.fetcher });

    await assert.rejects(session.get(() => '/a'), /accessKeys failed: 401 invalid credentials/);
    assert.equal(arccos.calls.length, 1);
});

test('rejects an incomplete access-key response', async () => {
    const fetcher: ArccosFetch = async () => Response.json({ userId: 'user-1' });
    const session = new ArccosSession(CREDENTIALS, { fetcher });

    await assert.rejects(session.get(() => '/a'), /access-key response was incomplete/);
});
