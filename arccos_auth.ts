const AUTH_BASE = 'https://authentication.arccosgolf.com';

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  Accept: '*/*',
  'User-Agent': 'Arccos/620158 CFNetwork/3860.500.112 Darwin/25.4.0',
};

export type ArccosFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type StoredAccessKey = {
  userId: string;
  accessKey: string;
  secret: string;
};

export type PasswordCredentials = {
  email: string;
  password: string;
};

export type ArccosAuthResult = {
  userId: string;
  token: string;
  accessKey?: string;
  secret?: string;
};

function hasStoredAccessKey(value: StoredAccessKey | PasswordCredentials): value is StoredAccessKey {
  return 'accessKey' in value;
}

async function postJson<T>(path: string, body: unknown, fetcher: ArccosFetch): Promise<T> {
  const response = await fetcher(`${AUTH_BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Arccos authentication ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export async function authenticateArccos(
  credentials: StoredAccessKey | PasswordCredentials,
  fetcher: ArccosFetch = fetch,
): Promise<ArccosAuthResult> {
  let key: StoredAccessKey;
  let newlyIssued = false;

  if (hasStoredAccessKey(credentials)) {
    key = credentials;
  } else {
    key = await postJson<StoredAccessKey>('/accessKeys', {
      email: credentials.email,
      password: credentials.password,
      isMetricUser: 'T',
      language: 'en_CA',
      signedInByFacebook: 'F',
    }, fetcher);
    if (!key.userId || !key.accessKey || !key.secret) {
      throw new Error('Arccos access-key response was incomplete.');
    }
    newlyIssued = true;
  }

  const token = await postJson<{ userId: string; token: string }>('/tokens', key, fetcher);
  if (!token.token || !token.userId) throw new Error('Arccos token response was incomplete.');

  return newlyIssued
    ? { userId: token.userId, token: token.token, accessKey: key.accessKey, secret: key.secret }
    : { userId: token.userId, token: token.token };
}
