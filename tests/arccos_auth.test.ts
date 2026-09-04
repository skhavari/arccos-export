import assert from 'node:assert/strict';
import { authenticateArccos, type ArccosFetch } from '../arccos_auth';

type RequestLog = { url: string; init?: RequestInit };

async function testAccessKeyRefresh(): Promise<void> {
  const calls: RequestLog[] = [];
  const fetcher: ArccosFetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ userId: 'user-1', token: 'fresh-jwt' }), { status: 200 });
  };

  const result = await authenticateArccos(
    { userId: 'user-1', accessKey: 'stored-access-key', secret: 'stored-secret' },
    fetcher,
  );

  assert.deepEqual(result, { userId: 'user-1', token: 'fresh-jwt' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://authentication.arccosgolf.com/tokens');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    userId: 'user-1', accessKey: 'stored-access-key', secret: 'stored-secret',
  });
}

async function testPasswordLoginThenTokenExchange(): Promise<void> {
  const calls: RequestLog[] = [];
  const responses = [
    { userId: 'user-2', accessKey: 'new-access-key', secret: 'new-secret' },
    { userId: 'user-2', token: 'fresh-jwt-2' },
  ];
  const fetcher: ArccosFetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(responses.shift()), { status: 200 });
  };

  const result = await authenticateArccos({ email: 'golfer@example.com', password: 'password' }, fetcher);

  assert.deepEqual(result, {
    userId: 'user-2', token: 'fresh-jwt-2', accessKey: 'new-access-key', secret: 'new-secret',
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://authentication.arccosgolf.com/accessKeys');
  assert.equal(calls[1].url, 'https://authentication.arccosgolf.com/tokens');
}

async function testRejectsIncompleteAccessKey(): Promise<void> {
  const fetcher: ArccosFetch = async () => new Response(JSON.stringify({ userId: 'user-3' }), { status: 200 });
  await assert.rejects(
    authenticateArccos({ email: 'golfer@example.com', password: 'password' }, fetcher),
    /access-key response was incomplete/,
  );
}

async function testIncludesApiFailureDetails(): Promise<void> {
  const fetcher: ArccosFetch = async () => new Response('invalid credentials', { status: 401 });
  await assert.rejects(
    authenticateArccos({ email: 'golfer@example.com', password: 'wrong-password' }, fetcher),
    /accessKeys failed: 401 invalid credentials/,
  );
}

Promise.all([
  testAccessKeyRefresh(),
  testPasswordLoginThenTokenExchange(),
  testRejectsIncompleteAccessKey(),
  testIncludesApiFailureDetails(),
])
  .then(() => console.log('arccos auth tests passed'))
  .catch((error) => { console.error(error); process.exitCode = 1; });
